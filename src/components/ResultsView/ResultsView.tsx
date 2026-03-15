import { useState, useRef, useCallback } from 'react'
import type { Shape } from '../../models/shape'
import { calculateShape, type SegmentResult } from '../../calculators/shape'
import type { MachineSettings, CoordinateSettings } from '../../models/settings'
import { defaultMachineSettings, defaultCoordinateSettings } from '../../models/settings'
import './ResultsView.css'

interface ResultsViewProps {
    shape: Shape
    onCopy: () => void
    machineSettings?: MachineSettings
    coordSettings?: CoordinateSettings
}

export function ResultsView({
    shape,
    onCopy,
    machineSettings = defaultMachineSettings,
    coordSettings = defaultCoordinateSettings
}: ResultsViewProps) {
    const result = calculateShape(shape, machineSettings)
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const lastPinchDist = useRef<number | null>(null)
    const svgRef = useRef<SVGSVGElement>(null)

    const width = 500
    const height = 380
    const padding = 50

    if (result.segments.length === 0) {
        return null
    }

    // 全計算結果の座標を収集（補正座標があればそれを優先）
    const allCoords: { x: number; z: number }[] = []
    result.segments.forEach(seg => {
        const startX = seg.compensated?.startX ?? seg.startX
        const startZ = seg.compensated?.startZ ?? seg.startZ
        const endX = seg.compensated?.endX ?? seg.endX
        const endZ = seg.compensated?.endZ ?? seg.endZ
        allCoords.push({ x: startX, z: startZ })
        allCoords.push({ x: endX, z: endZ })
    })

    const xValues = allCoords.map(p => p.x / 2)
    const zValues = allCoords.map(p => p.z)

    const minX = Math.min(...xValues) - 5
    const maxX = Math.max(...xValues) + 5
    const minZ = Math.min(...zValues) - 5
    const maxZ = Math.max(...zValues) + 5

    // 座標変換関数（軸方向設定を反映）
    const toSvgX = (z: number) => {
        const range = maxZ - minZ || 1
        const normalized = (z - minZ) / range
        // Z方向: zDirection=1なら右が+、-1なら左が+
        const adjusted = coordSettings.zDirection === 1 ? normalized : 1 - normalized
        return padding + adjusted * (width - padding * 2)
    }

    const toSvgY = (x: number) => {
        const range = maxX - minX || 1
        const normalized = (x - minX) / range
        // X方向: xDirection=1なら上が+、-1なら下が+
        const adjusted = coordSettings.xDirection === 1 ? normalized : 1 - normalized
        return height - padding - adjusted * (height - padding * 2)
    }

    const colors = {
        line: '#3b82f6',
        cornerR: '#10b981',
        cornerC: '#f59e0b',
        dimension: '#94a3b8',
        point: '#ef4444'
    }

    // 全ポイントを収集
    const allPoints: {
        x: number; z: number;
        svgX: number; svgY: number;
        label: string;
        color: string;
        index: number;
    }[] = []

    result.segments.forEach((seg, i) => {
        // 補正座標があればそれを優先使用
        const startX = seg.compensated?.startX ?? seg.startX
        const startZ = seg.compensated?.startZ ?? seg.startZ
        const endX = seg.compensated?.endX ?? seg.endX
        const endZ = seg.compensated?.endZ ?? seg.endZ

        if (i === 0) {
            allPoints.push({
                x: startX, z: startZ,
                svgX: toSvgX(startZ), svgY: toSvgY(startX / 2),
                label: '始点',
                color: colors.cornerR,
                index: 1
            })
        }
        allPoints.push({
            x: endX, z: endZ,
            svgX: toSvgX(endZ), svgY: toSvgY(endX / 2),
            label: seg.type === 'corner-r' ? 'R' : seg.type === 'corner-c' ? 'C' : '',
            color: seg.type === 'corner-r' ? colors.cornerR
                : seg.type === 'corner-c' ? colors.cornerC
                    : colors.line,
            index: i + 2
        })
    })

    // ズーム操作
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 5))
    }, [])

    // パン操作
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsDragging(true)
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }, [pan])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return
        setPan({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        })
    }, [isDragging, dragStart])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Touch: pan (1 finger) + pinch zoom (2 fingers)
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setIsDragging(true)
            setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y })
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            lastPinchDist.current = Math.hypot(dx, dy)
        }
    }, [pan])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        e.preventDefault()
        if (e.touches.length === 1 && isDragging) {
            setPan({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y
            })
        } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            const dist = Math.hypot(dx, dy)
            const scale = dist / lastPinchDist.current
            setZoom(prev => Math.min(Math.max(prev * scale, 0.5), 5))
            lastPinchDist.current = dist
        }
    }, [isDragging, dragStart])

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false)
        lastPinchDist.current = null
    }, [])

    const resetView = () => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }

    return (
        <div className="results-view">
            <div className="results-header">
                <h3>📐 計算結果（NC加工座標）</h3>
                <div className="header-actions">
                    {machineSettings.noseRCompensation.enabled && (
                        <span className="badge badge-success">G41/G42 有効</span>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={onCopy}>
                        📋 コピー
                    </button>
                </div>
            </div>

            {/* 工具情報表示 */}
            {machineSettings.activeToolId && (
                <div className="tool-info-board">
                    <div className="info-item">
                        <span className="label">使用工具:</span>
                        <span className="value highlight">
                            {machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)?.name || '未選択'}
                        </span>
                    </div>
                    <div className="info-grid">
                        <div className="info-item">
                            <span className="label">ノーズR:</span>
                            <span className="value">R{machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)?.noseRadius || 0}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">切削角度:</span>
                            <span className="value">
                                {machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)?.leadAngle || '-'}°
                                / {machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)?.backAngle || '-'}°
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* 干渉警告表示 */}
            {result.warnings.length > 0 && (
                <div className="warnings-board">
                    {result.warnings.map((msg, i) => (
                        <div key={i} className="warning-item">
                            <span className="warning-icon">⚠️</span>
                            <span className="warning-text">{msg}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ズームコントロール */}
            <div className="zoom-controls">
                <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} title="拡大">＋</button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.5))} title="縮小">－</button>
                <button onClick={resetView} title="リセット">⟲</button>
                <span className="zoom-hint">
                    {'ontouchstart' in window ? 'ピンチでズーム、スワイプで移動' : 'ホイールでズーム、ドラッグで移動'}
                </span>
            </div>

            {/* インタラクティブCADビュー */}
            <div
                className="cad-view enhanced interactive"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    className="cad-svg"
                    style={{
                        transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                        cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                >
                    <defs>
                        <pattern id="grid-sm" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1a3550" strokeWidth="0.3" />
                        </pattern>
                        <pattern id="grid-lg" width="50" height="50" patternUnits="userSpaceOnUse">
                            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#234567" strokeWidth="0.7" />
                        </pattern>
                    </defs>

                    <rect width={width} height={height} fill="#0a1929" rx="8"
                        onClick={() => setHoveredPoint(null)} />
                    <rect width={width} height={height} fill="url(#grid-sm)" />
                    <rect width={width} height={height} fill="url(#grid-lg)" />

                    {/* 座標軸 */}
                    <g className="axis">
                        <line x1={padding - 15} y1={height - padding + 20}
                            x2={width - padding + 20} y2={height - padding + 20}
                            stroke="#4b5563" strokeWidth="1" />
                        <line x1={padding - 20} y1={height - padding + 15}
                            x2={padding - 20} y2={padding - 15}
                            stroke="#4b5563" strokeWidth="1" />
                        <text x={width - padding + 30} y={height - padding + 25} fill="#64748b" fontSize="12">Z</text>
                        <text x={padding - 30} y={padding - 20} fill="#64748b" fontSize="12">X</text>
                    </g>

                    {/* セグメント描画 */}
                    {result.segments.map((seg, i) => {
                        // 補正座標があればそれを優先使用
                        const startZ = seg.compensated?.startZ ?? seg.startZ
                        const startX = seg.compensated?.startX ?? seg.startX
                        const endZ = seg.compensated?.endZ ?? seg.endZ
                        const endX = seg.compensated?.endX ?? seg.endX
                        const radius = seg.compensated?.radius ?? seg.radius

                        const x1 = toSvgX(startZ)
                        const y1 = toSvgY(startX / 2)
                        const x2 = toSvgX(endZ)
                        const y2 = toSvgY(endX / 2)

                        const color = seg.type === 'corner-r' ? colors.cornerR
                            : seg.type === 'corner-c' ? colors.cornerC
                                : colors.line

                        if (seg.type === 'corner-r' && radius) {
                            // SVGの円弧コマンドでR部を描画
                            // SVGのA(arc)コマンド: A rx ry x-axis-rotation large-arc-flag sweep-flag x y

                            // 半径をSVG座標に変換
                            const zRange = maxZ - minZ || 1
                            const xRange = maxX - minX || 1
                            const svgRadiusX = (radius / zRange) * (width - padding * 2)
                            const svgRadiusY = (radius / xRange) * (height - padding * 2)

                            // sweep-flag: 描写用の幾何学的な回転方向を使用
                            // SegmentResult.sweep は 0 (CCW) か 1 (CW)
                            // SVGでは sweep=1 が時計回り
                            const sweepFlag = seg.sweep !== undefined ? seg.sweep : (seg.gCode === 'G02' ? 1 : 0)

                            return (
                                <path key={`seg-${i}`}
                                    d={`M ${x1} ${y1} A ${svgRadiusX} ${svgRadiusY} 0 0 ${sweepFlag} ${x2} ${y2}`}
                                    fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
                                />
                            )
                        }

                        return (
                            <line key={`seg-${i}`}
                                x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke={color} strokeWidth="3" strokeLinecap="round"
                            />
                        )
                    })}

                    {/* ポイントマーカー（ホバーまたはタップで詳細表示） */}
                    {allPoints.map((pt, idx) => (
                        <g
                            key={`pt-${idx}`}
                            onMouseEnter={() => setHoveredPoint(idx)}
                            onMouseLeave={() => setHoveredPoint(null)}
                            onClick={(e) => {
                                e.stopPropagation()
                                setHoveredPoint(prev => prev === idx ? null : idx)
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* 外側リング */}
                            <circle
                                cx={pt.svgX} cy={pt.svgY}
                                r={hoveredPoint === idx ? 14 : 10}
                                fill={pt.color}
                                stroke="white"
                                strokeWidth="2"
                                opacity={hoveredPoint === idx ? 1 : 0.9}
                            />
                            {/* ポイント番号 */}
                            <text
                                x={pt.svgX} y={pt.svgY + 4}
                                textAnchor="middle"
                                fill="white"
                                fontSize="11"
                                fontWeight="700"
                            >
                                {pt.index}
                            </text>

                            {/* ホバー時のツールチップ */}
                            {hoveredPoint === idx && (
                                <g>
                                    <rect
                                        x={pt.svgX + 15}
                                        y={pt.svgY - 35}
                                        width="95"
                                        height="50"
                                        fill="#0f172a"
                                        stroke={pt.color}
                                        strokeWidth="2"
                                        rx="4"
                                    />
                                    <text x={pt.svgX + 62} y={pt.svgY - 18} textAnchor="middle"
                                        fill={pt.color} fontSize="10" fontWeight="600">
                                        {pt.label || `P${pt.index}`}
                                    </text>
                                    <text x={pt.svgX + 25} y={pt.svgY - 2} fill="#64748b" fontSize="9">X</text>
                                    <text x={pt.svgX + 38} y={pt.svgY - 2} fill="#e2e8f0" fontSize="11" fontWeight="700" fontFamily="monospace">
                                        {pt.x.toFixed(3)}
                                    </text>
                                    <text x={pt.svgX + 25} y={pt.svgY + 12} fill="#64748b" fontSize="9">Z</text>
                                    <text x={pt.svgX + 38} y={pt.svgY + 12} fill="#e2e8f0" fontSize="11" fontWeight="700" fontFamily="monospace">
                                        {pt.z.toFixed(3)}
                                    </text>
                                </g>
                            )}
                        </g>
                    ))}
                </svg>
            </div>

            {/* NCコード形式 */}
            <div className="nc-code-view">
                <div className="nc-code-header">
                    <span className="nc-code-title">NCプログラム</span>
                </div>
                <div className="nc-code-body">
                    {/* 始点出力（補正あり/なしで異なる） */}
                    {result.segments.length > 0 && (() => {
                        const firstSeg = result.segments[0]
                        const startX = firstSeg.compensated?.startX ?? firstSeg.startX
                        const startZ = firstSeg.compensated?.startZ ?? firstSeg.startZ

                        if (machineSettings.noseRCompensation.enabled) {
                            // 補正あり：G42/G41 + 始点座標を同じ行に
                            return (
                                <div className="nc-line compensation">
                                    <span className="nc-line-num">N5</span>
                                    <span className="nc-command">
                                        {getCompensationGCode(machineSettings)} D{String(machineSettings.noseRCompensation.offsetNumber).padStart(2, '0')} X{startX.toFixed(3)} Z{startZ.toFixed(3)} ; ノーズR補正開始
                                    </span>
                                </div>
                            )
                        } else {
                            // 補正なし：始点座標のみ
                            return (
                                <div className="nc-line">
                                    <span className="nc-line-num">N5</span>
                                    <span className="nc-command">G01 X{startX.toFixed(3)} Z{startZ.toFixed(3)} ; 始点</span>
                                </div>
                            )
                        }
                    })()}

                    {/* 各セグメントの終点 */}
                    {result.segments.map((seg, i) => (
                        <div key={i} className={`nc-line ${seg.type}`}>
                            <span className="nc-line-num">N{(i + 1) * 10 + 5}</span>
                            <span className="nc-command">{formatNCLine(seg, coordSettings)}</span>
                        </div>
                    ))}

                    {/* ノーズR補正キャンセル */}
                    {machineSettings.noseRCompensation.enabled && (
                        <div className="nc-line compensation">
                            <span className="nc-line-num">N{(result.segments.length + 1) * 10 + 5}</span>
                            <span className="nc-command">G40 ; 補正キャンセル</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 座標テーブル（詳細表示） */}
            <div className="coord-table">
                <table>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>種類</th>
                            {machineSettings.noseRCompensation.enabled ? (
                                <>
                                    <th className="compensated">プログラムX（始）</th>
                                    <th className="compensated">プログラムZ（始）</th>
                                    <th className="compensated">プログラムX（終）</th>
                                    <th className="compensated">プログラムZ（終）</th>
                                    <th className="compensated">I / K</th>
                                </>
                            ) : (
                                <>
                                    <th>X（始点）</th>
                                    <th>Z（始点）</th>
                                    <th>X（終点）</th>
                                    <th>Z（終点）</th>
                                    <th>I / K</th>
                                </>
                            )}
                            <th className="advanced">設計(幾何)座標 / シフト量</th>
                        </tr>
                    </thead>
                    <tbody>
                        {result.segments.map((seg, i) => (
                            <tr key={i} className={seg.type}>
                                <td className="center">{i + 1}</td>
                                <td>
                                    <span className={`type-badge ${seg.type}`}>
                                        {getTypeLabel(seg.type)}
                                    </span>
                                </td>
                                {/* メインの座標列：補正が有効なら補正後を表示 */}
                                <td className="mono highlight-comp">{(seg.compensated?.startX ?? seg.startX).toFixed(3)}</td>
                                <td className="mono highlight-comp">{(seg.compensated?.startZ ?? seg.startZ).toFixed(3)}</td>
                                <td className="mono highlight-comp">{(seg.compensated?.endX ?? seg.endX).toFixed(3)}</td>
                                <td className="mono highlight-comp">{(seg.compensated?.endZ ?? seg.endZ).toFixed(3)}</td>
                                <td className="mono">
                                    {seg.compensated?.i !== undefined ? `I${seg.compensated.i.toFixed(3)} K${seg.compensated.k?.toFixed(3)}`
                                        : (seg.i !== undefined ? `I${seg.i.toFixed(3)} K${seg.k?.toFixed(3)}` : '-')}
                                </td>

                                <td className="advanced-info-cell">
                                    <div className="geo-info">
                                        <span className="label">設計:</span>
                                        X{seg.startX.toFixed(3)} Z{seg.startZ.toFixed(3)} → X{seg.endX.toFixed(3)} Z{seg.endZ.toFixed(3)}
                                    </div>
                                    {machineSettings.noseRCompensation.enabled && (
                                        <>
                                            {seg.advancedInfo?.distToVertex !== undefined && (
                                                <div className="vertex-info" title="仮想交点からの戻り量 (L)">
                                                    <span>カド戻りL: {seg.advancedInfo.distToVertex.toFixed(3)}</span>
                                                </div>
                                            )}
                                            {seg.advancedInfo?.tangentX !== undefined && (
                                                <div className="tangent-info" title="理論接点座標">
                                                    <span>接点: X{seg.advancedInfo.tangentX.toFixed(3)}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function formatNCLine(seg: SegmentResult, coordSettings: CoordinateSettings): string {
    // 補正座標があれば優先、なければ元座標を使用
    const endX = seg.compensated?.endX ?? seg.endX
    const endZ = seg.compensated?.endZ ?? seg.endZ
    const i = seg.compensated?.i ?? seg.i
    const k = seg.compensated?.k ?? seg.k
    const radius = seg.compensated?.radius ?? seg.radius
    const gCode = seg.gCode || (seg.type === 'corner-r' ? 'G03' : 'G01')

    if (seg.type === 'corner-r') {
        if (coordSettings.arcOutputMode === 'R' && radius !== undefined) {
            return `${gCode} X${endX.toFixed(3)} Z${endZ.toFixed(3)} R${radius.toFixed(3)}`
        } else {
            return `${gCode} X${endX.toFixed(3)} Z${endZ.toFixed(3)} I${i?.toFixed(3)} K${k?.toFixed(3)}`
        }
    } else if (seg.type === 'corner-c') {
        return `G01 X${endX.toFixed(3)} Z${endZ.toFixed(3)}`
    }
    return `G01 X${endX.toFixed(3)} Z${endZ.toFixed(3)}`
}

function getTypeLabel(type: string): string {
    switch (type) {
        case 'line': return '直線'
        case 'corner-r': return 'R'
        case 'corner-c': return 'C面'
        default: return type
    }
}

/**
 * 加工種類と刃物台位置からG41/G42を判定
 * 
 * 正しいルール:
 * - G41（左方補正）: 進行方向に対して刃先がプログラム経路の左側に位置する場合
 * - G42（右方補正）: 進行方向に対して刃先がプログラム経路の右側に位置する場合
 * 
 * 一般的な加工別ルール (前刃物台, -Z方向):
 * - 外径加工: G42（ワークが右側）
 * - 内径加工: G41（ワークが左側）
 * - 端面加工: 進行方向(-X)でワーク側を判定
 * - 溝入れ: 加工方向による
 */
function getCompensationGCode(machineSettings: MachineSettings): string {
    const { enabled, compensationDirection } = machineSettings.noseRCompensation
    if (!enabled) return ''

    // 手動指定がある場合はそれを使用
    if (compensationDirection !== 'auto') {
        return compensationDirection
    }

    const activeTool = machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)
    const machiningType = activeTool?.type || 'external'

    // 加工種類による基本判定（前刃物台、-Z方向を基準）
    let isG42 = false
    switch (machiningType) {
        case 'external':
            // 外径加工: ワークは進行方向の右側 → G42
            isG42 = true
            break
        case 'internal':
            // 内径加工: ワークは進行方向の左側 → G41
            isG42 = false
            break
        case 'facing':
            // 端面加工: -X方向に進む場合、外周側から → G42が一般的
            isG42 = true
            break
        case 'grooving':
            // 溝入れ: 外径なら G42、内径なら G41
            // デフォルトは外径溝として G42
            isG42 = true
            break
    }

    // 後刃物台の場合は反転
    if (machineSettings.toolPost === 'rear') {
        isG42 = !isG42
    }

    // 切削方向が+Zの場合も反転（通常は-Z方向）
    if (machineSettings.cuttingDirection === '+z') {
        isG42 = !isG42
    }

    return isG42 ? 'G42' : 'G41'
}

