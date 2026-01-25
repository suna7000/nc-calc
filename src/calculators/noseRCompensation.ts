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

/**
 * プログラム点 O = P - V_offset
 */
export function pToO(px: number, pz: number, noseR: number, toolType: number): { ox: number; oz: number } {
    let dx = 0, dz = 0
    switch (toolType) {
        case 1: dx = -noseR; dz = noseR; break;
        case 2: dx = -noseR; dz = -noseR; break;
        case 3: dx = noseR; dz = noseR; break;
        case 4: dx = noseR; dz = -noseR; break;
        case 5: dx = 0; dz = noseR; break;
        case 6: dx = -noseR; dz = 0; break;
        case 7: dx = 0; dz = -noseR; break;
        case 8: dx = noseR; dz = 0; break;
        case 9: dx = 0; dz = 0; break;
        default: dx = noseR; dz = noseR;
    }
    const ox = px - (dx * 2)
    const oz = pz - dz
    return { ox: round3(ox), oz: round3(oz) }
}

export class CenterTrackCalculator {
    private noseR: number;
    private toolType: number;
    private sideSign: number;

    constructor(noseR: number, isExternal: boolean = true, toolType: number = 3) {
        this.noseR = noseR;
        this.toolType = toolType;
        this.sideSign = isExternal ? 1 : -1;
    }

    calculate(profile: Segment[]): CompensatedSegment[] {
        if (profile.length === 0) return []

        const nodes: { x: number, z: number }[] = []
        for (let i = 0; i <= profile.length; i++) {
            let n: { nx: number, nz: number }
            if (i === 0) {
                n = this.getNormalAt(profile[0], 'start')
            } else if (i === profile.length) {
                n = this.getNormalAt(profile[i - 1], 'end')
            } else {
                const n1 = this.getNormalAt(profile[i - 1], 'end')
                const n2 = this.getNormalAt(profile[i], 'start')
                // 二等分線方向を求める
                const bisec = this.calculateBisector(n1, n2)
                n = { nx: bisec.bx * (bisec.dist / this.noseR), nz: bisec.bz * (bisec.dist / this.noseR) }
            }

            // 物理オフセット適用: P = O' + n * R
            const px = (i < profile.length ? profile[i].startX : profile[i - 1].endX) / 2 + n.nx * this.noseR
            const pz = (i < profile.length ? profile[i].startZ : profile[i - 1].endZ) + n.nz * this.noseR
            nodes.push({ x: px, z: pz })
        }

        const result: CompensatedSegment[] = []
        for (let i = 0; i < profile.length; i++) {
            const seg = profile[i]
            const oStart = pToO(nodes[i].x * 2, nodes[i].z, this.noseR, this.toolType)
            const oEnd = pToO(nodes[i + 1].x * 2, nodes[i + 1].z, this.noseR, this.toolType)

            let cR = seg.radius
            if (seg.type === 'arc' && seg.radius !== undefined) {
                cR = (seg.isConvex || false) ? (seg.radius + this.noseR) : (seg.radius - this.noseR)
            }

            result.push({
                ...seg,
                compensatedStartX: oStart.ox, compensatedStartZ: oStart.oz,
                compensatedEndX: oEnd.ox, compensatedEndZ: oEnd.oz,
                compensatedRadius: cR !== undefined ? round3(cR) : undefined,
                compensatedI: seg.type === 'arc' && seg.centerX !== undefined ? round3((seg.centerX - oStart.ox) / 2) : undefined,
                compensatedK: seg.type === 'arc' && seg.centerZ !== undefined ? round3(seg.centerZ - oStart.oz) : undefined
            })
        }
        return result
    }

    private calculateBisector(n1: { nx: number, nz: number }, n2: { nx: number, nz: number }): { dist: number, bx: number, bz: number } {
        const dot = Math.max(-1.0, Math.min(1.0, n1.nx * n2.nx + n1.nz * n2.nz))
        const cosHalf = Math.sqrt((1.0 + dot) / 2.0)
        const dist = Math.min(this.noseR * 4.0, this.noseR / Math.max(0.01, cosHalf))
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
        // 常にワークの外（チップ側）に向ける (外径なら X+, 内径なら X-)
        const sign = (rNx * this.sideSign > 0) ? 1 : -1
        return { nx: rNx * sign, nz: (nz / len) * sign }
    }
}
