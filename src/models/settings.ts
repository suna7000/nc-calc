// 座標系設定
export interface CoordinateSettings {
    xDirection: 1 | -1  // +1: X+が上方向（通常）, -1: X+が下方向
    zDirection: 1 | -1  // +1: Z+が右方向（通常）, -1: Z+が左方向
    xLabel: string      // X軸のラベル（X, U など）
    zLabel: string      // Z軸のラベル（Z, W など）
    diameterMode: boolean // true: 直径指定（通常）, false: 半径指定
    decimalPlaces: 1 | 2 | 3 | 4 // 小数点桁数
    arcOutputMode: 'R' | 'IK'   // 円弧出力形式
}

// 刃先番号（仮想刃先点番号）
//     8      1      2
//      ╲     │     ╱
//    7──+── 0 ──+──3  ← 外径右勝手
//      ╱     │     ╲
//     6      5      4
export type ToolTipNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

// 加工種類
export type MachiningType = 'external' | 'internal' | 'facing' | 'grooving' | 'threading' | 'other'

// チップ形状（ISO記号 + 特殊）
export type InsertShape =
    | 'W'         // 六角形 (80°)
    | 'C'         // 菱形 (80°)
    | 'D'         // 菱形 (55°)
    | 'V'         // 菱形 (35°)
    | 'S'         // 正方形 (90°)
    | 'T'         // 三角形 (60°)
    | 'R'         // 円形 (丸駒)
    | 'K'         // 菱形 (55° 平行四辺形)
    | 'L'         // 長方形 (90°)
    | 'A'         // 菱形 (85°)
    | 'B'         // 菱形 (82°)
    | 'H'         // 正六角形 (120°)
    | 'M'         // 菱形 (86°)
    | 'O'         // 正八角形 (135°)
    | 'P'         // 正五角形 (108°)
    | 'GROOVING'  // 溝入れ
    | 'THREADING' // ねじ切り
    | 'OTHER'     // その他

// 補正方向（手動指定）
export type CompensationDirection = 'auto' | 'G41' | 'G42'

// 工具定義
export interface Tool {
    id: string
    name: string
    type: MachiningType
    insertShape?: InsertShape    // チップ形状アイコン用
    noseRadius: number
    toolTipNumber: ToolTipNumber
    hand: 'right' | 'left' | 'neutral'   // 工具の勝手
    referencePoint?: 'left' | 'center' | 'right' // 基準点（溝入れ用）
    leadAngle?: number    // 主切刃角 (例: 95)
    backAngle?: number    // 副切刃角 (例: 5)
    width?: number        // 工具幅 (溝入れ・ねじ切り用)
}

// 機械設定（G02/G03判定や干渉チェックに影響）
export interface MachineSettings {
    // 刃物台位置: front=前刃物台（手前から加工）, rear=後刃物台（奥から加工）
    toolPost: 'front' | 'rear'
    // 切削方向: +z=Z+方向へ切削, -z=Z-方向へ切削（チャックに向かう）
    cuttingDirection: '+z' | '-z'
    // 工具設定
    activeToolId: string
    toolLibrary: Tool[]
    // 補正設定（ツールから自動取得するが、一時的な調整用に保持）
    noseRCompensation: {
        enabled: boolean
        offsetNumber: number
        compensationDirection: CompensationDirection
        // 補正計算方式: 'geometric'=幾何学的アプローチ, 'smid'=Peter Smid方式
        method: 'geometric' | 'smid'
    }
}


// 全体設定
export interface AllSettings {
    coordinate: CoordinateSettings
    machine: MachineSettings
}

export const defaultCoordinateSettings: CoordinateSettings = {
    xDirection: 1,
    zDirection: 1,
    xLabel: 'X',
    zLabel: 'Z',
    diameterMode: true,
    decimalPlaces: 3,
    arcOutputMode: 'R'
}



export const defaultTools: Tool[] = [
    {
        id: 't01',
        name: '外径荒加工 (W形状)',
        type: 'external',
        insertShape: 'W',
        hand: 'right',
        noseRadius: 0.8,
        toolTipNumber: 3,
        leadAngle: 95,
        backAngle: 5
    },
    {
        id: 't02',
        name: '外径仕上 (D形状)',
        type: 'external',
        insertShape: 'D',
        hand: 'right',
        noseRadius: 0.4,
        toolTipNumber: 3,
        leadAngle: 93,
        backAngle: 32
    },
    {
        id: 't03',
        name: '倣い/V形 (V形状)',
        type: 'external',
        insertShape: 'V',
        hand: 'right',
        noseRadius: 0.4,
        toolTipNumber: 3,
        leadAngle: 93,
        backAngle: 52
    },
    {
        id: 't04',
        name: '溝入れ (3mm幅)',
        type: 'grooving',
        insertShape: 'GROOVING',
        hand: 'neutral',
        referencePoint: 'left',
        noseRadius: 0.2,
        toolTipNumber: 3,
        width: 3.0
    },
    {
        id: 't05',
        name: 'ねじ切り (16ER 汎用)',
        type: 'threading',
        insertShape: 'THREADING',
        hand: 'right',
        noseRadius: 0.1,
        toolTipNumber: 3
    }
]

export const defaultMachineSettings: MachineSettings = {
    toolPost: 'rear',
    cuttingDirection: '-z',
    activeToolId: 't02',
    toolLibrary: defaultTools,
    noseRCompensation: {
        enabled: false,
        offsetNumber: 1,
        compensationDirection: 'auto',
        method: 'geometric'
    }
}

export const defaultSettings: AllSettings = {
    coordinate: defaultCoordinateSettings,
    machine: defaultMachineSettings
}

// 機械プリセット
export const machinePresets: Record<string, MachineSettings> = {
    // 標準的な前刃物台旋盤
    standard_front: {
        toolPost: 'front',
        cuttingDirection: '-z',
        activeToolId: 't02',
        toolLibrary: defaultTools,
        noseRCompensation: {
            enabled: false,
            offsetNumber: 1,
            compensationDirection: 'auto',
            method: 'geometric'
        }
    },
    // 後刃物台旋盤
    standard_rear: {
        toolPost: 'rear',
        cuttingDirection: '-z',
        activeToolId: 't02',
        toolLibrary: defaultTools,
        noseRCompensation: {
            enabled: false,
            offsetNumber: 1,
            compensationDirection: 'auto',
            method: 'geometric'
        }
    },
    // MAZATROL（後刃物台が多い）
    mazatrol: {
        toolPost: 'rear',
        cuttingDirection: '-z',
        activeToolId: 't02',
        toolLibrary: defaultTools,
        noseRCompensation: {
            enabled: false,
            offsetNumber: 1,
            compensationDirection: 'auto',
            method: 'geometric'
        }
    }
}

// 座標系プリセット（後方互換性のため維持）
export const presets: Record<string, CoordinateSettings> = {
    standard: {
        xDirection: 1,
        zDirection: 1,
        xLabel: 'X',
        zLabel: 'Z',
        diameterMode: true,
        decimalPlaces: 3,
        arcOutputMode: 'R'
    },
    mazak: {
        xDirection: 1,
        zDirection: -1,
        xLabel: 'X',
        zLabel: 'Z',
        diameterMode: true,
        decimalPlaces: 3,
        arcOutputMode: 'R'
    },
    fanuc: {
        xDirection: 1,
        zDirection: 1,
        xLabel: 'X',
        zLabel: 'Z',
        diameterMode: true,
        decimalPlaces: 3,
        arcOutputMode: 'R'
    }
}
