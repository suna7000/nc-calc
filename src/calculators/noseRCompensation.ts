/**
 * ノーズR補正計算
 * 
 * テーパー→円弧、円弧→テーパー、円弧→円弧の正確な接点計算
 */

// ノーズR補正設定
export interface NoseRCompensationInput {
    noseRadius: number           // ノーズR値 (mm)
    isExternalMachining: boolean // 外径加工か（内径加工は逆方向に補正）
}

// セグメントタイプ
export type SegmentType = 'line' | 'taper' | 'arc'

// セグメント定義
export interface Segment {
    type: SegmentType
    startX: number  // 直径値
    startZ: number
    endX: number    // 直径値
    endZ: number
    // 円弧の場合
    centerX?: number  // 直径値
    centerZ?: number
    radius?: number
    isConvex?: boolean  // 凸（角R）か凹（隅R）か
}

// 補正済みセグメント
export interface CompensatedSegment extends Segment {
    // 補正後の座標
    compensatedStartX: number
    compensatedStartZ: number
    compensatedEndX: number
    compensatedEndZ: number
    // 補正後の円弧パラメータ
    compensatedCenterX?: number
    compensatedCenterZ?: number
    compensatedRadius?: number
    compensatedI?: number
    compensatedK?: number
}

/**
 * 直線（テーパー）のノーズRオフセットを計算
 * 
 * 直線に対して垂直方向にノーズR分オフセット
 * 
 * @param startX 開始X（直径値）
 * @param startZ 開始Z
 * @param endX 終了X（直径値）
 * @param endZ 終了Z
 * @param noseR ノーズR
 * @param isExternal 外径加工か
 */
export function calculateLineOffset(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    noseR: number,
    isExternal: boolean
): { offsetX: number; offsetZ: number; angle: number } {
    // 半径値で計算
    const x1 = startX / 2
    const x2 = endX / 2

    // ベクトル（直線方向）
    const dx = x2 - x1
    const dz = endZ - startZ
    const len = Math.sqrt(dx * dx + dz * dz)

    if (len === 0) {
        return { offsetX: 0, offsetZ: 0, angle: 0 }
    }

    // テーパー角度（Z軸からの角度）
    const angle = Math.atan2(Math.abs(dx), Math.abs(dz))

    // 法線ベクトル（直線に垂直）
    // 外径加工: ワーク側と反対（X+方向）にオフセット
    // 内径加工: ワーク側と反対（X-方向）にオフセット
    const sign = isExternal ? 1 : -1

    // 法線方向の単位ベクトル（直線に垂直）
    // 直線方向(dx, dz)に対して垂直は (-dz, dx) または (dz, -dx)
    const nx = -dz / len * sign
    const nz = dx / len * sign

    // オフセット量
    const offsetX = noseR * nx * 2  // 直径値に変換
    const offsetZ = noseR * nz

    return {
        offsetX,
        offsetZ,
        angle: angle * (180 / Math.PI)  // 度数に変換
    }
}

/**
 * Peter Smid方式：テーパー角度に基づく手計算用補正シフト量 (Chapter 27)
 * 
 * @param theta ワーク軸に対するテーパー角度（度）
 * @param noseR ノーズR
 */
export function calculateSmidManualShifts(
    theta: number,
    noseR: number
): { deltaX: number; deltaZ: number } {
    const rad = theta * (Math.PI / 180)
    // 補正角 = (90 - θ) / 2
    const compAngle = (Math.PI / 2 - rad) / 2

    const deltaZ = noseR * Math.tan(compAngle)
    const deltaX = 2 * noseR * (1 - Math.tan(compAngle) * Math.tan(rad))

    return {
        deltaX: Math.round(deltaX * 1000) / 1000,
        deltaZ: Math.round(deltaZ * 1000) / 1000
    }
}

/**
 * Peter Smid方式：正弦定理を用いた二直線の交点算出 (Chapter 26)
 * 
 * @param p1 点1
 * @param angle1 角度1（度）
 * @param p2 点2
 * @param angle2 角度2（度）
 */
export function calculateIntersectionSineLaw(
    p1: { x: number; z: number },
    angle1: number,
    p2: { x: number; z: number },
    angle2: number
): { x: number; z: number } | null {
    // 進行方向ベクトル
    const r1 = angle1 * (Math.PI / 180)
    const r2 = angle2 * (Math.PI / 180)

    const dx = p2.x / 2 - p1.x / 2
    const dz = p2.z - p1.z
    const L = Math.sqrt(dx * dx + dz * dz)
    const baseAngle = Math.atan2(dx, dz)

    // 三角形の角
    const A = r1 - baseAngle
    const B = baseAngle - r2
    const C = Math.PI - (A + B)

    if (Math.abs(Math.sin(C)) < 1e-9) return null

    // 正弦定理: Side1 / sin(B) = L / sin(C)
    const dist1 = L * Math.sin(B) / Math.sin(C)

    return {
        x: (p1.x / 2 + dist1 * Math.sin(r1)) * 2,
        z: p1.z + dist1 * Math.cos(r1)
    }
}

