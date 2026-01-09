/**
 * 形状全体の計算処理
 * 隅処理（R/C）を考慮した座標計算
 */

import type { Shape, Point, CornerCalculation } from '../models/shape'
import type { MachineSettings } from '../models/settings'
import { defaultMachineSettings } from '../models/settings'
import { calculateSmidManualShifts } from './noseRCompensation'

// 計算結果
export interface ShapeCalculationResult {
    segments: SegmentResult[]
    warnings: string[]
}

export interface SegmentResult {
    index: number
    type: 'line' | 'corner-r' | 'corner-c'
    // 座標（ワーク形状）
    startX: number
    startZ: number
    endX: number
    endZ: number
    // テーパー角度（直線の場合）
    angle?: number
    // 円弧データ（Rの場合）
    i?: number
    k?: number
    // 円弧中心（描画用）
    centerX?: number
    centerZ?: number
    radius?: number
    // G02/G03判定
    gCode?: string
    // 描写用スイープ方向 (0: CCW, 1: CW)
    sweep?: 0 | 1
    // ノーズR補正後の座標（補正有効時のみ）
    compensated?: {
        startX: number
        startZ: number
        endX: number
        endZ: number
        i?: number
        k?: number
        radius?: number
    }
    // Peter Smid氏 & 工場長のネタ帳（HP）の高度幾何情報
    advancedInfo?: {
        manualShiftX?: number   // Peter Smid方式 手計算用Xシフト量 (直径)
        manualShiftZ?: number   // Peter Smid方式 手計算用Zシフト量
        hpShiftX?: number       // 工場長のネタ帳方式 手計算用Xシフト量 (直径)
        hpShiftZ?: number       // 工場長のネタ帳方式 手計算用Zシフト量
        distToVertex?: number   // 仮想交点（カド）からの戻り量 (L)
        tangentX?: number       // 理論接点X (直径)
        tangentZ?: number       // 理論接点Z
        originalRadius?: number // 補正前のR値
    }
}

/**
 * 形状を計算
 */
