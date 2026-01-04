import type { Shape } from '../../models/shape'
import type { CoordinateSettings } from '../../models/settings'
import { defaultCoordinateSettings } from '../../models/settings'

interface ShapePreviewProps {
    shape: Shape
    settings?: CoordinateSettings
}

export function ShapePreview({ shape, settings = defaultCoordinateSettings }: ShapePreviewProps) {
    const width = 300
    const height = 200
    const padding = 30

    // 座標変換（設定に基づいて方向を反転）
    const toSvgX = (z: number, minZ: number, maxZ: number) => {
        const range = maxZ - minZ || 1
        const normalized = (z - minZ) / range
        // Z方向設定に基づいて反転
        const adjusted = settings.zDirection === 1 ? normalized : 1 - normalized
        return padding + adjusted * (width - padding * 2)
    }

    const toSvgY = (x: number, minX: number, maxX: number) => {
        const range = maxX - minX || 1
        const normalized = (x - minX) / range
        // X方向設定に基づいて反転
        const adjusted = settings.xDirection === 1 ? normalized : 1 - normalized
        return height - padding - adjusted * (height - padding * 2)
    }

    if (shape.points.length === 0) {
        return (
            <svg className="preview-svg" viewBox={`0 0 ${width} ${height}`}>
                <text x={width / 2} y={height / 2} textAnchor="middle" fill="#64748b" fontSize="14">
                    点を追加してください
                </text>
            </svg>
        )
    }

    // 範囲計算（直径を半径に変換）
    const xValues = shape.points.map(p => p.x / 2)
    const zValues = shape.points.map(p => p.z)

    const minX = Math.min(...xValues) - 5
    const maxX = Math.max(...xValues) + 5
    const minZ = Math.min(...zValues) - 5
    const maxZ = Math.max(...zValues) + 5

    // パス生成
    const pathParts: string[] = []

    // 始点
    if (shape.points.length > 0) {
        const first = shape.points[0]
        pathParts.push(`M ${toSvgX(first.z, minZ, maxZ)} ${toSvgY(first.x / 2, minX, maxX)}`)
    }

    // 各点への線
    for (let i = 1; i < shape.points.length; i++) {
        const point = shape.points[i]
        const svgX = toSvgX(point.z, minZ, maxZ)
        const svgY = toSvgY(point.x / 2, minX, maxX)
        pathParts.push(`L ${svgX} ${svgY}`)
    }

    return (
        <svg className="preview-svg" viewBox={`0 0 ${width} ${height}`}>
            {/* グリッド */}
            <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2d3748" strokeWidth="0.5" />
                </pattern>
            </defs>
            <rect width={width} height={height} fill="url(#grid)" />

            {/* 座標軸 */}
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#64748b" strokeWidth="1" />
            <line x1={padding} y1={height - padding} x2={padding} y2={padding} stroke="#64748b" strokeWidth="1" />
            <text x={width - padding + 10} y={height - padding} fill="#64748b" fontSize="12">Z</text>
            <text x={padding - 5} y={padding - 10} fill="#64748b" fontSize="12">X</text>

            {/* パス */}
            {pathParts.length > 1 && (
                <path d={pathParts.join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" />
            )}

            {/* 点 */}
            {shape.points.map((point, index) => {
                const hasCorner = point.corner.type !== 'none'
                return (
                    <g key={point.id}>
                        <circle
                            cx={toSvgX(point.z, minZ, maxZ)}
                            cy={toSvgY(point.x / 2, minX, maxX)}
                            r={hasCorner ? 7 : 5}
                            fill={index === 0 ? '#10b981' : index === shape.points.length - 1 ? '#f59e0b' : '#60a5fa'}
                            stroke={hasCorner ? '#fff' : 'none'}
                            strokeWidth={hasCorner ? 2 : 0}
                        />
                        <text
                            x={toSvgX(point.z, minZ, maxZ) + 8}
                            y={toSvgY(point.x / 2, minX, maxX) - 8}
                            fill="#94a3b8"
                            fontSize="10"
                        >
                            {index + 1}
                            {hasCorner && ` ${point.corner.type.toUpperCase()}${point.corner.size}`}
                        </text>
                    </g>
                )
            })}
        </svg>
    )
}
