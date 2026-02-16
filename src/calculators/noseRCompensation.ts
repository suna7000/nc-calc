/**
 * ノーズR補正計算モジュール (Normal Offset Method + FX/FZ Synchronization)
 * 2026/01/26 物理監査に基づく最終版
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
 * プログラム点 O = P - V_offset
 * 物理監査結果: Tip 3 (外径/前) は V_offset.z = noseR, oz = pz - noseR (Zマイナス方向へシフト)
 */
export function pToO(px: number, pz: number, noseR: number, toolType: number): { ox: number; oz: number } {
    let dx = 0, dz = 0
    switch (toolType) {
        case 3: dx = noseR; dz = noseR; break;    // 外径 / 前向き
        case 4: dx = noseR; dz = -noseR; break;   // 外径 / 奥向き
        case 2: dx = -noseR; dz = noseR; break;   // 内径 / 前向き
        case 1: dx = -noseR; dz = -noseR; break;  // 内径 / 奥向き
        case 8: dx = noseR; dz = 0; break;
        default: dx = noseR; dz = noseR;
    }
    const ox = px - (dx * 2)
    const oz = pz - dz
    return { ox: round3(ox), oz: round3(oz) }
}

export class CenterTrackCalculator {
    private noseR: number;
    private toolType: number;
    private sideSign: number; // 外径: 1, 内径: -1
    private isExternal: boolean; // 外径加工かどうか

    constructor(noseR: number, isExternal: boolean = true, toolType: number = 3) {
        this.noseR = noseR;
        this.toolType = toolType;
        this.sideSign = isExternal ? 1 : -1;
        this.isExternal = isExternal;
    }

    calculate(profile: Segment[]): CompensatedSegment[] {
        if (profile.length === 0) return []

        // 全セグメントが直線の場合、教科書式を使用
        const allLines = profile.every(seg => seg.type === 'line')
        if (allLines) {
            return this.calculateWithTextbook(profile)
        }

        // 円弧を含む場合、bisector法を使用
        return this.calculateWithBisector(profile)
    }

    /**
     * 教科書式による補正計算（全セグメントが直線の場合）
     */
    private calculateWithTextbook(profile: Segment[]): CompensatedSegment[] {
        const result: CompensatedSegment[] = []

        for (let i = 0; i < profile.length; i++) {
            const seg = profile[i]

            // 開始点の補正座標を計算
            let startX: number, startZ: number
            if (i === 0) {
                // 最初のセグメントの開始点は補正なし（アプローチ点）
                startX = seg.startX
                startZ = seg.startZ
            } else {
                // 前のセグメントの終点座標を使用
                startX = result[i - 1].compensatedEndX
                startZ = result[i - 1].compensatedEndZ
            }

            // 終点の補正座標を計算（教科書式）
            const endX = seg.endX
            const endZ = seg.endZ

            // セグメントの方向ベクトルから角度を計算
            const dx = (seg.endX - seg.startX) / 2  // 半径値
            const dz = seg.endZ - seg.startZ
            const len = Math.sqrt(dx * dx + dz * dz)

            let compensatedEndX: number, compensatedEndZ: number

            if (len < 1e-9) {
                // 長さがゼロの場合は補正なし
                compensatedEndX = endX
                compensatedEndZ = endZ
            } else {
                // テーパー角度 θ
                const theta = Math.atan2(Math.abs(dx), Math.abs(dz))
                const halfTheta = theta / 2
                const tanHalf = Math.tan(halfTheta)

                // 教科書式: fz = R × (1 - tan(θ/2))（正刃の場合）
                const fz = this.isExternal
                    ? this.noseR * (1 - tanHalf)  // 正刃（外径）
                    : this.noseR * (1 + tanHalf)  // 逆刃（内径）

                // φ = 90° - θ
                const phi = Math.PI / 2 - theta
                const halfPhi = phi / 2
                const tanHalfPhi = Math.tan(halfPhi)

                // fx = 2R × (1 - tan(φ/2))（直径値）
                const fx = 2 * this.noseR * (1 - tanHalfPhi)

                // 上りテーパー/下りテーパーの判定
                const isTaperingDown = dx < 0

                // 教科書式の適用（-Z方向切削の場合）:
                //   上りテーパー: O' = O - (fx, fz)
                //   下りテーパー: O' = O + (fx, -fz)
                if (isTaperingDown) {
                    compensatedEndX = endX + fx
                    compensatedEndZ = endZ - fz
                } else {
                    compensatedEndX = endX - fx
                    compensatedEndZ = endZ - fz
                }
            }

            result.push({
                ...seg,
                compensatedStartX: round3(startX),
                compensatedStartZ: round3(startZ),
                compensatedEndX: round3(compensatedEndX),
                compensatedEndZ: round3(compensatedEndZ)
            })
        }

        return result
    }

    /**
     * Bisector法による補正計算（円弧を含む場合）
     */
    private calculateWithBisector(profile: Segment[]): CompensatedSegment[] {
        const nodes: { x: number, z: number, n: { nx: number, nz: number } }[] = []
        for (let i = 0; i <= profile.length; i++) {
            let n: { nx: number, nz: number }
            if (i === 0) {
                n = this.getNormalAt(profile[0], 'start')
            } else if (i === profile.length) {
                n = this.getNormalAt(profile[profile.length - 1], 'end')
            } else {
                const n1 = this.getNormalAt(profile[i - 1], 'end')
                const n2 = this.getNormalAt(profile[i], 'start')
                const bisec = this.calculateBisector(n1, n2)
                n = { nx: bisec.bx * (bisec.dist / this.noseR), nz: bisec.bz * (bisec.dist / this.noseR) }
            }

            const refX = (i < profile.length ? profile[i].startX : profile[profile.length - 1].endX) / 2
            const refZ = (i < profile.length ? profile[i].startZ : profile[profile.length - 1].endZ)

            const px = refX + n.nx * this.noseR
            const pz = refZ + n.nz * this.noseR
            nodes.push({ x: px, z: pz, n })
        }

        const result: CompensatedSegment[] = []
        for (let i = 0; i < profile.length; i++) {
            const seg = profile[i]
            const sNode = nodes[i], eNode = nodes[i + 1]

            const startO = pToO(sNode.x * 2, sNode.z, this.noseR, this.toolType)
            const endO = pToO(eNode.x * 2, eNode.z, this.noseR, this.toolType)

            let cR = seg.radius
            let cCX = seg.centerX
            let cCZ = seg.centerZ

            if (seg.type === 'arc' && seg.radius !== undefined && seg.centerX !== undefined && seg.centerZ !== undefined) {
                const isConvex = seg.isConvex !== false
                cR = isConvex ? (seg.radius + this.noseR) : Math.abs(seg.radius - this.noseR)
                const centerProg = pToO(seg.centerX, seg.centerZ, this.noseR, this.toolType)
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

        // 教科書式（nose_r_calculation_reference.md）:
        // 正刃（外径加工）: dist = R × (1 - tan(θ/2))
        // 逆刃（内径加工）: dist = R × (1 + tan(θ/2))
        // Spike Guard: 180度反転等での発散防止
        const tanHalf = sinHalf / Math.max(0.01, cosHalf)
        const dist = this.isExternal
            ? this.noseR * (1 - tanHalf)  // 正刃（外径）
            : this.noseR * (1 + tanHalf)  // 逆刃（内径）

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