export function calculateShape(
    shape: Shape,
    machineSettings: MachineSettings = defaultMachineSettings
): ShapeCalculationResult {
    const results: SegmentResult[] = []

    if (shape.points.length < 2) {
        return { segments: [], warnings: [] }
    }

    const warnings: string[] = []
    let currentX = shape.points[0].x
    let currentZ = shape.points[0].z
    let i = 0

    // ノーズR補正値を取得（補正が有効な場合のみ）
    let noseR = 0
    if (machineSettings.noseRCompensation.enabled) {
        const activeTool = machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)
        if (activeTool && activeTool.noseRadius > 0) {
            noseR = activeTool.noseRadius
        }
    }

    while (i < shape.points.length - 1) {
        const nextPoint = shape.points[i + 1]

        if (nextPoint.corner.type !== 'none' && i + 2 < shape.points.length) {
            const afterNextPoint = shape.points[i + 2]
            const p2HasR = nextPoint.corner.type === 'sumi-r' || nextPoint.corner.type === 'kaku-r'
            const p3HasR = afterNextPoint.corner.type === 'sumi-r' || afterNextPoint.corner.type === 'kaku-r'

            if (p2HasR && p3HasR && i + 3 < shape.points.length) {
                const p4 = shape.points[i + 3]
                const currentPointObj = { x: currentX, z: currentZ, corner: { type: 'none' as const, size: 0 }, id: 'temp' }
                const adjacentResult = calculateAdjacentCorners(currentPointObj as Point, nextPoint, afterNextPoint, p4)

                if (adjacentResult) {
                    results.push({
                        index: results.length + 1,
                        type: 'line',
                        startX: currentX,
                        startZ: currentZ,
                        endX: adjacentResult.arc1.entryX,
                        endZ: adjacentResult.arc1.entryZ,
                        angle: calculateAngle(currentX, currentZ, adjacentResult.arc1.entryX, adjacentResult.arc1.entryZ)
                    })
                    results.push({
                        index: results.length + 1,
                        type: 'corner-r',
                        startX: adjacentResult.arc1.entryX,
                        startZ: adjacentResult.arc1.entryZ,
                        endX: adjacentResult.arc1.exitX,
                        endZ: adjacentResult.arc1.exitZ,
                        i: adjacentResult.arc1.i,
                        k: adjacentResult.arc1.k,
                        centerX: adjacentResult.arc1.centerX,
                        centerZ: adjacentResult.arc1.centerZ,
                        radius: adjacentResult.arc1.radius,
                        gCode: determineGCode(adjacentResult.arc1.isLeftTurn, nextPoint.corner.type as 'kaku-r' | 'sumi-r', machineSettings),
                        sweep: adjacentResult.arc1.isLeftTurn ? 0 : 1
                    })
                    results.push({
                        index: results.length + 1,
                        type: 'corner-r',
                        startX: adjacentResult.arc2.entryX,
                        startZ: adjacentResult.arc2.entryZ,
                        endX: adjacentResult.arc2.exitX,
                        endZ: adjacentResult.arc2.exitZ,
                        i: adjacentResult.arc2.i,
                        k: adjacentResult.arc2.k,
                        centerX: adjacentResult.arc2.centerX,
                        centerZ: adjacentResult.arc2.centerZ,
                        radius: adjacentResult.arc2.radius,
                        gCode: determineGCode(adjacentResult.arc2.isLeftTurn, afterNextPoint.corner.type as 'kaku-r' | 'sumi-r', machineSettings),
                        sweep: adjacentResult.arc2.isLeftTurn ? 0 : 1
                    })
                    currentX = adjacentResult.arc2.exitX
                    currentZ = adjacentResult.arc2.exitZ
                    i += 2
                    continue
                }
            }

            const currentPointObj = { x: currentX, z: currentZ }
            const cornerCalc = calculateCorner(currentPointObj as Point, nextPoint, afterNextPoint, noseR)

            if (cornerCalc) {
                results.push({
                    index: results.length + 1,
                    type: 'line',
                    startX: currentX,
                    startZ: currentZ,
                    endX: cornerCalc.entryX,
                    endZ: cornerCalc.entryZ,
                    angle: calculateAngle(currentX, currentZ, cornerCalc.entryX, cornerCalc.entryZ)
                })

                const isR = nextPoint.corner.type === 'sumi-r' || nextPoint.corner.type === 'kaku-r'
                if (isR) {
                    const sweep = cornerCalc.isLeftTurn ? 0 : 1
                    if (nextPoint.corner.secondArc && nextPoint.corner.secondArc.size > 0) {
                        const r1Type = nextPoint.corner.type as 'sumi-r' | 'kaku-r'
                        const r2Type = nextPoint.corner.secondArc.type as 'sumi-r' | 'kaku-r'
                        const dualArc = calculateDualArcCorner(currentPointObj as Point, nextPoint, afterNextPoint, nextPoint.corner.size, nextPoint.corner.secondArc.size, r1Type, r2Type)
                        if (dualArc) {
                            const lastLine = results[results.length - 1]
                            if (lastLine) {
                                lastLine.endX = dualArc.arc1.entryX
                                lastLine.endZ = dualArc.arc1.entryZ
                            }
                            results.push({
                                index: results.length + 1,
                                type: 'corner-r',
                                startX: dualArc.arc1.entryX,
                                startZ: dualArc.arc1.entryZ,
                                endX: dualArc.arc1.exitX,
                                endZ: dualArc.arc1.exitZ,
                                i: dualArc.arc1.i,
                                k: dualArc.arc1.k,
                                centerX: dualArc.arc1.centerX,
                                centerZ: dualArc.arc1.centerZ,
                                radius: nextPoint.corner.size,
                                gCode: determineGCode(dualArc.arc1.isLeftTurn, r1Type, machineSettings),
                                sweep: dualArc.arc1.isLeftTurn ? 0 : 1
                            })
                            results.push({
                                index: results.length + 1,
                                type: 'corner-r',
                                startX: dualArc.arc2.entryX,
                                startZ: dualArc.arc2.entryZ,
                                endX: dualArc.arc2.exitX,
                                endZ: dualArc.arc2.exitZ,
                                i: dualArc.arc2.i,
                                k: dualArc.arc2.k,
                                centerX: dualArc.arc2.centerX,
                                centerZ: dualArc.arc2.centerZ,
                                radius: nextPoint.corner.secondArc.size,
                                gCode: determineGCode(dualArc.arc2.isLeftTurn, r2Type, machineSettings),
                                sweep: dualArc.arc2.isLeftTurn ? 0 : 1
                            })
                            currentX = dualArc.arc2.exitX
                            currentZ = dualArc.arc2.exitZ
                        }
                    } else {
                        results.push({
                            index: results.length + 1,
                            type: 'corner-r',
                            startX: cornerCalc.entryX,
                            startZ: cornerCalc.entryZ,
                            endX: cornerCalc.exitX,
                            endZ: cornerCalc.exitZ,
                            i: cornerCalc.i,
                            k: cornerCalc.k,
                            centerX: cornerCalc.centerX,
                            centerZ: cornerCalc.centerZ,
                            radius: cornerCalc.adjustedRadius || nextPoint.corner.size,
                            gCode: determineGCode(!!cornerCalc.isLeftTurn, nextPoint.corner.type as 'kaku-r' | 'sumi-r', machineSettings),
                            sweep: sweep as 0 | 1,
                            advancedInfo: {
                                distToVertex: cornerCalc.distToVertex,
                                originalRadius: cornerCalc.originalRadius
                            }
                        })
                        currentX = cornerCalc.exitX
                        currentZ = cornerCalc.exitZ
                    }
                } else if (nextPoint.corner.type === 'kaku-c') {
                    results.push({
                        index: results.length + 1,
                        type: 'corner-c',
                        startX: cornerCalc.entryX,
                        startZ: cornerCalc.entryZ,
                        endX: cornerCalc.exitX,
                        endZ: cornerCalc.exitZ
                    })
                    currentX = cornerCalc.exitX
                    currentZ = cornerCalc.exitZ
                }
                i += 1
            } else {
                results.push({
                    index: results.length + 1,
                    type: 'line',
                    startX: currentX,
                    startZ: currentZ,
                    endX: nextPoint.x,
                    endZ: nextPoint.z,
                    angle: calculateAngle(currentX, currentZ, nextPoint.x, nextPoint.z)
                })
                currentX = nextPoint.x
                currentZ = nextPoint.z
                i += 1
            }
        } else {
            results.push({
                index: results.length + 1,
                type: 'line',
                startX: currentX,
                startZ: currentZ,
                endX: nextPoint.x,
                endZ: nextPoint.z,
                angle: calculateAngle(currentX, currentZ, nextPoint.x, nextPoint.z)
            })
            currentX = nextPoint.x
            currentZ = nextPoint.z
            i += 1
        }
    }

    // 補正と警告
    const activeTool = machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)
    if (activeTool) {
        if (activeTool.leadAngle !== undefined || activeTool.backAngle !== undefined) {
            checkInterference(results, activeTool, machineSettings, warnings)
        }

        // 直線セグメントにノーズR補正（fx, fz）を適用
        if (noseR > 0) {
            const isInternal = activeTool.type === 'internal'
            const method = machineSettings.noseRCompensation.method || 'geometric'

            results.forEach(seg => {
                if (seg.type === 'line' && seg.angle !== undefined) {
                    let fx: number, fz: number

                    if (method === 'smid') {
                        // Peter Smid方式（Chapter 27）
                        const result = calculateSmidManualShifts(seg.angle, noseR)
                        fx = result.deltaX
                        fz = result.deltaZ
                        // 内径加工の場合は反転
                        if (isInternal) fx = -fx
                        if (machineSettings.cuttingDirection === '+z') fz = -fz
                    } else {
                        // 幾何学的アプローチ
                        // テーパーの向きを判定：Xが増加=上り=背刃、Xが減少=下り=前刃
                        // 外径加工・-Z方向の場合、セグメントのendX > startXなら上りテーパー
                        const isRising = seg.endX > seg.startX
                        const result = calculateLineNoseROffset(
                            seg.angle,
                            noseR,
                            isRising,
                            isInternal,
                            machineSettings.cuttingDirection
                        )
                        fx = result.fx
                        fz = result.fz
                    }

                    // 補正量をセグメントに保存
                    seg.advancedInfo = {
                        ...seg.advancedInfo,
                        manualShiftX: fx,  // X補正量（直径）
                        manualShiftZ: fz   // Z補正量
                    }
                    // 補正後座標を計算
                    // X: 補正量を加算（ノーズRの分だけ外側へ）
                    // Z: 補正量を減算（-Z方向の加工で仮想刃先より実際の接点が-Z側にあるため）
                    seg.compensated = {
                        startX: round3(seg.startX + fx),
                        startZ: round3(seg.startZ - fz),
                        endX: round3(seg.endX + fx),
                        endZ: round3(seg.endZ - fz)
                    }
                }
            })
        }
    }

    return { segments: results, warnings }
}

