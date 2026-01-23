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
            // 進行方向に対して垂直なベクトル（右手系で左側）
            // ただし法線は「ワークから離れる方向」を向く必要がある
            // 外径加工(-Z方向進行)で通常テーパー(X減少)なら左が外側
            // 逆テーパー(X増加)なら右が外側
            nx = -dz; nz = dx

            // 法線のX成分が負（素材方向）の場合、反転して外側を向かせる
            // ※ここでは「生の」法線を計算し、後のsideSign/dirXで物理調整する前提
            // 外径加工で-Z進行時、法線Xが負なら反転が必要
            // → 逆テーパー(dx>0)かつ-Z進行(dz<0)で nx=-dz>0 となり正しい
            // → 通常テーパー(dx<0)かつ-Z進行(dz<0)で nx=-dz>0 となり正しい
            // 問題なし。ただしZ方向の符号に問題がある可能性
        }
        const len = Math.sqrt(nx * nx + nz * nz)
        if (len < 1e-9) return { nx: 0, nz: 0 }

        // 正規化された生の法線
        const rawNx = nx / len
        const rawNz = nz / len

        // 物理係数による方向決定
        // sideSign: 外径=1, 内径=-1 (ワークから離れる方向)
        // dirX: 後刃物台=1, 前刃物台=-1 (X軸の見た目の極性)
        //
        // 法線は常に「ワークから離れる」方向を向く
        // 外径加工: nx > 0 がワークから離れる方向
        // 内径加工: nx < 0 がワークから離れる方向
        return {
            nx: rawNx * (this.sideSign * this.dirX),
            nz: rawNz * (this.sideSign)
        }
    }
}
