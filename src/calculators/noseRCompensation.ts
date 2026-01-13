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
 * 工具中心点 (P) からプログラム上の仮想刃先点 (O) への変換
 * O = P - V_offset * dirX
 * 
 * @param px 工具中心X (直径)
 * @param pz 工具中心Z
 * @param noseR ノーズR
 * @param toolType チップ番号 (1-8)
 * @param dirX 座標系係数 (Rear: 1, Front: -1)
 */
export function pToO(px: number, pz: number, noseR: number, toolType: number, dirX: number = 1): { ox: number; oz: number } {
    let dx = 0, dz = 0
    // Tip番号ごとのノーズR中心Pから仮想刃先点Oへの相対ベクトル [半径値]
    // 規格: P = O + V_offset * dirX
    switch (toolType) {
        case 1: dx = -noseR; dz = noseR; break;   // (X-, Z+)
        case 2: dx = -noseR; dz = -noseR; break;  // (X-, Z-)
        case 3: dx = noseR; dz = noseR; break;   // (X+, Z+)
        case 4: dx = noseR; dz = -noseR; break;  // (X+, Z-)
        case 5: dx = 0; dz = noseR; break;   // (Z+)
        case 6: dx = -noseR; dz = 0; break;       // (X-)
        case 7: dx = 0; dz = -noseR; break;  // (Z-)
        case 8: dx = noseR; dz = 0; break;       // (X+)
        case 9: dx = 0; dz = 0; break;
        default: dx = noseR; dz = noseR;
    }
    // プログラム点 O = P - V_offset * dirX
    // X座標は直径値(px, ox)を扱うため、2倍する
    const ox = px - (dx * 2) * dirX
    const oz = pz - dz
    return { ox: round3(ox), oz: round3(oz) }
}

export function calculateArcOffset(radius: number, isConvex: boolean, noseR: number): { compensatedRadius: number } {
    const rc = isConvex ? (radius + noseR) : (radius - noseR)
    return { compensatedRadius: round3(Math.max(1e-6, rc)) }
}

export function calculateCompensatedIK(startX: number, startZ: number, centerX: number, centerZ: number): { i: number; k: number } {
    return { i: round3((centerX - startX) / 2), k: round3(centerZ - startZ) }
}

export class CenterTrackCalculator {
    private noseR: number;
    private toolType: number;
    private dirX: number;     // 刃物台係数 (Rear: 1, Front: -1)
    private sideSign: number; // 内外径係数 (Ext: 1, Int: -1)

    constructor(noseR: number, isExternal: boolean = true, toolType: number = 3, toolPost: 'front' | 'rear' = 'rear') {
        this.noseR = noseR;
        this.toolType = toolType;
        this.dirX = toolPost === 'rear' ? 1 : -1;
        this.sideSign = isExternal ? 1 : -1;
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
                const op = pToO((profile[0].startX / 2 + n.nx * this.noseR) * 2, profile[0].startZ + n.nz * this.noseR, this.noseR, this.toolType, this.dirX)
                px = op.ox; pz = op.oz
            } else if (i === profile.length) {
                // 終端
                const prev = profile[i - 1]
                const n = this.getNormalAt(prev, 'end')
                const op = pToO((prev.endX / 2 + n.nx * this.noseR) * 2, prev.endZ + n.nz * this.noseR, this.noseR, this.toolType, this.dirX)
                px = op.ox; pz = op.oz
            } else {
                // セグメント間の遷移点
                const prev = profile[i - 1]
                const next = profile[i]

                const n1 = this.getNormalAt(prev, 'end')
                const n2 = this.getNormalAt(next, 'start')

                const dot = Math.max(-1.0, Math.min(1.0, n1.nx * n2.nx + n1.nz * n2.nz))
                const cosHalfSq = (1.0 + dot) / 2.0
                const cosHalf = Math.sqrt(Math.max(0.001, cosHalfSq)) // 極小値をガード

                // 投影距離のガード：鋭角（約140度以上の旋回）で補正が発散するのを物理的限界で止める
                // 標準的なR0.4であれば 最大1.6mm 程度のシフトに制限
                const dist = Math.min(this.noseR * 4.0, this.noseR / cosHalf)

                let bx = n1.nx + n2.nx, bz = n1.nz + n2.nz
                const blen = Math.sqrt(bx * bx + bz * bz)

                // 平行または逆走の場合 (blenが極小) は、前のセグメントの法線を優先
                if (blen < 1e-4) {
                    bx = n1.nx
                    bz = n1.nz
                } else {
                    bx /= blen
                    bz /= blen
                }

                // 中心点 P の算出 (半径ベース計算して最後に pToO)
                const op = pToO((prev.endX / 2 + bx * dist) * 2, prev.endZ + bz * dist, this.noseR, this.toolType, this.dirX)
                px = op.ox; pz = op.oz
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
            // 進行方向の左側への法線ベクトル
            nx = -dz; nz = dx
        }
        const len = Math.sqrt(nx * nx + nz * nz)
        if (len < 1e-9) return { nx: 0, nz: 0 }

        // 物理係数による方向決定
        // X方向 (nx): 刃物台位置 (dirX) と 内外径 (sideSign) の両方の影響を受ける
        // Z方向 (nz): 内外径 (sideSign) の影響のみ受ける（Z軸の極性は刃物台で反転しないため）
        return {
            nx: (nx / len) * (this.sideSign * this.dirX),
            nz: (nz / len) * (this.sideSign)
        }
    }
}
