/**
 * ノーズR補正計算モジュール (Geometric Offset Intersection Method)
 * 2026/02/12 幾何学的交点法による修正版
 * dist = R / cos(θ/2) … 2本のオフセット線の交点距離（教科書: Peter Smid / ISO 補正理論）
 */

export type SegmentType = 'line' | 'arc'

export interface Segment {
    type: SegmentType
    startX: number
    startZ: number
    endX: number
    endZ: number
    centerX?: number
    centerZ?: number
    radius?: number
    isConvex?: boolean
    angle?: number  // テーパー角度（度）: 直線セグメントの場合
}

export interface CompensatedSegment extends Segment {
    compensatedStartX: number
    compensatedStartZ: number
    compensatedEndX: number
    compensatedEndZ: number
    compensatedRadius?: number
    compensatedI?: number
    compensatedK?: number
    compensatedCenterX?: number
    compensatedCenterZ?: number
}

function round3(v: number): number {
    return Math.round(v * 1000) / 1000
}

/**
 * テーパー線専用のdz計算（ユーザー記事の数式）
 *
 * 記事1-2の数式:
 * - 上りテーパー（直径減少）: fz = R × (1 - tan(θ/2))
 * - 下りテーパー（直径増加）: fz = R × (1 + tan(θ/2))
 *
 * 重要: 「上り/下り」は直径の変化で判定（Z方向ではない）
 *
 * @param angle - テーパー角度（度）: 水平からの角度
 * @param noseR - ノーズR半径
 * @param tipNumber - チップ番号
 * @param isDiameterIncreasing - 直径が増加するテーパーかどうか
 * @returns dz - Z方向補正量（符号付き）
 */
function calculateDzForTaper(
    angle: number,
    noseR: number,
    tipNumber: number,
    isDiameterIncreasing: boolean
): number {
    // Tip 8（端面工具）: 常にdz=0
    if (tipNumber === 8) {
        return 0
    }

    // チップ番号の符号テーブル
    const dzSign = [0, -1, +1, +1, -1]
    const sign = dzSign[tipNumber] || +1

    // θ/2 をラジアンで計算
    const thetaRad = (angle * Math.PI) / 180
    const halfAngleRad = thetaRad / 2

    // fz = R × (1 ± tan(θ/2))
    const factor = isDiameterIncreasing
        ? (1 + Math.tan(halfAngleRad))  // 下りテーパー（直径増加）
        : (1 - Math.tan(halfAngleRad))  // 上りテーパー（直径減少）

    return noseR * factor * sign
}

/**
 * ハイブリッド dz 計算（改良版）
 *
 * 前提: 現行bisector実装 b̂ = normalize(n̂₁ + n̂₂) および P = ref + b̂ × dist に依存
 *
 * Task 1-2-3 の検証結果 + 凹円弧の特殊ケースを考慮
 *
 * ルール:
 * 1. 端面工具（Tip 8）: 常に dz=0 （特例）
 * 2. 凹円弧（隅R）: 常に dz=noseR×sign （bzに関係なく）
 * 3. 凸円弧（角R）or 直線: bzで判定
 *    - |bz| < threshold → dz=0 （法線が水平）
 *    - |bz| ≥ threshold → dz=noseR×sign
 *
 * @param bisec - bisector計算結果 { bz: number, ... }
 * @param noseR - ノーズ半径
 * @param tipNumber - 工具チップ番号 (1-4, 8)
 * @param isConvex - 凹円弧判定（false=凹円弧、true=凸円弧 or 直線）
 *                   暫定: Phase 2 互換ガード、将来的には bisec のみに統一予定
 * @returns dz - Z方向オフセット量
 */
function calculateDzFromBisector(
    bisec: { bz: number },
    noseR: number,
    tipNumber: number,
    isConvex: boolean = true
): number {
    // 堅牢性チェック: bisec未定義またはbz=NaNの場合はフォールバック
    if (!bisec || !Number.isFinite(bisec.bz)) {
        const dzSign = [0, -1, +1, +1, -1]
        const sign = dzSign[tipNumber] || +1
        return noseR * sign
    }

    // 特例: 端面工具（Tip 8）は常にdz=0
    if (tipNumber === 8) {
        return 0
    }

    // チップ番号の符号テーブル（Tip 1-4）
    //           [0,  1,  2,  3,  4]
    const dzSign = [0, -1, +1, +1, -1]
    const sign = dzSign[tipNumber] || +1

    // ルール2: 凹円弧は常にオフセット必要（Phase 2 で判明した制約）
    if (isConvex === false) {
        return noseR * sign
    }

    // ルール3: 凸円弧 or 直線: bzで判定
    // bzThreshold = 0.01: 倍精度浮動小数点 + 正規化誤差マージン
    const bzThreshold = 0.01
    const bzAbs = Math.abs(bisec.bz)

    if (bzAbs < bzThreshold) {
        return 0  // 法線が水平 → 追加Z方向オフセット不要
    } else {
        return noseR * sign  // 符号付きオフセット量
    }
}

