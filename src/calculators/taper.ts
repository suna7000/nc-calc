/**
 * テーパー計算
 * 
 * tan(θ) = (X2 - X1) / (Z1 - Z2)
 * または
 * tan(θ) = (直径差 / 2) / 長さ
 */

export interface TaperInput {
    mode: 'angle' | 'ratio' | 'coordinates'
    // 角度モード
    angle?: number        // テーパー角度（度）
    length?: number       // 加工長さ
    startDiameter?: number // 始点直径
    // 勾配モード
    ratio?: string        // 勾配比（例: "1:10"）
    // 座標モード
    startX?: number       // 始点X（直径値）
    startZ?: number       // 始点Z
    endX?: number         // 終点X（直径値）
    endZ?: number         // 終点Z
}

export interface TaperResult {
    angle: number         // テーパー角度（度）
    ratio: string         // 勾配比
    diameterChange: number // 直径変化量
    startX?: number
    startZ?: number
    endX?: number
    endZ?: number
}

/**
 * 角度から座標を計算
 */
export function calculateFromAngle(
    angle: number,
    length: number,
    startDiameter: number
): TaperResult {
    const radians = (angle * Math.PI) / 180
    const radiusChange = length * Math.tan(radians)
    const diameterChange = radiusChange * 2
    const endDiameter = startDiameter + diameterChange

    // 勾配比を計算（1:n形式）
    const ratioValue = 1 / Math.tan(radians)
    const ratioStr = `1:${Math.round(ratioValue * 10) / 10}`

    return {
        angle: Math.round(angle * 1000) / 1000,
        ratio: ratioStr,
        diameterChange: Math.round(diameterChange * 1000) / 1000,
        startX: startDiameter,
        startZ: 0,
        endX: Math.round(endDiameter * 1000) / 1000,
        endZ: -length
    }
}

/**
 * 勾配比から角度を計算
 */
export function calculateFromRatio(
    ratio: string,
    length: number,
    startDiameter: number
): TaperResult | null {
    const match = ratio.match(/1:(\d+\.?\d*)/)
    if (!match) return null

    const ratioValue = parseFloat(match[1])
    const angle = Math.atan(1 / ratioValue) * (180 / Math.PI)

    return calculateFromAngle(angle, length, startDiameter)
}

/**
 * 座標からテーパー角度を計算
 */
export function calculateFromCoordinates(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number
): TaperResult {
    const dx = Math.abs(endX - startX) / 2  // 半径差
    const dz = Math.abs(endZ - startZ)       // 長さ

    const angle = Math.atan(dx / dz) * (180 / Math.PI)
    const ratioValue = dz / dx
    const ratioStr = ratioValue >= 1 ? `1:${Math.round(ratioValue * 10) / 10}` : `${Math.round((1 / ratioValue) * 10) / 10}:1`

    return {
        angle: Math.round(angle * 1000) / 1000,
        ratio: ratioStr,
        diameterChange: Math.round((endX - startX) * 1000) / 1000,
        startX,
        startZ,
        endX,
        endZ
    }
}

/**
 * メイン計算関数
 */
export function calculateTaper(input: TaperInput): TaperResult | null {
    switch (input.mode) {
        case 'angle':
            if (input.angle === undefined || input.length === undefined || input.startDiameter === undefined) {
                return null
            }
            return calculateFromAngle(input.angle, input.length, input.startDiameter)

        case 'ratio':
            if (!input.ratio || input.length === undefined || input.startDiameter === undefined) {
                return null
            }
            return calculateFromRatio(input.ratio, input.length, input.startDiameter)

        case 'coordinates':
            if (input.startX === undefined || input.startZ === undefined ||
                input.endX === undefined || input.endZ === undefined) {
                return null
            }
            return calculateFromCoordinates(input.startX, input.startZ, input.endX, input.endZ)

        default:
            return null
    }
}
