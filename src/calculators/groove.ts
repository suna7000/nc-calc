/**
 * 溝入れ計算
 * - 通常の底R（角R）
 * - 完全R形状（U字溝、Oリング溝）
 * - R > 溝深さの場合の幾何学計算
 */

export interface GrooveInput {
    type: 'single' | 'multiple'  // 単一溝 or 複数溝
    diameter: number             // 加工位置の直径
    width: number                // 溝幅
    depth: number                // 溝深さ
    startZ: number               // 開始Z位置
    // 複数溝用
    count?: number               // 溝の数
    pitch?: number               // 溝ピッチ
    // オプション
    cornerR?: number             // 底R（隅R）
    fullR?: boolean              // 完全R形状（U字溝）モード
    arcBottomR?: number          // 指定Rによる円弧底モード
    toolWidth?: number           // 工具幅
    noseRadius?: number          // 工具ノーズR
    referencePoint?: 'left' | 'center' | 'right' // 基準点
}

export interface GrooveResult {
    grooves: GrooveCoordinate[]
    toolWidth?: number           // 推奨ツール幅
    grooveType?: 'normal' | 'corner-r' | 'full-r' | 'arc-bottom'  // 溝タイプ
}

export interface GrooveCoordinate {
    index: number
    // 溝開始位置
    entryX: number      // 進入X（直径値）
    entryZ: number      // 進入Z
    // 溝底位置
    bottomX: number     // 底X（直径値）
    bottomZ: number     // 底Z
    // 溝終了位置
    exitZ: number       // 退避Z
    // 形状タイプ
    shapeType: 'rectangular' | 'corner-r' | 'full-r' | 'arc-bottom'
    // 隅R（底R）情報 - 通常の底R用
    cornerR?: {
        leftArc: ArcData
        rightArc: ArcData
    }
    // 完全R形状用（U字溝など）
    fullRArc?: ArcData
}

export interface ArcData {
    startX: number
    startZ: number
    endX: number
    endZ: number
    centerX: number  // 円弧中心X（直径値）
    centerZ: number  // 円弧中心Z
    radius: number   // 半径
    i: number        // I値（半径指定）
    k: number        // K値
    gCode: 'G02' | 'G03'
}

/**
 * 単一溝の座標計算
 * 工具の幅、ノーズR、基準位置、および底Rの幾何学を考慮
 */
export function calculateSingleGroove(
    diameter: number,
    width: number,
    depth: number,
    startZ: number,
    fullR: boolean = false,
    arcBottomR: number = 0,
    toolWidth: number = 0,
    noseRadius: number = 0,
    referencePoint: 'left' | 'center' | 'right' = 'left'
): GrooveCoordinate {
    const bottomDiameter = diameter - depth * 2

    // 1. 工具基準位置によるZ座標の補正
    let zOffset = 0
    if (referencePoint === 'center') {
        zOffset = toolWidth / 2
    } else if (referencePoint === 'right') {
        zOffset = toolWidth
    }

    const progStartZ = startZ + zOffset
    const progEndZ = progStartZ - width

    const result: GrooveCoordinate = {
        index: 1,
        entryX: diameter,
        entryZ: round(progStartZ),
        bottomX: round(bottomDiameter),
        bottomZ: round((progStartZ + progEndZ) / 2),
        exitZ: round(progEndZ),
        shapeType: 'rectangular'
    }

    // 2. 完全R形状（U字溝）の場合
    if (fullR) {
        const R = width / 2
        const centerZ = progStartZ - R
        const arcBottomDiameter = diameter - R * 2
        result.bottomX = round(arcBottomDiameter)
        result.shapeType = 'full-r'

        // ノーズR補正を考慮したプログラム用円弧
        const progR = Math.max(0, R - noseRadius)

        result.fullRArc = {
            startX: diameter,
            startZ: round(progStartZ),
            endX: diameter,
            endZ: round(progEndZ),
            centerX: diameter,
            centerZ: round(centerZ),
            radius: progR,
            i: 0,
            k: round(-progR),
            gCode: 'G02'
        }
        return result
    }

    // 4. 指定Rによる円弧底の場合（Peter Smid理論）
    if (arcBottomR && arcBottomR > 0) {
        return calculateGrooveArcBottom(result, bottomDiameter, progStartZ, width, arcBottomR, noseRadius)
    }

    return result
}