// フラグ: bz ベースの一般解を使用するか（デフォルトは false = 既存動作）
const USE_BZ_BASED_DZ = true  // Phase 2 検証: 一般解をテスト

/**
 * プログラム点 O = P - V_offset
 * 物理監査結果: Tip 3 (外径/前) は V_offset.z = noseR, oz = pz - noseR (Zマイナス方向へシフト)
 *
 * @param isConvexOrBisec - 既存: boolean (isConvex), 新規: { bisec: { bz: number }, isConvex: boolean }
 */
export function pToO(
    px: number,
    pz: number,
    noseR: number,
    toolType: number,
    isConvexOrBisec: boolean | { bisec: { bz: number }, isConvex: boolean } = true
): { ox: number; oz: number } {
    let dx = 0, dz = 0

    // dx の計算（変更なし）
    switch (toolType) {
        case 2:
        case 1:
            dx = -noseR
            break
        default:
            dx = noseR
    }

    // dz の計算（新旧切り替え）
    if (USE_BZ_BASED_DZ && typeof isConvexOrBisec === 'object' && 'bisec' in isConvexOrBisec) {
        // 新実装: ハイブリッド解（bz + 凹円弧判定）
        dz = calculateDzFromBisector(isConvexOrBisec.bisec, noseR, toolType, isConvexOrBisec.isConvex)
    } else {
        // 既存実装: isConvex ベース
        const isConvex = typeof isConvexOrBisec === 'boolean' ? isConvexOrBisec : true
        switch (toolType) {
            case 3: dz = isConvex ? 0 : noseR; break;    // 外径 / 前向き
            case 4: dz = isConvex ? 0 : -noseR; break;   // 外径 / 奥向き
            case 2: dz = isConvex ? 0 : noseR; break;    // 内径 / 前向き
            case 1: dz = isConvex ? 0 : -noseR; break;   // 内径 / 奥向き
            case 8: dz = 0; break;
            default: dz = isConvex ? 0 : noseR;
        }
    }

    const ox = px - (dx * 2)
    const oz = pz - dz
    return { ox: round3(ox), oz: round3(oz) }
}

export class CenterTrackCalculator {
    private noseR: number;
    private toolType: number;
    private sideSign: number; // 外径: 1, 内径: -1

    constructor(noseR: number, isExternal: boolean = true, toolType: number = 3) {
        this.noseR = noseR;
        this.toolType = toolType;
        this.sideSign = isExternal ? 1 : -1;
    }

    calculate(profile: Segment[]): CompensatedSegment[] {
        if (profile.length === 0) return []
        return this.calculateWithBisector(profile)
    }