/**
 * 円弧のノーズRオフセットを計算
 * 
 * 隅R（凹）= 工具経路半径 = ワーク半径 - ノーズR
 * 角R（凸）= 工具経路半径 = ワーク半径 + ノーズR
 * 
 * @param centerX 円弧中心X（直径値）
 * @param centerZ 円弧中心Z
 * @param radius 円弧半径
 * @param isConvex 凸形状（角R）か凹形状（隅R）か
 * @param noseR ノーズR
 * @param isExternal 外径加工か
 */
export function calculateArcOffset(
    _centerX: number,
    _centerZ: number,
    radius: number,
    isConvex: boolean,
    noseR: number,
    isExternal: boolean
): { compensatedRadius: number } {
    // 凸（角R）: 工具経路半径 = ワーク半径 + ノーズR
    // 凹（隅R）: 工具経路半径 = ワーク半径 - ノーズR
    // 外径/内径加工による符号反転も考慮

    let compensatedRadius: number

    if (isConvex) {
        // 角R（凸）
        compensatedRadius = isExternal
            ? radius + noseR   // 外径: 外側に膨らむ
            : radius - noseR   // 内径: 内側に膨らむ
    } else {
        // 隅R（凹）
        compensatedRadius = isExternal
            ? radius - noseR   // 外径: 内側に入る
            : radius + noseR   // 内径: 外側に入る
    }

    // 半径が負になる場合は警告（ノーズRが大きすぎる）
    if (compensatedRadius <= 0) {
        console.warn(`ノーズR(${noseR})がワーク半径(${radius})より大きいため補正できません`)
        compensatedRadius = 0.001  // 最小値
    }

    return { compensatedRadius }
}

/**
 * テーパー → 円弧 の接点計算（ノーズR補正込み）
 * 
 * 計算式:
 * Xp = Φ + 2R(1 - sin(θ)) × tan(θ)
 * Zp = Z_center - (1 - sin(θ)) × R
 * 
 * @param taperAngle テーパー角度（度数、Z軸からの角度）
 * @param arcCenterX 円弧中心X（直径値）
 * @param arcCenterZ 円弧中心Z
 * @param arcRadius 円弧半径
 * @param isConvex 凸形状（角R）か
 * @param noseR ノーズR
 * @param isExternal 外径加工か
 * @param approachFromPositiveZ テーパーが+Z側から来るか
 */
export function calculateTaperToArcTangent(
    taperAngle: number,
    arcCenterX: number,
    arcCenterZ: number,
    arcRadius: number,
    isConvex: boolean,
    noseR: number,
    isExternal: boolean,
    approachFromPositiveZ: boolean
): { tangentX: number; tangentZ: number; compensatedTangentX: number; compensatedTangentZ: number } {
    // 角度をラジアンに変換
    const theta = taperAngle * (Math.PI / 180)
    const sinTheta = Math.sin(theta)
    const tanTheta = Math.tan(theta)

    // 補正後の円弧半径
    const { compensatedRadius } = calculateArcOffset(
        arcCenterX, arcCenterZ, arcRadius, isConvex, noseR, isExternal
    )

    // Smid氏の公式: 直径基準 (Chapter 25)
    // テーパー角度に対する接点シフト量
    const xOffset = 2 * arcRadius * (1 - sinTheta) * tanTheta
    const zOffset = arcRadius * (1 - sinTheta)

    // 方向による符号調整
    const xSign = isExternal ? 1 : -1
    const zSign = approachFromPositiveZ ? -1 : 1

    const tangentX = arcCenterX + xOffset * xSign
    const tangentZ = arcCenterZ + zOffset * zSign

    // 補正後の接点（工具中心軌跡）
    const compX = arcCenterX + 2 * compensatedRadius * (1 - sinTheta) * tanTheta * xSign
    const compZ = arcCenterZ + compensatedRadius * (1 - sinTheta) * zSign

    return {
        tangentX: round3(tangentX),
        tangentZ: round3(tangentZ),
        compensatedTangentX: round3(compX),
        compensatedTangentZ: round3(compZ)
    }
}