/**
 * Peter Smid氏の理論に基づく円弧底溝（指定R）の計算
 * 幅W, 深さD, 半径R, ノーズR r からパスを算出
 */
function calculateGrooveArcBottom(
    result: GrooveCoordinate,
    bottomDiameter: number,
    progStartZ: number,
    width: number,
    R: number,
    r: number
): GrooveCoordinate {
    result.shapeType = 'arc-bottom'

    const W = width

    // 1. 幾何学的妥当性のチェック
    if (R < W / 2) R = W / 2 // 半径が最小幅未満なら完全Rとして扱う

    // 2. 円弧の高さ（サジッタ）の算出
    // s = R - sqrt(R^2 - (W/2)^2)
    const halfW = W / 2
    const sagitta = R - Math.sqrt(Math.max(0, R * R - halfW * halfW))

    // 3. ノーズR補正（Concave Arc Compensation）
    // パス半径 R' = R - r
    const progR = Math.max(0, R - r)

    // 4. 座標の算出（中心ベース、Zは開始点基準）
    // 円弧開始点（直径）： X = bottomDiameter + 2 * sagitta
    // 頂点（直径）： X = bottomDiameter
    const arcStartX = round(bottomDiameter + sagitta * 2)

    // 仮想刃先3番（外径・左基準）を想定した補正
    // 実際には工具中心ベースで計算し、TIP3のオフセットを引く
    // Z方向：左壁 = progStartZ, 頂点 = progStartZ - W/2

    result.fullRArc = {
        startX: round(arcStartX),
        startZ: round(progStartZ),
        endX: round(arcStartX),
        endZ: round(progStartZ - W),
        centerX: round(bottomDiameter + R * 2), // 円弧の中心（頂点からR上）
        centerZ: round(progStartZ - halfW),
        radius: progR,
        i: round(R - sagitta), // Iは開始点から中心へのX距離（半径値）
        k: round(-halfW),      // Kは開始点から中心へのZ距離
        gCode: 'G02'
    }

    result.bottomX = round(bottomDiameter)
    return result
}

/**
 * 隅R計算（R > 深さ対応 & ノーズR補正対応）
 */
/*
function calculateCornerRWithNose(
    result: GrooveCoordinate,
    diameter: number,
    bottomDiameter: number,
    progStartZ: number,
    width: number,
    R: number,
    r: number
): GrooveCoordinate {
    result.shapeType = 'corner-r'

    // プログラム用半径（隅Rの場合、パス半径 R' = R - r）
    const progR = Math.max(0, R - r)
    const d = (diameter - bottomDiameter) / 2 // 深さ（半径値）

    // --- 左側（壁面 → 底面） ---
    // 理想的な円弧の中心：底面からR上、壁面からR左
    const centerX_L = bottomDiameter + R * 2
    const centerZ_L = progStartZ - R

    let leftStartX, leftStartZ, leftEndX, leftEndZ, leftK

    if (R <= d) {
        // 標準ケース：垂直壁に接する
        const startX_prog = bottomDiameter + progR * 2
        const endZ_prog = progStartZ - progR

        leftStartX = round(startX_prog)
        leftStartZ = round(progStartZ)
        leftEndX = round(bottomDiameter)
        leftEndZ = round(endZ_prog)
        leftK = -progR
    } else {
        // 特殊ケース：R > 深さ のため、ワーク表面と交差する
        const L_prime = Math.sqrt(Math.max(0, 2 * progR * d - d * d))

        leftStartX = round(diameter)
        leftStartZ = round(centerZ_L + L_prime + r) // 表面でのZ位置（補正込み）
        leftEndX = round(bottomDiameter)
        leftEndZ = round(centerZ_L + r) // 底部でのZ位置（補正込み）
        leftK = -L_prime
    }

    // --- 右側（底面 → 壁面） ---
    // 理想的な円弧の中心：底面からR上、壁面からR右
    const centerX_R = bottomDiameter + R * 2
    const centerZ_R = progStartZ - width + R

    let rightStartX, rightStartZ, rightEndX, rightEndZ, rightI

    if (R <= d) {
        const startZ_prog = progStartZ - width + progR
        const endX_prog = bottomDiameter + progR * 2

        rightStartX = round(bottomDiameter)
        rightStartZ = round(startZ_prog)
        rightEndX = round(endX_prog)
        rightEndZ = round(progStartZ - width)
        rightI = progR
    } else {
        const L_prime = Math.sqrt(Math.max(0, 2 * progR * d - d * d))

        rightStartX = round(bottomDiameter)
        rightStartZ = round(centerZ_R - r)
        rightEndX = round(diameter)
        rightEndZ = round(centerZ_R - L_prime - r)
        rightI = L_prime
    }

    result.cornerR = {
        leftArc: {
            startX: leftStartX,
            startZ: leftStartZ,
            endX: leftEndX,
            endZ: leftEndZ,
            centerX: round(centerX_L),
            centerZ: round(centerZ_L),
            radius: progR,
            i: 0,
            k: round(leftK),
            gCode: 'G02'
        },
        rightArc: {
            startX: rightStartX,
            startZ: rightStartZ,
            endX: rightEndX,
            endZ: rightEndZ,
            centerX: round(centerX_R),
            centerZ: round(centerZ_R),
            radius: progR,
            i: round(rightI),
            k: 0,
            gCode: 'G03'
        }
    }

    return result
}
*/


