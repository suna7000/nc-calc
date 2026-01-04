/**
 * 点ベース形状ビルダーのデータモデル
 * MAZATROLのS corner / F corner方式を参考に設計
 */

// 角処理タイプ
// none: なし
// sumi-r: 隅R（内角のR）
// kaku-r: 角R（外角のR）
// kaku-c: 角C（外角の面取り）
export type CornerType = 'none' | 'sumi-r' | 'kaku-r' | 'kaku-c'

// 隅処理情報
export interface CornerTreatment {
    type: CornerType
    size: number  // RまたはCのサイズ
    // 連続R（2つ目の円弧）- 円弧→円弧の接続用
    secondArc?: {
        type: CornerType  // 'sumi-r' | 'kaku-r' のみ有効
        size: number
    }
}


// 座標点（隅処理情報を含む）
export interface Point {
    id: string
    x: number  // 直径値
    z: number
    // この点に到達する際の隅処理（MAZATROL の F corner に相当）
    corner: CornerTreatment
}

// 要素の計算結果
export interface SegmentCalculation {
    // 円弧の場合
    i?: number
    k?: number
    centerX?: number
    centerZ?: number
    // テーパー角度
    angle?: number
}

// 隅処理の計算結果
export interface CornerCalculation {
    // 元の点の代わりに使用する座標
    entryX: number   // 隅処理開始点X
    entryZ: number   // 隅処理開始点Z
    exitX: number    // 隅処理終了点X
    exitZ: number    // 隅処理終了点Z
    // Rの場合のI, K値
    i?: number
    k?: number
    centerX?: number
    centerZ?: number
    isLeftTurn?: boolean
    distToVertex?: number // 仮想交点（カド）からの戻り量
}

// 形状全体
export interface Shape {
    points: Point[]
}

// 新しい点を作成
export function createPoint(
    x: number,
    z: number,
    corner: CornerTreatment = { type: 'none', size: 0 }
): Point {
    return {
        id: crypto.randomUUID(),
        x,
        z,
        corner
    }
}

// 空の形状を作成
export function createEmptyShape(): Shape {
    return {
        points: []
    }
}

// 隅処理なしのデフォルト値
export function noCorner(): CornerTreatment {
    return { type: 'none', size: 0 }
}

// 隅R処理を作成（内角）
export function sumiR(size: number): CornerTreatment {
    return { type: 'sumi-r', size }
}

// 角R処理を作成（外角）
export function kakuR(size: number): CornerTreatment {
    return { type: 'kaku-r', size }
}

// 角C処理を作成（面取り）
export function kakuC(size: number): CornerTreatment {
    return { type: 'kaku-c', size }
}

// 後方互換性のためのエイリアス
export const cornerR = sumiR
export const cornerC = kakuC
