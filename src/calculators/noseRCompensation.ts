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
 * 物理監査結果: Tip 3 (外径/前) は dz = -noseR
 */
export function pToO(px: number, pz: number, noseR: number, toolType: number): { ox: number; oz: number } {
    let dx = 0, dz = 0
    switch (toolType) {
        case 3: dx = noseR; dz = -noseR; break;   // 外径 / 前
        case 4: dx = noseR; dz = noseR; break;    // 外径 / 奥
        case 2: dx = -noseR; dz = -noseR; break;  // 内径 / 前
        case 1: dx = -noseR; dz = noseR; break;   // 内径 / 奥
        case 8: dx = noseR; dz = 0; break;
        default: dx = noseR; dz = -noseR;
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

        // Spike Guard: 180度反転等での発散防止。通常は noseR / cosHalf
        const dist = this.noseR / Math.max(0.01, cosHalf)

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
        const sign = (rNx * this.sideSign >= 0) ? 1 : -1
        return { nx: rNx * sign, nz: (nz / len) * sign }
    }
}