/**
 * 干渉チェック
 */
function checkInterference(results: SegmentResult[], tool: any, settings: MachineSettings, warnings: string[]) {
    const isZMinus = settings.cuttingDirection === '-z'
    const isRightHand = tool.hand === 'right'
    results.forEach(seg => {
        if (seg.type === 'line' && seg.angle !== undefined) {
            if (isZMinus && isRightHand) {
                if (tool.leadAngle && seg.angle > tool.leadAngle) warnings.push(`警告 ${seg.index}: 角度 ${seg.angle}° が主切刃角を超えています。`)
                if (tool.backAngle && seg.angle < -tool.backAngle) warnings.push(`警告 ${seg.index}: 角度 ${seg.angle}° が副切刃角を下回っています。`)
            }
        }
    })
}

/**
 * ノーズR補正を適用（厳密な交点算出モデル：Intersection Method）
 * 
 * Peter Smid "CNC Programming Handbook" に準拠。
 * 1. 各セグメントのオフセット形状（直線・円弧）を生成。
 * 2. 隣接するオフセット形状同士の交点（工具中心点）を算出。
 * 3. 工具中心点から仮想刃先点へのベクトルを逆算し、プログラム座標を特定。
 */
export function applyNoseRCompensationLegacy(segments: SegmentResult[], settings: MachineSettings): void {
    const tool = settings.toolLibrary.find(t => t.id === settings.activeToolId)
    if (!tool || tool.noseRadius <= 0) return

    const R = tool.noseRadius
    const isInternal = tool.type === 'internal'
    const xSign = isInternal ? -1 : 1
    const zSign = settings.cuttingDirection === '+z' ? -1 : 1

    /**
     * 仮想刃先点から工具中心へのベクトル V_pc [半径値]
     * Fanuc/JIS 標準定義：プログラム点は仮想刃先（チップのX, Z接線の交点）
     */
    let v_pcX = 0, v_pcZ = 0
    switch (tool.toolTipNumber) {
        case 1: v_pcX = -R; v_pcZ = R; break
        case 2: v_pcX = -R; v_pcZ = 0; break
        case 3: v_pcX = -R; v_pcZ = -R; break
        case 4: v_pcX = 0; v_pcZ = -R; break
        case 5: v_pcX = R; v_pcZ = -R; break
        case 6: v_pcX = R; v_pcZ = 0; break
        case 7: v_pcX = R; v_pcZ = R; break
        case 8: v_pcX = 0; v_pcZ = R; break
        default: v_pcX = 0; v_pcZ = 0; break
    }
    // 座標系符号の適用
    v_pcX *= xSign
    v_pcZ *= zSign

    // 1. 各セグメントのオフセット情報を準備
    interface LineOffset { type: 'line', a: number, b: number, c: number, nx: number, nz: number }
    interface ArcOffset { type: 'arc', cx: number, cz: number, r: number, isConcave: boolean }
    type OffsetInfo = LineOffset | ArcOffset

    const offsets: (OffsetInfo | null)[] = segments.map(seg => {
        if (seg.type === 'line') {
            const dx = (seg.endX - seg.startX) / 2
            const dz = seg.endZ - seg.startZ
            const len = Math.sqrt(dx * dx + dz * dz)
            if (len === 0) return null
            const nx = -dz / len * xSign
            const nz = dx / len * xSign
            const a = -dz, b = dx
            const c = -(a * (seg.startX / 2 + nx * R) + b * (seg.startZ + nz * R))
            return { type: 'line', a, b, c, nx, nz }
        } else {
            const isConcave = isInternal ? seg.gCode === 'G03' : seg.gCode === 'G02'
            const progR = isConcave ? Math.max(0.001, (seg.radius || 0) - R) : (seg.radius || 0) + R
            return { type: 'arc', cx: (seg.centerX || 0) / 2, cz: seg.centerZ || 0, r: progR, isConcave }
        }
    })

    // 2. 交点（工具中心軌跡の節点）を算出
    const centers: { x: number, z: number }[] = []

    for (let i = 0; i <= segments.length; i++) {
        const prev = offsets[i - 1]
        const curr = offsets[i]

        if (!prev && curr) {
            // 開始点
            if (curr.type === 'line') {
                centers.push({ x: segments[i].startX / 2 + curr.nx * R, z: segments[i].startZ + curr.nz * R })
            } else {
                const vecX = segments[i].startX / 2 - curr.cx
                const vecZ = segments[i].startZ - curr.cz
                const len = Math.sqrt(vecX * vecX + vecZ * vecZ)
                centers.push({ x: curr.cx + (vecX / len) * curr.r, z: curr.cz + (vecZ / len) * curr.r })
            }
        } else if (prev && curr) {
            // 中間点
            let intersect: { x: number, z: number } | null = null
            if (prev.type === 'line' && curr.type === 'line') {
                intersect = intersectLines(prev, curr)
            } else if (prev.type === 'line' && curr.type === 'arc') {
                intersect = intersectLineArc(prev, curr, segments[i].startX / 2, segments[i].startZ)
            } else if (prev.type === 'arc' && curr.type === 'line') {
                intersect = intersectLineArc(curr, prev, segments[i].startX / 2, segments[i].startZ)
            } else if (prev.type === 'arc' && curr.type === 'arc') {
                intersect = intersectArcs(prev, curr, segments[i].startX / 2, segments[i].startZ)
            }
            centers.push(intersect || { x: segments[i].startX / 2, z: segments[i].startZ })
        } else if (prev && !curr) {
            // 終了点
            if (prev.type === 'line') {
                centers.push({ x: segments[i - 1].endX / 2 + prev.nx * R, z: segments[i - 1].endZ + prev.nz * R })
            } else {
                const vecX = segments[i - 1].endX / 2 - prev.cx
                const vecZ = segments[i - 1].endZ - prev.cz
                const len = Math.sqrt(vecX * vecX + vecZ * vecZ)
                centers.push({ x: prev.cx + (vecX / len) * prev.r, z: prev.cz + (vecZ / len) * prev.r })
            }
        }
    }

    // 3. プログラム座標への逆変換（Center -> Program）
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const cS = centers[i]
        const cE = centers[i + 1]

        seg.compensated = {
            startX: round3((cS.x - v_pcX) * 2),
            startZ: round3(cS.z - v_pcZ),
            endX: round3((cE.x - v_pcX) * 2),
            endZ: round3(cE.z - v_pcZ)
        }

        if (seg.type === 'corner-r') {
            const off = offsets[i] as any
            seg.compensated.radius = round3(off.r)
            seg.compensated.i = round3(off.cx - (cS.x - v_pcX))
            seg.compensated.k = round3(off.cz - (cS.z - v_pcZ))

            // 接点情報などを追加 (Smid Ch.25)
            seg.advancedInfo = {
                ...seg.advancedInfo,
                tangentX: round3(seg.startX),
                tangentZ: round3(seg.startZ)
            }
        }

        // テーパー・R接続時の情報を付与
        if (seg.type === 'line' && seg.angle !== undefined && seg.angle !== 0 && seg.angle !== 90) {
            const rad = (seg.angle) * (Math.PI / 180)
            const compAngle = (Math.PI / 2 - rad) / 2

            // Smid方式
            const dZ = R * Math.tan(compAngle)
            const dX = 2 * R * (1 - Math.tan(compAngle) * Math.tan(rad))

            // HP方式 (θ/2 を使用)
            const thetaRad = rad // 片角
            const hpZ = R * (1 - Math.tan(thetaRad / 2))
            const hpX = 2 * R * (1 - Math.tan(thetaRad / 2))

            seg.advancedInfo = {
                ...seg.advancedInfo,
                manualShiftX: round3(dX),
                manualShiftZ: round3(dZ),
                hpShiftX: round3(hpX),
                hpShiftZ: round3(hpZ)
            }
        }
    }
}