/**
 * 丸め関数
 */
function round(value: number): number {
    return Math.round(value * 1000) / 1000
}

/**
 * 複数溝の座標計算
 */
export function calculateMultipleGrooves(
    diameter: number,
    width: number,
    depth: number,
    startZ: number,
    count: number,
    pitch: number,
    fullR: boolean = false,
    arcBottomR: number = 0,
    toolWidth: number = 0,
    noseRadius: number = 0,
    referencePoint: 'left' | 'center' | 'right' = 'left'
): GrooveCoordinate[] {
    const grooves: GrooveCoordinate[] = []

    for (let i = 0; i < count; i++) {
        const grooveStartZ = startZ - i * pitch
        const groove = calculateSingleGroove(
            diameter,
            width,
            depth,
            grooveStartZ,
            fullR,
            arcBottomR,
            toolWidth,
            noseRadius,
            referencePoint
        )
        groove.index = i + 1
        grooves.push(groove)
    }

    return grooves
}

/**
 * メイン計算関数
 */
export function calculateGroove(input: GrooveInput): GrooveResult {
    const tWidth = input.toolWidth || 0
    const noseR = input.noseRadius || 0
    const ref = input.referencePoint || 'left'
    const fullR = input.fullR || false
    const arcBottomR = input.arcBottomR || 0

    if (input.type === 'single') {
        const groove = calculateSingleGroove(
            input.diameter,
            input.width,
            input.depth,
            input.startZ,
            fullR,
            arcBottomR,
            tWidth,
            noseR,
            ref
        )
        return {
            grooves: [groove],
            toolWidth: tWidth || input.width,
            grooveType: groove.shapeType === 'full-r' ? 'full-r' :
                groove.shapeType === 'arc-bottom' ? 'arc-bottom' :
                    groove.shapeType === 'corner-r' ? 'corner-r' : 'normal'
        }
    } else {
        if (!input.count || !input.pitch) {
            return { grooves: [] }
        }

        const grooves = calculateMultipleGrooves(
            input.diameter,
            input.width,
            input.depth,
            input.startZ,
            input.count,
            input.pitch,
            fullR,
            arcBottomR,
            tWidth,
            noseR,
            ref
        )
        return {
            grooves,
            toolWidth: tWidth || (input.width <= 4 ? input.width : 4),
            grooveType: grooves[0]?.shapeType === 'full-r' ? 'full-r' :
                grooves[0]?.shapeType === 'arc-bottom' ? 'arc-bottom' :
                    grooves[0]?.shapeType === 'corner-r' ? 'corner-r' : 'normal'
        }
    }
}
