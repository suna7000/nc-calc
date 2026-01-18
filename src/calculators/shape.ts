/**
 * 形状全体の計算処理
 * 隅処理（R/C）を考慮した座標計算
 */

import type { Shape, Point, CornerCalculation, GrooveInsert } from '../models/shape'
import type { MachineSettings } from '../models/settings'
import { defaultMachineSettings } from '../models/settings'
import {
    CenterTrackCalculator,
    type Segment,
    type SegmentType
} from './noseRCompensation'

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
    // 凸・凹判定
    isConvex?: boolean
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
 * 溝を点群（セグメント列）に展開する
 * 現在位置(X,Z)から溝を掘って現在位置に戻るセグメントを生成
 */
function expandGrooveToSegments(
    startX: number,     // 開始X（直径値）
    startZ: number,     // 開始Z
    groove: GrooveInsert,
    results: SegmentResult[]
): { endX: number; endZ: number } {
    const depth = groove.depth
    const width = groove.width
    const bottomX = startX - depth * 2  // 底面の直径
    const leftAngle = groove.leftAngle || 90
    const rightAngle = groove.rightAngle || 90

    // 左壁の角度に基づくZシフト
    const leftZShift = leftAngle === 90 ? 0 : depth * Math.tan((90 - leftAngle) * Math.PI / 180)
    // 右壁の角度に基づくZシフト
    const rightZShift = rightAngle === 90 ? 0 : depth * Math.tan((90 - rightAngle) * Math.PI / 180)

    const bottomLeftZ = startZ - leftZShift
    const bottomRightZ = startZ - width + rightZShift

    // 1. 左壁：開始点 → 底左
    results.push({
        index: results.length + 1,
        type: 'line',
        startX: startX,
        startZ: startZ,
        endX: bottomX,
        endZ: bottomLeftZ,
        angle: leftAngle === 90 ? 90 : leftAngle
    })

    // 2. 底面：底左 → 底右
    results.push({
        index: results.length + 1,
        type: 'line',
        startX: bottomX,
        startZ: bottomLeftZ,
        endX: bottomX,
        endZ: bottomRightZ,
        angle: 0  // 底面は水平
    })

    // 3. 右壁：底右 → 出口（同じX位置に戻る）
    results.push({
        index: results.length + 1,
        type: 'line',
        startX: bottomX,
        startZ: bottomRightZ,
        endX: startX,
        endZ: startZ - width,
        angle: rightAngle === 90 ? 90 : rightAngle
    })

    return { endX: startX, endZ: startZ - width }
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
                        isConvex: nextPoint.corner.type === 'kaku-r',
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
                        isConvex: afterNextPoint.corner.type === 'kaku-r',
                        gCode: determineGCode(adjacentResult.arc2.isLeftTurn, afterNextPoint.corner.type as 'kaku-r' | 'sumi-r', machineSettings),
                        sweep: adjacentResult.arc2.isLeftTurn ? 0 : 1
                    })
                    currentX = adjacentResult.arc2.exitX
                    currentZ = adjacentResult.arc2.exitZ
                    i += 2
                    continue
                }
            }

            const currentPointObj: Point = {
                x: currentX,
                z: currentZ,
                corner: { type: 'none', size: 0 },
                id: 'curr'
            }
            const cornerCalc = calculateCorner(currentPointObj, nextPoint, afterNextPoint, noseR)

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
                                isConvex: r1Type === 'kaku-r',
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
                                isConvex: r2Type === 'kaku-r',
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
                            isConvex: nextPoint.corner.type === 'kaku-r',
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

        // この点に溝がある場合、溝を展開
        const currentPoint = shape.points[i]
        if (currentPoint && currentPoint.groove) {
            const grooveEnd = expandGrooveToSegments(currentX, currentZ, currentPoint.groove, results)
            currentX = grooveEnd.endX
            currentZ = grooveEnd.endZ
        }
    }

    // 補正と警告
    const activeTool = machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)
    if (activeTool) {
        if (activeTool.leadAngle !== undefined || activeTool.backAngle !== undefined) {
            checkInterference(results, activeTool, machineSettings, warnings)
        }

        // ノーズR補正（幾何学的エンジン：中心軌跡法）を適用
        if (noseR > 0) {
            const isInternal = activeTool.type === 'internal'

            // 1. SegmentResultを算引用のSegment[]形式に変換
            const profile: Segment[] = results.map(res => {
                const isConvex = res.isConvex
                return {
                    type: res.type === 'corner-r' ? 'arc' : 'line' as SegmentType,
                    startX: res.startX,
                    startZ: res.startZ,
                    endX: res.endX,
                    endZ: res.endZ,
                    centerX: res.centerX,
                    centerZ: res.centerZ,
                    radius: res.radius,
                    isConvex: isConvex
                }
            })

            // 2. CenterTrackCalculatorを実行
            const calculator = new CenterTrackCalculator(
                noseR,
                !isInternal,
                activeTool.toolTipNumber || 3,
                machineSettings.toolPost
            )
            const compensatedSegments = calculator.calculate(profile)

            // 3. 結果を元のresultsにマッピング
            compensatedSegments.forEach((comp, idx) => {
                const seg = results[idx]
                seg.compensated = {
                    startX: comp.compensatedStartX,
                    startZ: comp.compensatedStartZ,
                    endX: comp.compensatedEndX,
                    endZ: comp.compensatedEndZ,
                    radius: comp.compensatedRadius,
                    i: comp.compensatedI,
                    k: comp.compensatedK
                }

                // 高度な情報（fx, fz）も表示用にセット（旧来の互換性のため）
                if (seg.type === 'line' && seg.angle !== undefined) {
                    seg.advancedInfo = {
                        ...seg.advancedInfo,
                        manualShiftX: round3(comp.compensatedEndX - seg.endX),
                        manualShiftZ: round3(seg.endZ - comp.compensatedEndZ)
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

    // 補正R = 元のR + noseR（角Rの場合）/ 元のR - noseR（隅Rの場合）
    // 角R（凸）: 工具が外側を回るので、R + noseR で計算
    // 隅R（凹）: 工具が内側を回るので、R - noseR で計算
    const isConvex = p2.corner.type === 'kaku-r'
    const compensatedSize = isConvex
        ? originalSize + noseR
        : Math.max(0.001, originalSize - noseR)

    const v1x = (p1.x - p2.x) / 2, v1z = p1.z - p2.z
    const v2x = (p3.x - p2.x) / 2, v2z = p3.z - p2.z
    const l1 = Math.sqrt(v1x * v1x + v1z * v1z), l2 = Math.sqrt(v2x * v2x + v2z * v2z)
    if (l1 === 0 || l2 === 0) return null
    const u1x = v1x / l1, u1z = v1z / l1, u2x = v2x / l2, u2z = v2z / l2

    if (p2.corner.type === 'kaku-c') {
        const adjustedC = Math.min(originalSize, l1 * 0.99, l2 * 0.99)
        return {
            entryX: round3((p2.x / 2 + u1x * adjustedC) * 2), entryZ: round3(p2.z + u1z * adjustedC),
            exitX: round3((p2.x / 2 + u2x * adjustedC) * 2), exitZ: round3(p2.z + u2z * adjustedC)
        }
    }

    const innerProduct = u1x * u2x + u1z * u2z
    const angleBetween = Math.acos(Math.max(-1, Math.min(1, innerProduct)))
    const half = angleBetween / 2

    // Rの自動調整 (Limit check) - 補正Rを使用
    // 角度が非常に小さい（直線に近い）場合、tan(half) が小さくなり、maxR が巨大になる。 
    // また half=0 の場合 tan(half)=0 になるためゼロ除算に注意。
    let adjustedSize = compensatedSize
    if (half > 0.0001) {
        const maxTDist = Math.min(l1, l2) * 0.99
        const maxR = maxTDist * Math.tan(half)
        adjustedSize = Math.min(compensatedSize, maxR)
    } else {
        // 直線に近い場合はRを入れる余地がない
        adjustedSize = 0
    }

    const bX = u1x + u2x, bZ = u1z + u2z, bL = Math.sqrt(bX * bX + bZ * bZ)
    if (bL < 1e-6) return null // 180度または0度の場合は計算不能

    const cDist = adjustedSize / Math.sin(half), tDist = adjustedSize / Math.tan(half)
    const cX = p2.x / 2 + (bX / bL) * cDist, cZ = p2.z + (bZ / bL) * cDist
    const eX = p2.x / 2 + u1x * tDist, eZ = p2.z + u1z * tDist
    const xX = p2.x / 2 + u2x * tDist, xZ = p2.z + u2z * tDist

    return {
        entryX: round3(eX * 2), entryZ: round3(eZ), exitX: round3(xX * 2), exitZ: round3(xZ),
        i: round3(cX - eX), k: round3(cZ - eZ), centerX: round3(cX * 2), centerZ: round3(cZ),
        isLeftTurn: (u1x * u2z - u1z * u2x) > 0,
        distToVertex: round3(tDist),
        adjustedRadius: round3(adjustedSize),
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

    // ベクトル定義
    const v1 = { x: (p2.x - p1.x) / 2, z: p2.z - p1.z }
    const v2 = { x: (p3.x - p2.x) / 2, z: p3.z - p2.z }
    const v3 = { x: (p4.x - p3.x) / 2, z: p4.z - p3.z }

    const l1 = Math.sqrt(v1.x * v1.x + v1.z * v1.z)
    const l2 = Math.sqrt(v2.x * v2.x + v2.z * v2.z)
    const l3 = Math.sqrt(v3.x * v3.x + v3.z * v3.z)
    if (l1 === 0 || l2 === 0 || l3 === 0) return null

    const u1 = { x: v1.x / l1, z: v1.z / l1 }
    const u2 = { x: v2.x / l2, z: v2.z / l2 }
    const u3 = { x: v3.x / l3, z: v3.z / l3 }

    // 各角の回転方向 (外積)
    const turn1 = u1.x * u2.z - u1.z * u2.x // > 0 は左
    const turn2 = u2.x * u3.z - u2.z * u3.x

    const isL1 = turn1 > 0
    const isL2 = turn2 > 0

    // S字接続か同方向か
    const isScurve = (isL1 !== isL2)
    const targetDist = isScurve ? (R1 + R2) : Math.abs(R1 - R2)

    // ここでは単純に並行移動を想定した S字接続（Mazatrol方式）を優先
    // 特に p1-p2 と p3-p4 が平行な「段」のケース
    const isParallel = Math.abs(u1.x * u3.z - u1.z * u3.x) < 0.01

    if (isParallel && isScurve) {
        // オフセット方向の法線ベクトル (u1を90度左回転: (-u1.z, u1.x))
        const n1 = { x: -u1.z, z: u1.x }
        const n3 = { x: -u3.z, z: u3.x }

        // 回転方向に応じた符号 (Leftなら+, Rightなら-)
        const s1 = isL1 ? 1 : -1
        const s3 = isL2 ? 1 : -1

        // 中心軌跡 (X座標は固定)
        const x1 = p2.x / 2 + n1.x * s1 * R1
        const x3 = p3.x / 2 + n3.x * s3 * R2

        const h = Math.abs(x3 - x1)
        // 半径の合計が段差より大きい場合、S字接続を適用
        if (h < targetDist) {
            const dz_total = Math.sqrt(targetDist * targetDist - h * h)

            // Zの配分 (半径比)
            const dz1 = dz_total * (R1 / targetDist)
            const dz2 = dz_total * (R2 / targetDist)

            // 移動方向を決定 (u1, u3 の逆に逃がす)
            const c1 = { x: x1, z: p2.z - u1.z * dz1 }
            const c2 = { x: x3, z: p3.z + u3.z * dz2 }

            // 接点 M (Arc1-Arc2)
            const midX = c1.x + (c2.x - c1.x) * (R1 / targetDist)
            const midZ = c1.z + (c2.z - c1.z) * (R1 / targetDist)

            // 開始点 A (Line1-Arc1) - 中心から元の法線方向に R だけ戻る
            const enX = c1.x - n1.x * s1 * R1
            const enZ = c1.z - n1.z * s1 * R1

            // 終了点 B (Arc2-Line3)
            const exX = c2.x - n3.x * s3 * R2
            const exZ = c2.z - n3.z * s3 * R2

            return {
                arc1: {
                    entryX: round3(enX * 2), entryZ: round3(enZ),
                    exitX: round3(midX * 2), exitZ: round3(midZ),
                    centerX: round3(c1.x * 2), centerZ: round3(c1.z),
                    i: round3(c1.x - enX), k: round3(c1.z - enZ),
                    radius: R1, isLeftTurn: isL1
                },
                arc2: {
                    entryX: round3(midX * 2), entryZ: round3(midZ),
                    exitX: round3(exX * 2), exitZ: round3(exZ),
                    centerX: round3(c2.x * 2), centerZ: round3(c2.z),
                    i: round3(c2.x - midX), k: round3(c2.z - midZ),
                    radius: R2, isLeftTurn: isL2
                }
            }
        }
    }

    // それ以外は個別計算に任せる
    return null
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
