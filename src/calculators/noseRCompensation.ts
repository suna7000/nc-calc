/**
 * ノーズR補正計算モジュール (Normal Offset Method)
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

export function oToP(ox: number, oz: number, noseR: number, toolType: number): { px: number; pz: number } {
    let dx = 0, dz = 0
    switch (toolType) {
        case 1: dx = 2 * noseR; dz = -noseR; break;   // Tip 1: (X+, Z-) Internal/Back
        case 2: dx = 2 * noseR; dz = noseR; break;    // Tip 2: (X+, Z+) Internal/Front
        case 3: dx = -2 * noseR; dz = -noseR; break;  // Tip 3: (X-, Z-) External/Standard
        case 4: dx = -2 * noseR; dz = noseR; break;   // Tip 4: (X-, Z+) External/Back
        case 5: dx = 0; dz = -noseR; break;           // Tip 5: (Z-) Face center
        case 6: dx = 2 * noseR; dz = 0; break;        // Tip 6: (X+) ID center
        case 7: dx = 0; dz = noseR; break;            // Tip 7: (Z+) Back center
        case 8: dx = -2 * noseR; dz = 0; break;       // Tip 8: (X-) OD center
        case 9: dx = 0; dz = 0; break;                // Tip 9: Center
        default: dx = -2 * noseR; dz = -noseR;
    }
    return { px: round3(ox + dx), pz: round3(oz + dz) }
}

export function calculateArcOffset(radius: number, isConvex: boolean, noseR: number): { compensatedRadius: number } {
    const rc = isConvex ? (radius + noseR) : (radius - noseR)
    return { compensatedRadius: round3(Math.max(1e-6, rc)) }
}

export function calculateCompensatedIK(startX: number, startZ: number, centerX: number, centerZ: number): { i: number; k: number } {
    return { i: round3((centerX - startX) / 2), k: round3(centerZ - startZ) }
}

export class CenterTrackCalculator {
    private noseR: number; private isExternal: boolean; private toolType: number;
    constructor(noseR: number, isExternal: boolean = true, toolType: number = 3) {
        this.noseR = noseR; this.isExternal = isExternal; this.toolType = toolType;
    }

    calculate(profile: Segment[]): CompensatedSegment[] {
        if (profile.length === 0) return []

        // 1. 各ノード（接続点）の補正座標 P を先に求める
        const nodePoints: { x: number, z: number }[] = []

        for (let i = 0; i <= profile.length; i++) {
            let px: number, pz: number
            if (i === 0) {
                // 始端
                const n = this.getNormalAt(profile[0], 'start')
                const p = oToP((profile[0].startX / 2 + n.nx * this.noseR) * 2, profile[0].startZ + n.nz * this.noseR, this.noseR, this.toolType)
                px = p.px; pz = p.pz
            } else if (i === profile.length) {
                // 終端
                const prev = profile[i - 1]
                const n = this.getNormalAt(prev, 'end')
                const p = oToP((prev.endX / 2 + n.nx * this.noseR) * 2, prev.endZ + n.nz * this.noseR, this.noseR, this.toolType)
                px = p.px; pz = p.pz
            } else {
                // セグメント間の遷移点
                const prev = profile[i - 1]
                const next = profile[i]

                // 二等分線投影手法 (Bisector Projection)
                // これにより、手計算パターンの tan(theta/2) 補正が自動的に行われる
                const n1 = this.getNormalAt(prev, 'end')
                const n2 = this.getNormalAt(next, 'start')

                const dot = Math.max(-1, Math.min(1, n1.nx * n2.nx + n1.nz * n2.nz))
                const cosHalfSq = (1 + dot) / 2
                const cosHalf = Math.sqrt(Math.max(0.01, cosHalfSq))
                const dist = this.noseR / cosHalf // 投影距離

                let bx = n1.nx + n2.nx, bz = n1.nz + n2.nz
                const blen = Math.sqrt(bx * bx + bz * bz)
                if (blen < 1e-6) { bx = n1.nx; bz = n1.nz }
                else { bx /= blen; bz /= blen }

                const op = {
                    x: (prev.endX / 2 + bx * dist) * 2,
                    z: prev.endZ + bz * dist
                }
                const p = oToP(op.x, op.z, this.noseR, this.toolType)
                px = p.px; pz = p.pz
            }
            nodePoints.push({ x: px, z: pz })
        }

        // 2. セグメントを構築
        const result: CompensatedSegment[] = []
        for (let i = 0; i < profile.length; i++) {
            const seg = profile[i]
            const startNode = nodePoints[i]
            const endNode = nodePoints[i + 1]

            let cRadius = seg.radius
            if (seg.type === 'arc' && seg.radius !== undefined) {
                const { compensatedRadius } = calculateArcOffset(seg.radius, seg.isConvex || false, this.noseR)
                cRadius = compensatedRadius
            }

            const compSeg: CompensatedSegment = {
                ...seg,
                compensatedStartX: round3(startNode.x), compensatedStartZ: round3(startNode.z),
                compensatedEndX: round3(endNode.x), compensatedEndZ: round3(endNode.z),
                compensatedRadius: cRadius !== undefined ? round3(cRadius) : undefined,
                compensatedCenterX: seg.centerX, compensatedCenterZ: seg.centerZ
            }
            if (seg.type === 'arc' && seg.centerX !== undefined && seg.centerZ !== undefined) {
                const ik = calculateCompensatedIK(startNode.x, startNode.z, seg.centerX, seg.centerZ)
                compSeg.compensatedI = ik.i; compSeg.compensatedK = ik.k
            }
            result.push(compSeg)
        }
        return result
    }

    private getNormalAt(seg: Segment, pos: 'start' | 'end'): { nx: number; nz: number } {
        let nx = 0, nz = 0
        if (seg.type === 'arc' && seg.centerX !== undefined && seg.centerZ !== undefined) {
            const px = (pos === 'start' ? seg.startX : seg.endX) / 2
            const pz = (pos === 'start' ? seg.startZ : seg.endZ)
            const vx = px - seg.centerX / 2, vz = pz - seg.centerZ
            const isConvex = seg.isConvex !== undefined ? seg.isConvex : true
            // 凸(G02)なら中心から外へ、凹(G03)なら外から中心へ
            if (isConvex) { nx = vx; nz = vz } else { nx = -vx; nz = -vz }
        } else {
            const dx = (seg.endX - seg.startX) / 2, dz = seg.endZ - seg.startZ
            nx = -dz; nz = dx
        }
        const len = Math.sqrt(nx * nx + nz * nz)
        if (len === 0) return { nx: 0, nz: 0 }
        const sign = this.isExternal ? 1 : -1
        return { nx: nx / len * sign, nz: nz / len * sign }
    }
}
