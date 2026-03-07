/**
 * ノーズR補正計算モジュール (Geometric Offset Intersection Method)
 * 2026/02/12 幾何学的交点法による修正版
 * 2026/02/26 テーパー公式修正: fz = R(1±tan(θ/2))
 * 2026/02/28 三重モデル: テーパー始点/終点 + bisector(R/cos(α/2))
 *   - テーパー終点: fz公式 + 次セグメント法線でX計算
 *   - テーパー始点: fz公式 + 前セグメント法線でX計算
 *   - bisector距離: R×tan(α/2) → R/cos(α/2) (オフセット線交点)
 */

export type SegmentType = 'line' | 'corner-r' | 'corner-c'

export interface Segment {
    type: SegmentType
    startX: number
    startZ: number
    endX: number
    endZ: number
    angle?: number       // テーパー角度（直線の場合）
    centerX?: number
    centerZ?: number
    radius?: number
    isConvex?: boolean
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

    // bzThreshold = 0.01: 倍精度浮動小数点 + 正規化誤差マージン
    const bzThreshold = 0.01
    const bzAbs = Math.abs(bisec.bz)

    // ルール2: 凹円弧は常にオフセット必要（Phase 2 で判明した制約）
    if (isConvex === false) {
        return noseR * sign
    }

    // ルール3: 凸円弧 or 直線: bzで判定
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
     * テーパー判定: 0°と90°以外の角度を持つ直線セグメント
     */
    private isTaper(seg: Segment): boolean {
        return seg.type === 'line' &&
               seg.angle !== undefined &&
               seg.angle !== 0 &&
               seg.angle !== 90
    }

