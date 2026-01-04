/**
 * 円弧補間計算（I, K値）
 * 
 * I = 円弧中心X - 始点X
 * K = 円弧中心Z - 始点Z
 */

export interface ArcInput {
    startX: number      // 始点X（直径値）
    startZ: number      // 始点Z
    endX: number        // 終点X（直径値）
    endZ: number        // 終点Z
    radius: number      // 円弧半径
    direction: 'CW' | 'CCW'  // CW: G02（時計回り）, CCW: G03（反時計回り）
}

export interface ArcResult {
    i: number           // I値（半径値）
    k: number           // K値
    centerX: number     // 円弧中心X（直径値）
    centerZ: number     // 円弧中心Z
}

/**
 * 2点と半径から円弧中心を計算
 * 旋盤ではX軸は直径値で指定されるが、計算時は半径値に変換
 */
export function calculateArc(input: ArcInput): ArcResult | null {
    // 直径値を半径値に変換
    const x1 = input.startX / 2
    const z1 = input.startZ
    const x2 = input.endX / 2
    const z2 = input.endZ
    const r = input.radius

    // 始点と終点の中点
    const midX = (x1 + x2) / 2
    const midZ = (z1 + z2) / 2

    // 始点から終点までの距離
    const dx = x2 - x1
    const dz = z2 - z1
    const d = Math.sqrt(dx * dx + dz * dz)

    // 半径が小さすぎる場合はエラー
    if (d / 2 > r) {
        return null // 半径が2点間の距離の半分より小さい
    }

    // 中点から円弧中心までの距離
    const h = Math.sqrt(r * r - (d / 2) * (d / 2))

    // 始点-終点に垂直な単位ベクトル
    const perpX = -dz / d
    const perpZ = dx / d

    // 円弧中心座標（旋盤の場合、方向で符号が変わる）
    // CW（G02）: 時計回り、CCW（G03）: 反時計回り
    const sign = input.direction === 'CW' ? 1 : -1
    const centerX = midX + sign * h * perpX
    const centerZ = midZ + sign * h * perpZ

    // I, K値（始点から見た円弧中心までの相対距離）
    const i = centerX - x1  // 半径値での差
    const k = centerZ - z1

    return {
        i: Math.round(i * 1000) / 1000,
        k: Math.round(k * 1000) / 1000,
        centerX: Math.round(centerX * 2 * 1000) / 1000,  // 直径値に戻す
        centerZ: Math.round(centerZ * 1000) / 1000
    }
}

/**
 * 円弧中心座標が既知の場合のI, K値計算
 */
export function calculateIK(
    startX: number,  // 始点X（直径値）
    startZ: number,  // 始点Z
    centerX: number, // 中心X（直径値）
    centerZ: number  // 中心Z
): { i: number; k: number } {
    // 直径値を半径値に変換してI値を計算
    const i = (centerX - startX) / 2
    const k = centerZ - startZ

    return {
        i: Math.round(i * 1000) / 1000,
        k: Math.round(k * 1000) / 1000
    }
}
