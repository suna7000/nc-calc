// 計算タイプ（将来の機能拡張用）
export type CalculatorType = 'arc' | 'taper' | 'chamfer' | 'groove' | 'advancedGeo'


interface CalculatorSelectorProps {
    onSelect: (type: CalculatorType) => void
}

const calculators = [
    {
        type: 'arc' as CalculatorType,
        icon: '◠',
        title: '円弧補間',
        desc: 'I, K値計算'
    },
    {
        type: 'taper' as CalculatorType,
        icon: '⟋',
        title: 'テーパー',
        desc: '角度・座標計算'
    },
    {
        type: 'chamfer' as CalculatorType,
        icon: '⌐',
        title: '面取り',
        desc: 'C面取り・R面取り'
    },
    {
        type: 'groove' as CalculatorType,
        icon: '⊔',
        title: '溝入れ',
        desc: '溝座標計算'
    },
    /* {
        type: 'advancedGeo' as CalculatorType,
        icon: '📐',
        title: '高度幾何',
        desc: '交点・逆算・中心特定'
    } */
]

export function CalculatorSelector({ onSelect }: CalculatorSelectorProps) {
    return (
        <div className="calculator-selector">
            <p className="selector-title">計算する項目を選択してください</p>

            <div className="calculator-grid">
                {calculators.map((calc) => (
                    <button
                        key={calc.type}
                        className="calculator-card"
                        onClick={() => onSelect(calc.type)}
                    >
                        <span className="calculator-card-icon">{calc.icon}</span>
                        <span className="calculator-card-title">{calc.title}</span>
                        <span className="calculator-card-desc">{calc.desc}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