/**
 * 二直線の交点
 */
function intersectLines(l1: any, l2: any) {
    const det = l1.a * l2.b - l1.b * l2.a
    if (Math.abs(det) < 1e-9) return null
    return {
        x: (l1.b * l2.c - l2.b * l1.c) / det,
        z: (l2.a * l1.c - l1.a * l2.c) / det
    }
}

/**
 * 直線と円弧の交点（nearPointに近い方を選択）
 */
function intersectLineArc(l: any, a: any, nx: number, nz: number) {
    // a(x-cx) + b(z-cz) + c' = 0
    const c_prime = l.c + l.a * a.cx + l.b * a.cz
    const d2 = l.a * l.a + l.b * l.b
    const r2 = a.r * a.r
    const h = -c_prime / d2
    const disc = r2 - (c_prime * c_prime / d2)
    if (disc < 0) return null
    const t = Math.sqrt(disc / d2)
    const sol1 = { x: a.cx + l.a * h + l.b * t, z: a.cz + l.b * h - l.a * t }
    const sol2 = { x: a.cx + l.a * h - l.b * t, z: a.cz + l.b * h + l.a * t }
    const d1 = Math.pow(sol1.x - nx, 2) + Math.pow(sol1.z - nz, 2)
    const d2_dist = Math.pow(sol2.x - nx, 2) + Math.pow(sol2.z - nz, 2)
    return d1 < d2_dist ? sol1 : sol2
}

