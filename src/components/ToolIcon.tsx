import type { InsertShape } from '../models/settings'

interface ToolIconProps {
    shape: InsertShape
    className?: string
    size?: number
    color?: string
    fill?: boolean
}

export function ToolIcon({ shape, className = '', size = 40, color = '#e6b422', fill = true }: ToolIconProps) {
    const renderPath = () => {
        const strokeColor = '#ffffff'
        const fillColor = fill ? color : 'none'
        const centerHole = <circle cx="20" cy="20" r="3.5" fill="#1a1a1a" stroke={strokeColor} strokeWidth="0.5" />

        const props = {
            stroke: strokeColor,
            strokeOpacity: 0.5,
            fill: fillColor,
            fillOpacity: 1,
            strokeWidth: "1",
            strokeLinejoin: "round" as const
        }

        switch (shape) {
            case 'W': // Hexagon 80° (Trigon)
                return (
                    <g>
                        <path d="M20 6 L33 13 L33 27 L20 34 L7 27 L7 13 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'C': // Rhombus 80°
                return (
                    <g>
                        <path d="M20 5 L35 20 L20 35 L5 20 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'D': // Rhombus 55°
                return (
                    <g>
                        <path d="M20 5 L31 20 L20 35 L9 20 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'V': // Rhombus 35°
                return (
                    <g>
                        <path d="M20 5 L27 20 L20 35 L13 20 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'S': // Square 90°
                return (
                    <g>
                        <rect x="8" y="8" width="24" height="24" {...props} />
                        {centerHole}
                    </g>
                )
            case 'T': // Triangle 60°
                return (
                    <g>
                        <path d="M20 7 L35 32 L5 32 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'R': // Round
                return (
                    <g>
                        <circle cx="20" cy="20" r="14" {...props} />
                        {centerHole}
                    </g>
                )
            case 'K': // Parallelogram 55°
                return (
                    <g>
                        <path d="M10 10 L30 10 L25 30 L5 30 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'L': // Rectangle 90°
                return (
                    <g>
                        <rect x="10" y="12" width="20" height="16" {...props} />
                        {centerHole}
                    </g>
                )
            case 'A': // Rhombus 85°
                return (
                    <g>
                        <path d="M20 5 L36 20 L20 35 L4 20 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'B': // Rhombus 82°
                return (
                    <g>
                        <path d="M20 5 L35.5 20 L20 35 L4.5 20 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'H': // Regular Hexagon 120°
                return (
                    <g>
                        <path d="M20 5 L33 12.5 L33 27.5 L20 35 L7 27.5 L7 12.5 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'M': // Rhombus 86°
                return (
                    <g>
                        <path d="M20 5 L36.5 20 L20 35 L3.5 20 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'O': // Octagon 135°
                return (
                    <g>
                        <path d="M20 5 L30.6 9.4 L35 20 L30.6 30.6 L20 35 L9.4 30.6 L5 20 L9.4 9.4 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'P': // Pentagon 108°
                return (
                    <g>
                        <path d="M20 5 L34.3 15.4 L28.8 32.1 L11.2 32.1 L5.7 15.4 Z" {...props} />
                        {centerHole}
                    </g>
                )
            case 'GROOVING':
                return (
                    <g {...props}>
                        <path d="M10 10 L10 25 L30 25 L30 10" />
                        <rect x="18" y="25" width="4" height="8" fill={fillColor} />
                    </g>
                )
            case 'THREADING':
                return <path d="M10 20 L30 10 L30 30 Z" {...props} />
            default:
                return <circle cx="20" cy="20" r="15" {...props} />
        }
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 40 40"
            className={className}
            style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
            {renderPath()}
        </svg>
    )
}
