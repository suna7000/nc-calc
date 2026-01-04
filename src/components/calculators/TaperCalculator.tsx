import { useState } from 'react'
import { calculateTaper, type TaperResult } from '../../calculators/taper'

interface TaperCalculatorProps {
    onBack: () => void
}

type Mode = 'angle' | 'coordinates'
type Step = 'mode' | 'angle' | 'length' | 'startDiameter' | 'startX' | 'startZ' | 'endX' | 'endZ' | 'result'

export function TaperCalculator({ onBack }: TaperCalculatorProps) {
    const [mode, setMode] = useState<Mode | null>(null)
    const [currentStep, setCurrentStep] = useState<Step>('mode')
    const [values, setValues] = useState<Record<string, number>>({})
    const [result, setResult] = useState<TaperResult | null>(null)
    const [inputValue, setInputValue] = useState('')

    const angleSteps: Step[] = ['angle', 'length', 'startDiameter']
    const coordSteps: Step[] = ['startX', 'startZ', 'endX', 'endZ']

    const getSteps = (): Step[] => {
        if (!mode) return ['mode']
        return mode === 'angle' ? ['mode', ...angleSteps, 'result'] : ['mode', ...coordSteps, 'result']
    }

    const steps = getSteps()
    const currentStepIndex = steps.indexOf(currentStep)
    const progress = mode ? ((currentStepIndex) / (steps.length - 1)) * 100 : 0

    const stepLabels: Record<Step, { label: string; hint: string }> = {
        mode: { label: '計算モード', hint: '' },
        angle: { label: 'テーパー角度（度）', hint: '片角を入力してください' },
        length: { label: '加工長さ（Z方向）', hint: 'テーパー部分の長さ' },
        startDiameter: { label: '始点直径', hint: '加工開始点の直径' },
        startX: { label: '始点X座標（直径値）', hint: '' },
        startZ: { label: '始点Z座標', hint: '' },
        endX: { label: '終点X座標（直径値）', hint: '' },
        endZ: { label: '終点Z座標', hint: '' },
        result: { label: '計算結果', hint: '' }
    }

    const handleModeSelect = (selectedMode: Mode) => {
        setMode(selectedMode)
        setCurrentStep(selectedMode === 'angle' ? 'angle' : 'startX')
    }

    const handleNext = () => {
        const numValue = parseFloat(inputValue)
        if (isNaN(numValue)) return

        setValues({ ...values, [currentStep]: numValue })
        setInputValue('')

        const nextIndex = currentStepIndex + 1
        if (nextIndex < steps.length - 1) {
            setCurrentStep(steps[nextIndex])
        } else {
            // 計算実行
            if (mode === 'angle') {
                const res = calculateTaper({
                    mode: 'angle',
                    angle: values.angle ?? numValue,
                    length: values.length ?? numValue,
                    startDiameter: currentStep === 'startDiameter' ? numValue : values.startDiameter
                })
                setResult(res)
            } else {
                const res = calculateTaper({
                    mode: 'coordinates',
                    startX: values.startX ?? numValue,
                    startZ: values.startZ ?? numValue,
                    endX: values.endX ?? numValue,
                    endZ: currentStep === 'endZ' ? numValue : values.endZ
                })
                setResult(res)
            }
            setCurrentStep('result')
        }
    }

    const handleBack = () => {
        if (currentStep === 'mode' || (currentStepIndex <= 1 && mode)) {
            if (mode) {
                setMode(null)
                setCurrentStep('mode')
            } else {
                onBack()
            }
        } else if (currentStepIndex > 1) {
            setCurrentStep(steps[currentStepIndex - 1])
            setInputValue('')
        }
    }

    const handleReset = () => {
        setMode(null)
        setCurrentStep('mode')
        setValues({})
        setResult(null)
        setInputValue('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleNext()
    }

    if (currentStep === 'result' && result) {
        return (
            <div className="step-form">
                <div className="step-form-header">
                    <button className="back-button" onClick={handleReset}>←</button>
                    <h2 className="step-form-title">テーパー計算結果</h2>
                </div>

                <div className="result-section">
                    <h3 className="result-title">📐 計算結果</h3>
                    <div className="result-grid">
                        <div className="result-item">
                            <div className="result-label">テーパー角度</div>
                            <div className="result-value">{result.angle}°</div>
                        </div>
                        <div className="result-item">
                            <div className="result-label">勾配</div>
                            <div className="result-value">{result.ratio}</div>
                        </div>
                        <div className="result-item">
                            <div className="result-label">直径変化量</div>
                            <div className="result-value">{result.diameterChange}</div>
                        </div>
                        {result.endX && (
                            <div className="result-item">
                                <div className="result-label">終点X</div>
                                <div className="result-value">{result.endX}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="step-actions">
                    <button className="btn btn-secondary" onClick={handleReset}>新規計算</button>
                    <button className="btn btn-ghost" onClick={onBack}>戻る</button>
                </div>
            </div>
        )
    }

    if (currentStep === 'mode') {
        return (
            <div className="step-form">
                <div className="step-form-header">
                    <button className="back-button" onClick={onBack}>←</button>
                    <h2 className="step-form-title">テーパー計算</h2>
                </div>

                <div className="step-content">
                    <label className="step-label">計算モードを選択</label>
                    <div className="direction-buttons">
                        <button className="btn btn-secondary" onClick={() => handleModeSelect('angle')}>
                            📐 角度から座標を計算
                        </button>
                        <button className="btn btn-secondary" onClick={() => handleModeSelect('coordinates')}>
                            📍 座標から角度を計算
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="step-form">
            <div className="step-form-header">
                <button className="back-button" onClick={handleBack}>←</button>
                <h2 className="step-form-title">テーパー計算</h2>
            </div>

            <div className="step-progress">
                <div className="step-progress-text">
                    <span>ステップ {currentStepIndex} / {steps.length - 2}</span>
                    <span>{stepLabels[currentStep].label}</span>
                </div>
                <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="step-content">
                <label className="step-label">{stepLabels[currentStep].label}</label>
                <input
                    type="number"
                    className="step-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="0.000"
                    autoFocus
                />
                {stepLabels[currentStep].hint && (
                    <div className="step-hint">
                        <span className="hint-icon">💡</span>
                        {stepLabels[currentStep].hint}
                    </div>
                )}
            </div>

            <div className="step-actions">
                <button className="btn btn-secondary" onClick={handleBack}>← 戻る</button>
                <button className="btn btn-primary" onClick={handleNext} disabled={!inputValue}>
                    {currentStepIndex === steps.length - 2 ? '計算する →' : '次へ →'}
                </button>
            </div>
        </div>
    )
}