/**
 * 二円の交点
 */
function intersectArcs(a1: any, a2: any, nx: number, nz: number) {
    const dx = a2.cx - a1.cx, dz = a2.cz - a1.cz
    const d2 = dx * dx + dz * dz, d = Math.sqrt(d2)
    if (d > a1.r + a2.r || d < Math.abs(a1.r - a2.r)) return null
    const a = (a1.r * a1.r - a2.r * a2.r + d2) / (2 * d)
    const h = Math.sqrt(Math.max(0, a1.r * a1.r - a * a))
    const midX = a1.cx + a * dx / d, midZ = a1.cz + a * dz / d
    const sol1 = { x: midX + h * dz / d, z: midZ - h * dx / d }
    const sol2 = { x: midX - h * dz / d, z: midZ + h * dx / d }
    const d1 = Math.pow(sol1.x - nx, 2) + Math.pow(sol1.z - nz, 2)
    const d2_dist = Math.pow(sol2.x - nx, 2) + Math.pow(sol2.z - nz, 2)
    return d1 < d2_dist ? sol1 : sol2
}

/**
 * 各種計算ヘルパー
 */
function round3(v: number) { return Math.round(v * 1000) / 1000 }

function calculateAngle(x1: number, z1: number, x2: number, z2: number): number {
    const dx = Math.abs(x2 - x1) / 2, dz = Math.abs(z2 - z1)
    if (dz === 0) return 90
    return round3(Math.atan(dx / dz) * (180 / Math.PI))
}