    /**
     * 幾何学的交点法による補正計算
     * 各ノード(接続点)でのオフセット量 = R × tan(θ/2) … 2本のオフセット線の交点
     * 端点ノードは法線方向へR（単純オフセット）
     *
     * 改良版: テーパーセグメントの終点は専用公式を使用
     */
    private calculateWithBisector(profile: Segment[]): CompensatedSegment[] {
        const nodes: {
            x: number,
            z: number,
            n: { nx: number, nz: number },
            bisec?: { bx: number, bz: number, dist: number },  // 一般解用に保存
            usedTaperFormula?: boolean  // テーパー公式を使用したノード（dz=0）
        }[] = []

        for (let i = 0; i <= profile.length; i++) {
            let n: { nx: number, nz: number }
            let bisec: { bx: number, bz: number, dist: number } | undefined

            const refX = (i < profile.length ? profile[i].startX : profile[profile.length - 1].endX) / 2
            const refZ = (i < profile.length ? profile[i].startZ : profile[profile.length - 1].endZ)

            // テーパー始点/終点の特殊処理
            const prevSeg = i > 0 ? profile[i - 1] : null
            const nextSeg = i < profile.length ? profile[i] : null
            const isPrevTaper = prevSeg && this.isTaper(prevSeg)
            const isNextTaper = nextSeg && this.isTaper(nextSeg)

            if (isPrevTaper && i < profile.length) {
                // テーパー終点：fz公式 + 次セグメント法線でX計算
                const taperAngle = prevSeg!.angle!
                const taperAngleRad = taperAngle * Math.PI / 180
                const halfAngleRad = taperAngleRad / 2

                // 次のセグメントが凹円弧（隅R）かチェック
                const isNextConcave = nextSeg!.type === 'corner-r' && nextSeg!.isConvex === false

                let pz: number
                if (isNextConcave) {
                    // 隅R（凹円弧）への進入：特殊な補正公式
                    const fz = this.noseR * (1 + Math.tan(halfAngleRad))
                    const fz_effective = fz * Math.cos(taperAngleRad)
                    pz = refZ + fz_effective
                } else {
                    // 通常のテーパー終点：fz = R × (1 - tan(θ/2))
                    const fz = this.noseR * (1 - Math.tan(halfAngleRad))
                    pz = refZ - fz
                }

                // P座標のX成分: 次セグメント法線を使用（テーパー法線ではなく隣接セグメント）
                n = this.getNormalAt(profile[i], 'start')
                const px = refX + n.nx * this.noseR

                // テーパー公式使用フラグをセット
                nodes.push({ x: px, z: pz, n, bisec: undefined, usedTaperFormula: true })
            } else if (isNextTaper && i > 0) {
                // テーパー始点：fz公式 + 前セグメント法線でX計算
                const taperAngle = nextSeg!.angle!
                const taperAngleRad = taperAngle * Math.PI / 180
                const halfAngleRad = taperAngleRad / 2

                // 直径変化方向の判定
                const isDiameterDecreasing = nextSeg!.endX < nextSeg!.startX

                let pz: number
                if (isDiameterDecreasing) {
                    // ascending（直径減少）：fz = R × (1 - tan(θ/2))
                    const fz = this.noseR * (1 - Math.tan(halfAngleRad))
                    pz = refZ - fz
                } else {
                    // descending（直径増加）：fz = R × (1 + tan(θ/2))
                    const fz = this.noseR * (1 + Math.tan(halfAngleRad))
                    pz = refZ - fz
                }

                // P座標のX成分: 前セグメント法線を使用
                const prevN = this.getNormalAt(profile[i - 1], 'end')
                const px = refX + prevN.nx * this.noseR

                n = this.getNormalAt(nextSeg!, 'start')
                nodes.push({ x: px, z: pz, n, bisec: undefined, usedTaperFormula: true })
            } else {
                // 通常の Bisector Method
                if (i === 0) {
                    n = this.getNormalAt(profile[0], 'start')
                } else if (i === profile.length) {
                    n = this.getNormalAt(profile[profile.length - 1], 'end')
                } else {
                    const n1 = this.getNormalAt(profile[i - 1], 'end')
                    const n2 = this.getNormalAt(profile[i], 'start')
                    bisec = this.calculateBisector(n1, n2)
                    n = { nx: bisec.bx * (bisec.dist / this.noseR), nz: bisec.bz * (bisec.dist / this.noseR) }
                }

                const px = refX + n.nx * this.noseR
                const pz = refZ + n.nz * this.noseR

                nodes.push({ x: px, z: pz, n, bisec })
            }
        }

        const result: CompensatedSegment[] = []
        for (let i = 0; i < profile.length; i++) {
            const seg = profile[i]
            const sNode = nodes[i], eNode = nodes[i + 1]

            // Z offset logic for bisector method:
            // - Convex arcs (角R): bisector handles it perfectly, no additional Z offset (isConvex=true → dz=0)
            // - Concave arcs (隅R): need additional Z offset (isConvex=false → dz=noseR)
            // - Lines: also need additional Z offset (isConvex=false → dz=noseR)

            // Only convex arcs should have isConvex=true (no Z offset)
            // Everything else (concave arcs and lines) should have isConvex=false (apply Z offset)
            const startIsConvex = (seg.type === 'corner-r' && seg.isConvex !== false)
            const endIsConvex = (seg.type === 'corner-r' && seg.isConvex !== false)

            // フラグで切り替え: USE_BZ_BASED_DZ = true なら bisec + isConvex を渡す
            // テーパー公式使用ノードの場合は強制的にdz=0
            const startParam = sNode.usedTaperFormula
                ? true  // テーパー公式使用時はisConvex=trueでdz=0
                : (USE_BZ_BASED_DZ && sNode.bisec)
                    ? { bisec: sNode.bisec, isConvex: startIsConvex }
                    : startIsConvex
            const endParam = eNode.usedTaperFormula
                ? true  // テーパー公式使用時はisConvex=trueでdz=0
                : (USE_BZ_BASED_DZ && eNode.bisec)
                    ? { bisec: eNode.bisec, isConvex: endIsConvex }
                    : endIsConvex

            const startO = pToO(sNode.x * 2, sNode.z, this.noseR, this.toolType, startParam)
            const endO = pToO(eNode.x * 2, eNode.z, this.noseR, this.toolType, endParam)

            let cR = seg.radius
            let cCX = seg.centerX
            let cCZ = seg.centerZ

            if (seg.type === 'corner-r' && seg.radius !== undefined && seg.centerX !== undefined && seg.centerZ !== undefined) {
                const isConvex = seg.isConvex !== false
                cR = isConvex ? (seg.radius + this.noseR) : Math.abs(seg.radius - this.noseR)
                const centerProg = pToO(seg.centerX, seg.centerZ, this.noseR, this.toolType, isConvex)
                cCX = centerProg.ox
                cCZ = centerProg.oz
            }

            result.push({
                ...seg,
                compensatedStartX: startO.ox, compensatedStartZ: startO.oz,
                compensatedEndX: endO.ox, compensatedEndZ: endO.oz,
                compensatedRadius: cR !== undefined ? round3(cR) : undefined,
                compensatedCenterX: cCX !== undefined ? round3(cCX) : undefined,
                compensatedCenterZ: cCZ !== undefined ? round3(cCZ) : undefined,
                compensatedI: (seg.type === 'corner-r' && cCX !== undefined) ? round3((cCX - startO.ox) / 2) : undefined,
                compensatedK: (seg.type === 'corner-r' && cCZ !== undefined) ? round3(cCZ - startO.oz) : undefined
            })
        }
        return result
    }

