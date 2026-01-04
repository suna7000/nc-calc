import { useState, useRef, useCallback } from 'react'
import type { GrooveResult } from '../../calculators/groove'

interface GroovePreviewProps {
    result: GrooveResult
}

export function GroovePreview({ result }: GroovePreviewProps) {
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const svgRef = useRef<SVGSVGElement>(null)

    const width = 500
    const height = 300
    const padding = 50

    if (result.grooves.length === 0) return null

    // すべての座標を収集して範囲を計算
    const allCoords: { x: number; z: number }[] = []
    result.grooves.forEach(g => {
        allCoords.push({ x: g.entryX, z: g.entryZ })
        allCoords.push({ x: g.bottomX, z: g.bottomZ })
        allCoords.push({ x: g.bottomX, z: g.exitZ })
        allCoords.push({ x: g.entryX, z: g.exitZ })

        if (g.cornerR) {
            allCoords.push({ x: g.cornerR.leftArc.startX, z: g.cornerR.leftArc.startZ })
            allCoords.push({ x: g.cornerR.leftArc.endX, z: g.cornerR.leftArc.endZ })
            allCoords.push({ x: g.cornerR.rightArc.startX, z: g.cornerR.rightArc.startZ })
            allCoords.push({ x: g.cornerR.rightArc.endX, z: g.cornerR.rightArc.endZ })
        }

        if (g.fullRArc) {
            allCoords.push({ x: g.fullRArc.startX, z: g.fullRArc.startZ })
            allCoords.push({ x: g.fullRArc.endX, z: g.fullRArc.endZ })
            // 円弧の最深点も追加
            allCoords.push({ x: g.bottomX, z: g.fullRArc.centerZ })
        }
    })

    const xValues = allCoords.map(p => p.x / 2) // 半径値
    const zValues = allCoords.map(p => p.z)

    const minX = Math.min(...xValues) - 5
    const maxX = Math.max(...xValues) + 5
    const minZ = Math.min(...zValues) - 5
    const maxZ = Math.max(...zValues) + 5

    // Z座標 → SVG X座標（右が-Z、左が+Z として描画）
    const toSvgX = (z: number) => {
        const range = maxZ - minZ || 1
        const normalized = (z - minZ) / range
        return padding + (1 - normalized) * (width - padding * 2)
    }

    // X座標(半径) → SVG Y座標（上が大きい径、下が小さい径）
    const toSvgY = (xRadius: number) => {
        const range = maxX - minX || 1
        const normalized = (xRadius - minX) / range
        return height - padding - normalized * (height - padding * 2)
    }

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 5))
    }, [])

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

    const resetView = () => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }

    return (
        <div className="groove-preview-container">
            <div className="zoom-controls">
                <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} title="拡大">＋</button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.5))} title="縮小">－</button>
                <button onClick={resetView} title="リセット">⟲</button>
            </div>

            <div
                className="cad-view interactive"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
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
                        <pattern id="groove-grid-sm" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1a3550" strokeWidth="0.3" />
                        </pattern>
                        <pattern id="groove-grid-lg" width="50" height="50" patternUnits="userSpaceOnUse">
                            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#234567" strokeWidth="0.7" />
                        </pattern>
                    </defs>

                    <rect width={width} height={height} fill="#0a1929" rx="8" />
                    <rect width={width} height={height} fill="url(#groove-grid-sm)" />
                    <rect width={width} height={height} fill="url(#groove-grid-lg)" />

                    {/* 溝の描画 */}
                    {result.grooves.map((g, i) => {
                        // 座標変換（直径 -> 半径）
                        const entryR = g.entryX / 2
                        const bottomR = g.bottomX / 2
                        const entryZ = g.entryZ
                        const exitZ = g.exitZ

                        // SVG座標
                        const leftTopX = toSvgX(entryZ)
                        const leftTopY = toSvgY(entryR)
                        const rightTopX = toSvgX(exitZ)
                        const rightTopY = toSvgY(entryR)

                        // 完全R形状（U字溝）
                        if (g.fullRArc) {
                            const R = g.fullRArc.radius
                            const centerZ = g.fullRArc.centerZ

                            // SVG座標に変換
                            const centerSvgX = toSvgX(centerZ)
                            const bottomSvgY = toSvgY(bottomR)

                            // SVG上での円弧半径
                            const zRange = maxZ - minZ || 1
                            const xRange = maxX - minX || 1
                            const svgRx = (R / zRange) * (width - padding * 2)
                            const svgRy = (R / xRange) * (height - padding * 2)

                            // パス: 左上 → 半円弧（下向き） → 右上
                            const pathD = `
                                M ${leftTopX} ${leftTopY}
                                A ${svgRx} ${svgRy} 0 1 0 ${rightTopX} ${rightTopY}
                            `

                            return (
                                <g key={`groove-${i}`}>
                                    <path
                                        d={pathD}
                                        fill="none"
                                        stroke="#60a5fa"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    {/* ポイントマーカー */}
                                    {/* 進入点 */}
                                    <circle cx={leftTopX} cy={leftTopY} r="5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                                    <text x={leftTopX + 8} y={leftTopY + 4} fill="#10b981" fontSize="10" fontWeight="bold">1</text>
                                    {/* 最深点 */}
                                    <circle cx={centerSvgX} cy={bottomSvgY} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
                                    <text x={centerSvgX + 8} y={bottomSvgY + 4} fill="#f59e0b" fontSize="10" fontWeight="bold">2</text>
                                    {/* 退避点 */}
                                    <circle cx={rightTopX} cy={rightTopY} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
                                    <text x={rightTopX + 8} y={rightTopY + 4} fill="#ef4444" fontSize="10" fontWeight="bold">3</text>

                                    <text x={leftTopX + 5} y={leftTopY - 12} fill="#64748b" fontSize="11">
                                        溝{g.index} (R{R})
                                    </text>
                                </g>
                            )
                        }

                        // 底R形状
                        if (g.cornerR) {
                            const R = g.cornerR.leftArc.radius

                            // R部分の接点を計算
                            const leftRStartR = bottomR + R
                            const leftREndZ = entryZ - R
                            const rightRStartZ = exitZ + R
                            const rightREndR = bottomR + R

                            // SVG座標に変換
                            const leftRStartY = toSvgY(leftRStartR)
                            const leftREndX = toSvgX(leftREndZ)
                            const bottomY = toSvgY(bottomR)
                            const rightRStartX = toSvgX(rightRStartZ)
                            const rightREndY = toSvgY(rightREndR)

                            // SVG上での円弧半径
                            const zRange = maxZ - minZ || 1
                            const xRange = maxX - minX || 1
                            const svgRx = (R / zRange) * (width - padding * 2)
                            const svgRy = (R / xRange) * (height - padding * 2)

                            const pathD = `
                                M ${leftTopX} ${leftTopY}
                                L ${leftTopX} ${leftRStartY}
                                A ${svgRx} ${svgRy} 0 0 0 ${leftREndX} ${bottomY}
                                L ${rightRStartX} ${bottomY}
                                A ${svgRx} ${svgRy} 0 0 0 ${rightTopX} ${rightREndY}
                                L ${rightTopX} ${rightTopY}
                            `

                            return (
                                <g key={`groove-${i}`}>
                                    <path
                                        d={pathD}
                                        fill="none"
                                        stroke="#60a5fa"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    {/* ポイントマーカー */}
                                    <circle cx={leftTopX} cy={leftTopY} r="5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                                    <text x={leftTopX + 8} y={leftTopY + 4} fill="#10b981" fontSize="10" fontWeight="bold">1</text>
                                    <circle cx={leftTopX} cy={leftRStartY} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1" />
                                    <text x={leftTopX + 8} y={leftRStartY + 4} fill="#3b82f6" fontSize="9">2</text>
                                    <circle cx={leftREndX} cy={bottomY} r="4" fill="#f59e0b" stroke="#fff" strokeWidth="1" />
                                    <text x={leftREndX + 6} y={bottomY + 4} fill="#f59e0b" fontSize="9">3</text>
                                    <circle cx={rightRStartX} cy={bottomY} r="4" fill="#f59e0b" stroke="#fff" strokeWidth="1" />
                                    <text x={rightRStartX - 14} y={bottomY + 4} fill="#f59e0b" fontSize="9">4</text>
                                    <circle cx={rightTopX} cy={rightREndY} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1" />
                                    <text x={rightTopX - 14} y={rightREndY + 4} fill="#3b82f6" fontSize="9">5</text>
                                    <circle cx={rightTopX} cy={rightTopY} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
                                    <text x={rightTopX - 14} y={rightTopY + 4} fill="#ef4444" fontSize="10" fontWeight="bold">6</text>

                                    <text x={leftTopX + 5} y={leftTopY - 12} fill="#64748b" fontSize="11">溝{g.index}</text>
                                </g>
                            )
                        }

                        // 直角形状
                        const bottomY = toSvgY(bottomR)
                        const pathD = `
                            M ${leftTopX} ${leftTopY}
                            L ${leftTopX} ${bottomY}
                            L ${rightTopX} ${bottomY}
                            L ${rightTopX} ${rightTopY}
                        `

                        return (
                            <g key={`groove-${i}`}>
                                <path
                                    d={pathD}
                                    fill="none"
                                    stroke="#60a5fa"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                {/* ポイントマーカー */}
                                <circle cx={leftTopX} cy={leftTopY} r="5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                                <text x={leftTopX + 8} y={leftTopY + 4} fill="#10b981" fontSize="10" fontWeight="bold">1</text>
                                <circle cx={leftTopX} cy={bottomY} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
                                <text x={leftTopX + 8} y={bottomY + 4} fill="#f59e0b" fontSize="10" fontWeight="bold">2</text>
                                <circle cx={rightTopX} cy={bottomY} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
                                <text x={rightTopX - 14} y={bottomY + 4} fill="#f59e0b" fontSize="10" fontWeight="bold">3</text>
                                <circle cx={rightTopX} cy={rightTopY} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
                                <text x={rightTopX - 14} y={rightTopY + 4} fill="#ef4444" fontSize="10" fontWeight="bold">4</text>

                                <text x={leftTopX + 5} y={leftTopY - 12} fill="#64748b" fontSize="11">溝{g.index}</text>
                            </g>
                        )
                    })}
                </svg>
            </div>
        </div>
    )
}
