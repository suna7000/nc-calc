interface ArcPreviewProps {
    startX?: number
    startZ?: number
    endX?: number
    endZ?: number
    centerX?: number
    centerZ?: number
    direction?: 'CW' | 'CCW'
}

export function ArcPreview({
    startX,
    startZ,
    endX,
    endZ,
    centerX,
    centerZ,
    direction
}: ArcPreviewProps) {
    // SVGのビューポート設定
    const width = 300
    const height = 200
    const padding = 30

    // 座標変換（実座標 → SVG座標）
    // 旋盤座標系: X上が+、Z右が+
    // SVG座標系: Y下が+、X右が+
    const toSvgX = (z: number, minZ: number, maxZ: number) => {
        const range = maxZ - minZ || 1
        return padding + ((z - minZ) / range) * (width - padding * 2)
    }

    const toSvgY = (x: number, minX: number, maxX: number) => {
        const range = maxX - minX || 1
        return height - padding - ((x - minX) / range) * (height - padding * 2)
    }

    // データポイントがあるか確認
    const hasStart = startX !== undefined && startZ !== undefined
    const hasEnd = endX !== undefined && endZ !== undefined
    const hasCenter = centerX !== undefined && centerZ !== undefined

    // 範囲計算
    const points: { x: number; z: number }[] = []
    if (hasStart) points.push({ x: startX / 2, z: startZ })  // 半径で計算
    if (hasEnd) points.push({ x: endX / 2, z: endZ })
    if (hasCenter) points.push({ x: centerX / 2, z: centerZ })

    if (points.length === 0) {
        return (
            <svg className="preview-svg" viewBox={`0 0 ${width} ${height}`}>
                <text x={width / 2} y={height / 2} textAnchor="middle" fill="#64748b" fontSize="14">
                    座標を入力してください
                </text>
            </svg>
        )
    }

    const minX = Math.min(...points.map(p => p.x)) - 5
    const maxX = Math.max(...points.map(p => p.x)) + 5
    const minZ = Math.min(...points.map(p => p.z)) - 5
    const maxZ = Math.max(...points.map(p => p.z)) + 5

    // 円弧パスの生成
    let arcPath = ''
    if (hasStart && hasEnd && hasCenter) {
        const svgStartX = toSvgX(startZ, minZ, maxZ)
        const svgStartY = toSvgY(startX / 2, minX, maxX)
        const svgEndX = toSvgX(endZ, minZ, maxZ)
        const svgEndY = toSvgY(endX / 2, minX, maxX)

        // 半径計算
        const radius = Math.sqrt(
            Math.pow((startX / 2) - (centerX / 2), 2) +
            Math.pow(startZ - centerZ, 2)
        )
        const svgRadius = (radius / (maxX - minX)) * (height - padding * 2)

        // sweep-flag: CW=0, CCW=1（SVG座標系では反転）
        const sweepFlag = direction === 'CW' ? 0 : 1

        arcPath = `M ${svgStartX} ${svgStartY} A ${svgRadius} ${svgRadius} 0 0 ${sweepFlag} ${svgEndX} ${svgEndY}`
    }

    return (
        <svg className="preview-svg" viewBox={`0 0 ${width} ${height}`}>
            {/* グリッド線 */}
            <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2d3748" strokeWidth="0.5" />
                </pattern>
            </defs>
            <rect width={width} height={height} fill="url(#grid)" />

            {/* 座標軸 */}
            <line
                x1={padding} y1={height - padding}
                x2={width - padding} y2={height - padding}
                stroke="#64748b" strokeWidth="1"
            />
            <line
                x1={padding} y1={height - padding}
                x2={padding} y2={padding}
                stroke="#64748b" strokeWidth="1"
            />
            <text x={width - padding + 10} y={height - padding} fill="#64748b" fontSize="12">Z</text>
            <text x={padding - 5} y={padding - 10} fill="#64748b" fontSize="12">X</text>

            {/* 円弧 */}
            {arcPath && (
                <path
                    d={arcPath}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                />
            )}

            {/* 始点 */}
            {hasStart && (
                <>
                    <circle
                        cx={toSvgX(startZ, minZ, maxZ)}
                        cy={toSvgY(startX / 2, minX, maxX)}
                        r="6"
                        fill="#10b981"
                    />
                    <text
                        x={toSvgX(startZ, minZ, maxZ) + 10}
                        y={toSvgY(startX / 2, minX, maxX) - 10}
                        fill="#10b981"
                        fontSize="11"
                    >
                        始点
                    </text>
                </>
            )}

            {/* 終点 */}
            {hasEnd && (
                <>
                    <circle
                        cx={toSvgX(endZ, minZ, maxZ)}
                        cy={toSvgY(endX / 2, minX, maxX)}
                        r="6"
                        fill="#f59e0b"
                    />
                    <text
                        x={toSvgX(endZ, minZ, maxZ) + 10}
                        y={toSvgY(endX / 2, minX, maxX) - 10}
                        fill="#f59e0b"
                        fontSize="11"
                    >
                        終点
                    </text>
                </>
            )}

            {/* 中心点 */}
            {hasCenter && (
                <>
                    <circle
                        cx={toSvgX(centerZ, minZ, maxZ)}
                        cy={toSvgY(centerX / 2, minX, maxX)}
                        r="4"
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth="2"
                    />
                    <text
                        x={toSvgX(centerZ, minZ, maxZ) + 10}
                        y={toSvgY(centerX / 2, minX, maxX)}
                        fill="#60a5fa"
                        fontSize="11"
                    >
                        中心
                    </text>
                </>
            )}
        </svg>
    )
}