/**
 * 直線セグメントのノーズR補正計算（教科書の計算式）
 * 
 * テーパーの向きにより刃先使い分け:
 *   - 下りテーパー（Xが小さくなる）→ 前刃 → 1 - tan()
 *   - 上りテーパー（Xが大きくなる）→ 背刃 → 1 + tan()
 * 
 * 計算式:
 *   前刃: fx = 2R(1 - tan(φ/2)), fz = R(1 - tan(θ/2))
 *   背刃: fx = 2R(1 + tan(φ/2)), fz = R(1 + tan(θ/2))
 * 
 * @param angleDeg テーパー角度（度）。0°=Z軸に平行、90°=X軸に平行
 * @param noseR ノーズR
 * @param isRising 上りテーパー（背刃使用）かどうか
 * @param isInternal 内径加工かどうか
 * @param cuttingDir 切削方向
 * @returns {fx, fz} 補正量（fx:直径値、fz:単位値）
 */
function calculateLineNoseROffset(
    angleDeg: number,
    noseR: number,
    isRising: boolean = false,
    isInternal: boolean = false,
    cuttingDir: '+z' | '-z' = '-z'
): { fx: number, fz: number } {
    if (noseR <= 0 || angleDeg === undefined) {
        return { fx: 0, fz: 0 }
    }

    const R = noseR
    const theta = angleDeg * (Math.PI / 180)  // テーパー角度（ラジアン）
    const phi = (Math.PI / 2) - theta         // φ = 90° - θ

    let fx: number, fz: number

    if (isRising) {
        // 背刃: 1 + tan()
        fx = 2 * R * (1 + Math.tan(phi / 2))
        fz = R * (1 + Math.tan(theta / 2))
    } else {
        // 前刃: 1 - tan()
        fx = 2 * R * (1 - Math.tan(phi / 2))
        fz = R * (1 - Math.tan(theta / 2))
    }

    // θ=90°近傍でのtan発散を防ぐ
    if (angleDeg >= 89.9) {
        fx = isRising ? 2 * R : 2 * R  // θ=90° → 端面加工
        fz = 0
    }
    if (angleDeg <= 0.1) {
        fx = 0  // θ=0° → Z軸に平行
        fz = R  // Z補正はR
    }

    // 内径加工の場合はX方向が反転
    if (isInternal) {
        fx = -fx
    }

    // +Z方向切削の場合はZ方向が反転
    if (cuttingDir === '+z') {
        fz = -fz
    }

    return { fx: round3(fx), fz: round3(fz) }
}

/**
 * G02/G03判定
 * 
 * NC旋盤の基本ルール（前刃物台、外径、-Z方向切削）:
 * - 工具が進行方向から見て「左に曲がる」円弧 → G02（時計回り）
 * - 工具が進行方向から見て「右に曲がる」円弧 → G03（反時計回り）
 * 
 * isLeftTurn: 外積 (u1 × u2) > 0 なら「左に曲がる」
 */
function determineGCode(isLeftTurn: boolean, _type: 'kaku-r' | 'sumi-r', settings: MachineSettings): string {
    // 基本判定: 前刃物台・外径・-Z方向で isLeftTurn → G02
    let isG02 = isLeftTurn

    // 後刃物台の場合は反転
    if (settings.toolPost === 'rear') {
        isG02 = !isG02
    }

    // 切削方向が+Zの場合も反転
    if (settings.cuttingDirection === '+z') {
        isG02 = !isG02
    }

    return isG02 ? 'G02' : 'G03'
}

/**
 * コーナー計算（ノーズR補正対応）
 * @param noseR ノーズR補正値（0の場合は補正なし）
 * @returns 補正後の接点座標、補正後Rなど
 */