    /**
     * 幾何学的交点法による補正計算（ノードベース版）
     *
     * 重要な変更: dzをノードごとに1回だけ計算し、連続性を保証
     * - 同じノードを共有するセグメントは同じO座標を使用
     * - セグメントタイプではなく、ノードの幾何（bisector.bz）で判定
     */
    private calculateWithBisector(profile: Segment[]): CompensatedSegment[] {
        // Step 1: P座標（工具中心点）の計算
        const nodes: {
            x: number,
            z: number,
            n: { nx: number, nz: number },
            bisec?: { bx: number, bz: number, dist: number }
        }[] = []

        for (let i = 0; i <= profile.length; i++) {
            let n: { nx: number, nz: number }
            let bisec: { bx: number, bz: number, dist: number } | undefined

            if (i === 0) {
                const seg = profile[0]
                // テーパー線の場合：P座標に垂直オフセットを含めない（fzで全て補正）
                if (seg.type === 'line' && seg.angle !== undefined && seg.angle !== 0 && seg.angle !== 90) {
                    n = { nx: 0, nz: 0 }
                } else {
                    n = this.getNormalAt(seg, 'start')
                }
            } else if (i === profile.length) {
                const seg = profile[profile.length - 1]
                // テーパー線の場合：P座標に垂直オフセットを含めない（fzで全て補正）
                if (seg.type === 'line' && seg.angle !== undefined && seg.angle !== 0 && seg.angle !== 90) {
                    n = { nx: 0, nz: 0 }
                } else {
                    n = this.getNormalAt(seg, 'end')
                }
            } else {
                // 接続点ノード: 前後のセグメントを確認
                const prevSeg = profile[i - 1]
                const nextSeg = profile[i]

                // ⭐ テーパー線の場合: P座標は幾何座標そのまま（垂直オフセットなし）
                // 記事の fz = R×(1±tan(θ/2)) が合計補正量なので、P座標にオフセットを含めない
                const prevIsTaper = prevSeg.type === 'line' && prevSeg.angle !== undefined && prevSeg.angle !== 0 && prevSeg.angle !== 90
                const nextIsTaper = nextSeg.type === 'line' && nextSeg.angle !== undefined && nextSeg.angle !== 0 && nextSeg.angle !== 90

                if (prevIsTaper || nextIsTaper) {
                    // テーパー線：垂直オフセットなし（n = 0ベクトル相当）
                    // fz補正だけを dz で適用する
                    n = { nx: 0, nz: 0 }
                } else {
                    // 通常のBisector計算
                    const n1 = this.getNormalAt(profile[i - 1], 'end')
                    const n2 = this.getNormalAt(profile[i], 'start')
                    bisec = this.calculateBisector(n1, n2)
                    n = { nx: bisec.bx * (bisec.dist / this.noseR), nz: bisec.bz * (bisec.dist / this.noseR) }
                }
            }

            const refX = (i < profile.length ? profile[i].startX : profile[profile.length - 1].endX) / 2
            const refZ = (i < profile.length ? profile[i].startZ : profile[profile.length - 1].endZ)

            const px = refX + n.nx * this.noseR
            const pz = refZ + n.nz * this.noseR

            nodes.push({ x: px, z: pz, n, bisec })
        }

        // Step 2: ノードごとのO座標を事前計算（連続性保証）
        const nodeO: { ox: number, oz: number }[] = []

        for (let i = 0; i <= profile.length; i++) {
            const node = nodes[i]
            const px = node.x * 2
            const pz = node.z

            // dx計算（チップ番号依存）
            const dx = (this.toolType === 2 || this.toolType === 1) ? -this.noseR : this.noseR

            // dz計算（ノードベース - これが重要！）
            let dz: number

            if (USE_BZ_BASED_DZ) {
                // 端点ノード
                if (i === 0 || i === profile.length) {
                    const seg = (i === 0) ? profile[0] : profile[profile.length - 1]

                    // ⭐ テーパー線の場合: 記事の数式を使用
                    if (seg.type === 'line' && seg.angle !== undefined && seg.angle !== 0 && seg.angle !== 90) {
                        // 直径が増加するか減少するかを判定
                        const isDiameterIncreasing = seg.endX > seg.startX
                        dz = calculateDzForTaper(seg.angle, this.noseR, this.toolType, isDiameterIncreasing)
                    } else {
                        const isConvex = (seg.type === 'arc' && seg.isConvex !== false)
                        dz = calculateDzFromBisector(
                            node.bisec ?? { bz: 0 },
                            this.noseR,
                            this.toolType,
                            isConvex
                        )
                    }
                }
                // 接続点ノード（重要: 両側のセグメントを考慮）
                else {
                    const prevSeg = profile[i - 1]
                    const nextSeg = profile[i]

                    // ⭐ どちらかがテーパー線の場合: 記事の数式を使用
                    const prevIsTaper = prevSeg.type === 'line' && prevSeg.angle !== undefined && prevSeg.angle !== 0 && prevSeg.angle !== 90
                    const nextIsTaper = nextSeg.type === 'line' && nextSeg.angle !== undefined && nextSeg.angle !== 0 && nextSeg.angle !== 90

                    if (prevIsTaper || nextIsTaper) {
                        // テーパー接続点: テーパーセグメントの直径変化で判定
                        const taperSeg = prevIsTaper ? prevSeg : nextSeg
                        const isDiameterIncreasing = taperSeg.endX > taperSeg.startX
                        dz = calculateDzForTaper(taperSeg.angle!, this.noseR, this.toolType, isDiameterIncreasing)
                    } else {
                        // 直線が接続している場合（重要な発見！）
                        // 直線セグメントには常に標準的なノーズR補正が必要
                        // bisec.bz = 0 でも dz = noseR を適用する
                        const hasLine = (prevSeg.type === 'line' || nextSeg.type === 'line')

                        // 凹円弧が接続している場合（Phase 2の発見）
                        const hasConcaveArc =
                            (prevSeg.type === 'arc' && prevSeg.isConvex === false) ||
                            (nextSeg.type === 'arc' && nextSeg.isConvex === false)

                        // 直線または凹円弧が関与 → 常にオフセット必要
                        // 両方が凸円弧の場合のみ → bz判定
                        if (hasLine || hasConcaveArc) {
                            dz = calculateDzFromBisector(
                                node.bisec!,
                                this.noseR,
                                this.toolType,
                                false  // isConvex=false → 常にdz=noseR
                            )
                        } else {
                            // 両方が凸円弧の接続 → bz判定を使用
                            dz = calculateDzFromBisector(
                                node.bisec!,
                                this.noseR,
                                this.toolType,
                                true  // isConvex=true → bz判定でdz決定
                            )
                        }
                    }
                }
            } else {
                // 旧実装との互換性（USE_BZ_BASED_DZ = false）
                const seg = (i < profile.length) ? profile[i] : profile[profile.length - 1]
                const isConvex = (seg.type === 'arc' && seg.isConvex !== false)

                switch (this.toolType) {
                    case 3: dz = isConvex ? 0 : this.noseR; break;
                    case 4: dz = isConvex ? 0 : -this.noseR; break;
                    case 2: dz = isConvex ? 0 : this.noseR; break;
                    case 1: dz = isConvex ? 0 : -this.noseR; break;
                    case 8: dz = 0; break;
                    default: dz = isConvex ? 0 : this.noseR;
                }
            }

            const ox = px - (dx * 2)
            const oz = pz - dz
            nodeO.push({ ox: round3(ox), oz: round3(oz) })
        }

        // Step 3: セグメントの補正座標を構築（事前計算済みnodeOを使用）
        const result: CompensatedSegment[] = []
        for (let i = 0; i < profile.length; i++) {
            const seg = profile[i]

            // 事前計算済みのO座標を使用（連続性が保証される）
            const startO = nodeO[i]
            const endO = nodeO[i + 1]

            let cR = seg.radius
            let cCX = seg.centerX
            let cCZ = seg.centerZ

            if (seg.type === 'arc' && seg.radius !== undefined && seg.centerX !== undefined && seg.centerZ !== undefined) {
                const isConvex = seg.isConvex !== false
                cR = isConvex ? (seg.radius + this.noseR) : Math.abs(seg.radius - this.noseR)
                const centerProg = pToO(seg.centerX, seg.centerZ, this.noseR, this.toolType, isConvex)
                cCX = centerProg.ox
                cCZ = centerProg.oz
            }

            result.push({
                ...seg,
                compensatedStartX: startO.ox,
                compensatedStartZ: startO.oz,
                compensatedEndX: endO.ox,
                compensatedEndZ: endO.oz,
                compensatedRadius: cR !== undefined ? round3(cR) : undefined,
                compensatedCenterX: cCX !== undefined ? round3(cCX) : undefined,
                compensatedCenterZ: cCZ !== undefined ? round3(cCZ) : undefined,
                compensatedI: (seg.type === 'arc' && cCX !== undefined) ? round3((cCX - startO.ox) / 2) : undefined,
                compensatedK: (seg.type === 'arc' && cCZ !== undefined) ? round3(cCZ - startO.oz) : undefined
            })
        }
        return result
    }

