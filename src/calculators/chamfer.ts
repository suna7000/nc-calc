/**
 * 面取り・R面取り計算
 */

export interface ChamferInput {
    type: 'c' | 'r'       // C面取り or R面取り
    size: number          // 面取りサイズ（CならC値、RならR値）
    startX: number        // 始点X（直径値）
    startZ: number        // 始点Z
    direction: 'outer' | 'inner'  // 外径側 or 内径側
    edgeType: 'end' | 'shoulder'  // 端面 or 肩
}

export interface ChamferResult {
    type: 'c' | 'r'
    size: number
    // 面取り開始点
    point1X: number
    point1Z: number
    // 面取り終了点
    point2X: number
    point2Z: number
    // R面取りの場合の円弧データ
    arcCenter?: { x: number; z: number }
    i?: number
    k?: number
}

/**
 * C面取り計算
 * 45度の面取り
 */
export function calculateCChamfer(
    size: number,
    startX: number,
    startZ: number,
    direction: 'outer' | 'inner',
    edgeType: 'end' | 'shoulder'
): ChamferResult {
    let point1X: number
    let point1Z: number
    let point2X: number
    let point2Z: number

    if (edgeType === 'end') {
        // 端面の面取り
        if (direction === 'outer') {
            // 外径端面
            point1X = startX
            point1Z = startZ - size
            point2X = startX - size * 2  // 直径値なので2倍
            point2Z = startZ
        } else {
            // 内径端面
            point1X = startX
            point1Z = startZ - size
            point2X = startX + size * 2
            point2Z = startZ
        }
    } else {
        // 肩の面取り
        if (direction === 'outer') {
            point1X = startX + size * 2
            point1Z = startZ
            point2X = startX
            point2Z = startZ - size
        } else {
            point1X = startX - size * 2
            point1Z = startZ
            point2X = startX
            point2Z = startZ - size
        }
    }

    return {
        type: 'c',
        size,
        point1X: Math.round(point1X * 1000) / 1000,
        point1Z: Math.round(point1Z * 1000) / 1000,
        point2X: Math.round(point2X * 1000) / 1000,
        point2Z: Math.round(point2Z * 1000) / 1000
    }
}

/**
 * R面取り計算
 */
export function calculateRChamfer(
    radius: number,
    startX: number,
    startZ: number,
    direction: 'outer' | 'inner',
    edgeType: 'end' | 'shoulder'
): ChamferResult {
    let point1X: number
    let point1Z: number
    let point2X: number
    let point2Z: number
    let centerX: number
    let centerZ: number

    if (edgeType === 'end') {
        if (direction === 'outer') {
            // 外径端面R
            point1X = startX
            point1Z = startZ - radius
            point2X = startX - radius * 2
            point2Z = startZ
            centerX = startX - radius * 2
            centerZ = startZ - radius
        } else {
            // 内径端面R
            point1X = startX
            point1Z = startZ - radius
            point2X = startX + radius * 2
            point2Z = startZ
            centerX = startX + radius * 2
            centerZ = startZ - radius
        }
    } else {
        // 肩R
        if (direction === 'outer') {
            point1X = startX + radius * 2
            point1Z = startZ
            point2X = startX
            point2Z = startZ - radius
            centerX = startX
            centerZ = startZ
        } else {
            point1X = startX - radius * 2
            point1Z = startZ
            point2X = startX
            point2Z = startZ - radius
            centerX = startX
            centerZ = startZ
        }
    }

    // I, K値計算（始点からの相対座標）
    const i = (centerX - point1X) / 2  // 半径値
    const k = centerZ - point1Z

    return {
        type: 'r',
        size: radius,
        point1X: Math.round(point1X * 1000) / 1000,
        point1Z: Math.round(point1Z * 1000) / 1000,
        point2X: Math.round(point2X * 1000) / 1000,
        point2Z: Math.round(point2Z * 1000) / 1000,
        arcCenter: {
            x: Math.round(centerX * 1000) / 1000,
            z: Math.round(centerZ * 1000) / 1000
        },
        i: Math.round(i * 1000) / 1000,
        k: Math.round(k * 1000) / 1000
    }
}

/**
 * メイン計算関数
 */
export function calculateChamfer(input: ChamferInput): ChamferResult {
    if (input.type === 'c') {
        return calculateCChamfer(input.size, input.startX, input.startZ, input.direction, input.edgeType)
    } else {
        return calculateRChamfer(input.size, input.startX, input.startZ, input.direction, input.edgeType)
    }
}