/**
 * 円弧 → テーパー の接点計算（ノーズR補正込み）
 * 
 * テーパー→円弧の逆パターン
 */
export function calculateArcToTaperTangent(
    taperAngle: number,
    arcCenterX: number,
    arcCenterZ: number,
    arcRadius: number,
    isConvex: boolean,
    noseR: number,
    isExternal: boolean,
    exitToPositiveZ: boolean
): { tangentX: number; tangentZ: number; compensatedTangentX: number; compensatedTangentZ: number } {
    // テーパー→円弧と同じ計算を使用（方向が逆）
    return calculateTaperToArcTangent(
        taperAngle,
        arcCenterX,
        arcCenterZ,
        arcRadius,
        isConvex,
        noseR,
        isExternal,
        !exitToPositiveZ  // 方向反転
    )
}

/**
 * 円弧 → 円弧 の接点計算（ノーズR補正込み）
 * 
 * 2つの円弧中心を結ぶ線上に接点がある
 * 接点 = C1 + (C2 - C1) × R1 / (R1 + R2)
 * 
 * @param arc1CenterX 円弧1の中心X（直径値）
 * @param arc1CenterZ 円弧1の中心Z
 * @param arc1Radius 円弧1の半径
 * @param arc1IsConvex 円弧1が凸か
 * @param arc2CenterX 円弧2の中心X（直径値）
 * @param arc2CenterZ 円弧2の中心Z
 * @param arc2Radius 円弧2の半径
 * @param arc2IsConvex 円弧2が凸か
 * @param noseR ノーズR
 * @param isExternal 外径加工か
 */
export function calculateArcToArcTangent(
    arc1CenterX: number,
    arc1CenterZ: number,
    arc1Radius: number,
    arc1IsConvex: boolean,
    arc2CenterX: number,
    arc2CenterZ: number,
    arc2Radius: number,
    arc2IsConvex: boolean,
    noseR: number,
    isExternal: boolean
): {
    tangentX: number;
    tangentZ: number;
    compensatedTangentX: number;
    compensatedTangentZ: number
} {
    // 半径値に変換
    const c1x = arc1CenterX / 2
    const c1z = arc1CenterZ
    const c2x = arc2CenterX / 2
    const c2z = arc2CenterZ

    // 2つの中心を結ぶベクトル
    const dx = c2x - c1x
    const dz = c2z - c1z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist === 0) {
        // 中心が同じ場合
        return {
            tangentX: arc1CenterX,
            tangentZ: arc1CenterZ,
            compensatedTangentX: arc1CenterX,
            compensatedTangentZ: arc1CenterZ
        }
    }

    // 接点計算（ワーク形状上）
    // R1とR2の比率で分割
    const r1 = arc1Radius
    const r2 = arc2Radius
    const ratio = r1 / (r1 + r2)

    const tangentX_r = c1x + dx * ratio
    const tangentZ = c1z + dz * ratio

    // 補正後の円弧半径
    const { compensatedRadius: cr1 } = calculateArcOffset(
        arc1CenterX, arc1CenterZ, arc1Radius, arc1IsConvex, noseR, isExternal
    )
    const { compensatedRadius: cr2 } = calculateArcOffset(
        arc2CenterX, arc2CenterZ, arc2Radius, arc2IsConvex, noseR, isExternal
    )

    // 補正後の接点計算
    const compensatedRatio = cr1 / (cr1 + cr2)
    const compensatedTangentX_r = c1x + dx * compensatedRatio
    const compensatedTangentZ = c1z + dz * compensatedRatio

    return {
        tangentX: round3(tangentX_r * 2),  // 直径値に戻す
        tangentZ: round3(tangentZ),
        compensatedTangentX: round3(compensatedTangentX_r * 2),
        compensatedTangentZ: round3(compensatedTangentZ)
    }
}

/**
 * 小数点3桁に丸める
 */
function round3(value: number): number {
    return Math.round(value * 1000) / 1000
}

/**
 * 補正済みI, K値を計算
 * 
 * @param startX 開始X（直径値、補正後）
 * @param startZ 開始Z（補正後）
 * @param centerX 中心X（直径値）
 * @param centerZ 中心Z
 */
export function calculateCompensatedIK(
    startX: number,
    startZ: number,
    centerX: number,
    centerZ: number
): { i: number; k: number } {
    // I, Kは開始点から中心への相対距離（半径値）
    const i = centerX / 2 - startX / 2
    const k = centerZ - startZ

    return {
        i: round3(i),
        k: round3(k)
    }
}