    private calculateBisector(n1: { nx: number, nz: number }, n2: { nx: number, nz: number }): { dist: number, bx: number, bz: number } {
        const dot = Math.max(-1.0, Math.min(1.0, n1.nx * n2.nx + n1.nz * n2.nz))
        const cosHalf = Math.sqrt((1.0 + dot) / 2.0)
        const sinHalf = Math.sqrt((1.0 - dot) / 2.0)

        // 修正: dist = R * tan(θ/2) でテーパー補正の精度が向上
        // tan(θ/2) = sin(θ/2) / cos(θ/2)
        // Spike Guard: 180度反転等での発散防止（cos→0で分母保護）
        const tanHalf = sinHalf / Math.max(0.01, cosHalf)
        const dist = this.noseR * tanHalf

        let bx = n1.nx + n2.nx, bz = n1.nz + n2.nz
        const len = Math.sqrt(bx * bx + bz * bz)
        if (len < 1e-4) return { dist: this.noseR, bx: n1.nx, bz: n1.nz }
        return { dist, bx: bx / len, bz: bz / len }
    }

    private getNormalAt(seg: Segment, pos: 'start' | 'end'): { nx: number; nz: number } {
        let nx = 0, nz = 0
        if (seg.type === 'arc' && seg.centerX !== undefined && seg.centerZ !== undefined) {
            const px = (pos === 'start' ? seg.startX : seg.endX) / 2
            const pz = (pos === 'start' ? seg.startZ : seg.endZ)
            nx = (px - seg.centerX / 2); nz = (pz - seg.centerZ)
            if (!(seg.isConvex ?? true)) { nx = -nx; nz = -nz }
        } else {
            const dx = (seg.endX - seg.startX) / 2, dz = seg.endZ - seg.startZ
            nx = -dz; nz = dx
        }
        const len = Math.sqrt(nx * nx + nz * nz)
        if (len < 1e-9) return { nx: 0, nz: 0 }
        const rNx = nx / len
        // 法線の極性判定：後刃物台・外径加工の物理系に固定。
        // 空側(チップがある側)へのオフセット方向をsideSignで制御。
        const sign = this.sideSign
        return { nx: rNx * sign, nz: (nz / len) * sign }
    }
}