function calculateCorner(p1: Point, p2: Point, p3: Point, noseR: number = 0): CornerCalculation | null {
    const originalSize = p2.corner.size
    if (originalSize <= 0) return null

    // ノーズR補正を適用
    // 角R（凸角）: 補正後R = 元R + ノーズR
    // 隅R（凹角）: 補正後R = 元R - ノーズR
    let adjustedSize = originalSize
    if (noseR > 0) {
        if (p2.corner.type === 'kaku-r') {
            adjustedSize = originalSize + noseR
        } else if (p2.corner.type === 'sumi-r') {
            adjustedSize = originalSize - noseR
            if (adjustedSize <= 0) {
                // 補正後Rが0以下になる場合は元のRで計算（警告は別途）
                adjustedSize = originalSize
            }
        }
    }

    const v1x = (p1.x - p2.x) / 2, v1z = p1.z - p2.z
    const v2x = (p3.x - p2.x) / 2, v2z = p3.z - p2.z
    const l1 = Math.sqrt(v1x * v1x + v1z * v1z), l2 = Math.sqrt(v2x * v2x + v2z * v2z)
    if (l1 === 0 || l2 === 0) return null
    const u1x = v1x / l1, u1z = v1z / l1, u2x = v2x / l2, u2z = v2z / l2

    if (p2.corner.type === 'kaku-c') {
        return {
            entryX: round3((p2.x / 2 + u1x * originalSize) * 2), entryZ: round3(p2.z + u1z * originalSize),
            exitX: round3((p2.x / 2 + u2x * originalSize) * 2), exitZ: round3(p2.z + u2z * originalSize)
        }
    }
    const bX = u1x + u2x, bZ = u1z + u2z, bL = Math.sqrt(bX * bX + bZ * bZ)
    if (bL === 0) return null
    const half = Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1z * u2z))) / 2
    const cSign = p2.corner.type === 'kaku-r' ? 1 : -1

    // 補正後Rで接点距離と円弧中心を計算
    const cDist = adjustedSize / Math.sin(half), tDist = adjustedSize / Math.tan(half)
    const cX = p2.x / 2 + (bX / bL) * cDist * cSign, cZ = p2.z + (bZ / bL) * cDist * cSign
    const eX = p2.x / 2 + u1x * tDist, eZ = p2.z + u1z * tDist
    const xX = p2.x / 2 + u2x * tDist, xZ = p2.z + u2z * tDist

    return {
        entryX: round3(eX * 2), entryZ: round3(eZ), exitX: round3(xX * 2), exitZ: round3(xZ),
        i: round3(cX - eX), k: round3(cZ - eZ), centerX: round3(cX * 2), centerZ: round3(cZ),
        isLeftTurn: (u1x * u2z - u1z * u2x) > 0,
        distToVertex: round3(tDist),
        // 補正後R値を追加
        adjustedRadius: adjustedSize,
        originalRadius: originalSize
    }
}

function calculateDualArcCorner(p1: Point, p2: Point, p3: Point, r1: number, r2: number, t1: any, t2: any): any {
    const v1x = (p1.x - p2.x) / 2, v1z = p1.z - p2.z, v2x = (p3.x - p2.x) / 2, v2z = p3.z - p2.z
    const l1 = Math.sqrt(v1x * v1x + v1z * v1z), l2 = Math.sqrt(v2x * v2x + v2z * v2z)
    if (l1 === 0 || l2 === 0) return null
    const u1x = v1x / l1, u1z = v1z / l1, u2x = v2x / l2, u2z = v2z / l2
    const turn = Math.PI - Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1z * u2z)))
    const isL = (u1x * u2z - u1z * u2x) > 0
    let a = 0, L = 0
    const k = r1 / r2, tau = Math.tan(turn / 2)
    if (t1 === t2) {
        const A = k * tau, B = 1 + k, C = -tau
        const T = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A)
        a = 2 * Math.atan(T); L = r1 * Math.tan(a / 2)
    } else {
        a = turn * 1.5; L = r1 * Math.tan(a / 2)
    }
    const sw1 = isL ? 0 : 1, sw2 = (t1 === t2) ? sw1 : (sw1 === 0 ? 1 : 0)
    const enX = p2.x / 2 + u1x * L, enZ = p2.z + u1z * L
    const exX = p2.x / 2 + u2x * L, exZ = p2.z + u2z * L
    const ang1 = Math.atan2(u1z + u2z, u1x + u2x) + Math.PI / 2
    const midX = p2.x / 2 + Math.cos(ang1) * L, midZ = p2.z + Math.sin(ang1) * L
    const c1x = enX + (-u1z * (sw1 === 0 ? -1 : 1)) * r1, c1z = enZ + (u1x * (sw1 === 0 ? -1 : 1)) * r1
    const c2x = exX + (-u2z * (sw2 === 0 ? 1 : -1)) * r2, c2z = exZ + (u2x * (sw2 === 0 ? 1 : -1)) * r2
    return {
        arc1: { entryX: round3(enX * 2), entryZ: round3(enZ), exitX: round3(midX * 2), exitZ: round3(midZ), centerX: round3(c1x * 2), centerZ: round3(c1z), i: round3(c1x - enX), k: round3(c1z - enZ), isLeftTurn: sw1 === 0 },
        arc2: { entryX: round3(midX * 2), entryZ: round3(midZ), exitX: round3(exX * 2), exitZ: round3(exZ), centerX: round3(c2x * 2), centerZ: round3(c2z), i: round3(c2x - midX), k: round3(c2z - midZ), isLeftTurn: sw2 === 0 }
    }
}