    private calculateBisector(n1: { nx: number, nz: number }, n2: { nx: number, nz: number }): { dist: number, bx: number, bz: number } {
        const dot = Math.max(-1.0, Math.min(1.0, n1.nx * n2.nx + n1.nz * n2.nz))
        const cosHalf = Math.sqrt((1.0 + dot) / 2.0)

        // 幾何学的交点: dist = R / cos(α/2)
        // 2本のオフセット線の交点は、二等分線方向にR/cos(α/2)の距離
        // 注: R×tan(α/2)はライン沿いの接線点距離であり、二等分線沿いの交点距離ではない
        // Spike Guard: 180度反転等での発散防止（cos→0で1/cos→∞を防ぐ）
        const dist = (dot >= 0)
            ? this.noseR / Math.max(0.01, cosHalf)  // 凸コーナー: オフセット線交点
            : this.noseR                              // S字/凹コーナー: 単純オフセット

        let bx = n1.nx + n2.nx, bz = n1.nz + n2.nz
        const len = Math.sqrt(bx * bx + bz * bz)
        if (len < 1e-4) return { dist: this.noseR, bx: n1.nx, bz: n1.nz }
        return { dist, bx: bx / len, bz: bz / len }
    }

    private getNormalAt(seg: Segment, pos: 'start' | 'end'): { nx: number; nz: number } {
        let nx = 0, nz = 0
        if (seg.type === 'corner-r' && seg.centerX !== undefined && seg.centerZ !== undefined) {
            const px = (pos === 'start' ? seg.startX : seg.endX) / 2
            const pz = (pos === 'start' ? seg.startZ : seg.endZ)
            nx = (px - seg.centerX / 2); nz = (pz - seg.centerZ)
            if (!(seg.isConvex ?? true)) { nx = -nx; nz = -nz }
        } else {
            const dx = (seg.endX - seg.startX) / 2, dz = seg.endZ - seg.startZ
            if (Math.abs(dz) < 1e-6 && dx < -1e-6) {
                // 内向き端面(face cut, dx<0): 左垂直(-dz,dx)が-Z方向を指し、誤り
                // 材料は-Z側にあるため、法線は+Z方向が正しい
                nx = 0
                nz = 1
            } else {
                nx = -dz; nz = dx
            }
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