function calculateAdjacentCorners(p1: Point, p2: Point, p3: Point, p4: Point): any {
    const R1 = p2.corner.size, R2 = p3.corner.size
    if (R1 <= 0 || R2 <= 0) return null
    const v_inX = (p2.x - p1.x) / 2, v_inZ = p2.z - p1.z
    const v_stX = (p3.x - p2.x) / 2, v_stZ = p3.z - p2.z
    const v_outX = (p4.x - p3.x) / 2, v_outZ = p4.z - p3.z
    const lIn = Math.sqrt(v_inX * v_inX + v_inZ * v_inZ), lSt = Math.sqrt(v_stX * v_stX + v_stZ * v_stZ), lOut = Math.sqrt(v_outX * v_outX + v_outZ * v_outZ)
    if (lIn === 0 || lOut === 0) return null
    const uInX = v_inX / lIn, uInZ = v_inZ / lIn, uStX = lSt > 0 ? v_stX / lSt : 0, uStZ = lSt > 0 ? v_stZ / lSt : 0, uOutX = v_outX / lOut, uOutZ = v_outZ / lOut
    const oa = R1 - lSt, ag_sq = R1 * R1 - oa * oa
    if (ag_sq < 0) return null
    const oe = R1 + R2, ofV = R1 - lSt + R2, ef_sq = oe * oe - ofV * ofV
    if (ef_sq < 0) return null
    const th = Math.atan2(ofV, Math.sqrt(ef_sq)), sTh = Math.sin(th), cTh = Math.cos(th)
    const oX = p2.x / 2 + uStX * R1, oZ = p2.z + uStZ * R1
    const aX = p2.x / 2 - uInX * Math.sqrt(ag_sq), aZ = p2.z - uInZ * Math.sqrt(ag_sq)
    const bX = oX - uStX * R1 * sTh, bZ = aZ + uInZ * R1 * cTh
    const eX = bX - uStX * R2, eZ = bZ, cX = p3.x / 2, cZ = aZ + uInZ * Math.sqrt(ef_sq)
    return {
        arc1: { entryX: round3(aX * 2), entryZ: round3(aZ), exitX: round3(bX * 2), exitZ: round3(bZ), centerX: round3(oX * 2), centerZ: round3(oZ), i: round3(oX - aX), k: round3(oZ - aZ), radius: R1, isLeftTurn: (uInX * uStZ - uInZ * uStX) > 0 },
        arc2: { entryX: round3(bX * 2), entryZ: round3(bZ), exitX: round3(cX * 2), exitZ: round3(cZ), centerX: round3(eX * 2), centerZ: round3(eZ), i: round3(eX - bX), k: round3(eZ - bZ), radius: R2, isLeftTurn: (uStX * uOutZ - uStZ * uOutX) > 0 }
    }
}

export function formatResults(result: ShapeCalculationResult): string[] {
    return result.segments.map(seg => {
        let line = `${seg.index}. `
        if (seg.type === 'line') {
            line += `直線: X${seg.startX} Z${seg.startZ} → X${seg.endX} Z${seg.endZ}`
            if (seg.angle !== undefined && seg.angle > 0) line += ` (${seg.angle}°)`
        } else if (seg.type === 'corner-r') {
            line += `R${seg.radius}: X${seg.endX} Z${seg.endZ}`
            if (seg.i !== undefined) line += ` I${seg.i} K${seg.k} (${seg.gCode})`
        } else if (seg.type === 'corner-c') {
            line += `C面: X${seg.startX} Z${seg.startZ} → X${seg.endX} Z${seg.endZ}`
        }
        return line
    })
}
