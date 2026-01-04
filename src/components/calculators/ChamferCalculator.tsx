import { useState } from 'react'
import { calculateChamfer, type ChamferInput, type ChamferResult } from '../../calculators/chamfer'

interface ChamferCalculatorProps {
    onBack: () => void
}

type Step = 'type' | 'size' | 'startX' | 'startZ' | 'direction' | 'edgeType' | 'result'

export function ChamferCalculator({ onBack }: ChamferCalculatorProps) {
    const [currentStep, setCurrentStep] = useState<Step>('type')
    const [values, setValues] = useState<Partial<ChamferInput>>({})
    const [result, setResult] = useState<ChamferResult | null>(null)
    const [inputValue, setInputValue] = useState('')

    const steps: Step[] = ['type', 'size', 'startX', 'startZ', 'direction', 'edgeType', 'result']
    const currentStepIndex = steps.indexOf(currentStep)
    const progress = ((currentStepIndex) / (steps.length - 1)) * 100

    const stepLabels: Record<Step, { label: string; hint: string }> = {
        type: { label: '面取りタイプ', hint: '' },
        size: { label: values.type === 'c' ? 'C面取りサイズ' : 'R半径', hint: '' },
        startX: { label: '基準点X座標（直径値）', hint: '面取りを加工する角の位置' },
        startZ: { label: '基準点Z座標', hint: '' },
        direction: { label: '加工方向', hint: '' },
        edgeType: { label: 'エッジタイプ', hint: '' },
        result: { label: '計算結果', hint: '' }
    }

    const handleTypeSelect = (type: 'c' | 'r') => {
        setValues({ ...values, type })
        setCurrentStep('size')
    }

    const handleDirectionSelect = (direction: 'outer' | 'inner') => {
        setValues({ ...values, direction })
        setCurrentStep('edgeType')
    }

    const handleEdgeTypeSelect = (edgeType: 'end' | 'shoulder') => {
        const input: ChamferInput = {
            type: values.type!,
            size: values.size!,
            startX: values.startX!,
            startZ: values.startZ!,
            direction: values.direction!,
            edgeType
        }
        const res = calculateChamfer(input)
        setResult(res)
        setCurrentStep('result')
    }

    const handleNext = () => {
        const numValue = parseFloat(inputValue)
        if (isNaN(numValue)) return

        setValues({ ...values, [currentStep]: numValue })
        setInputValue('')
        setCurrentStep(steps[currentStepIndex + 1])
    }

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(steps[currentStepIndex - 1])
            setInputValue('')
        } else {
            onBack()
        }
    }

    const handleReset = () => {
        setCurrentStep('type')
        setValues({})
        setResult(null)
        setInputValue('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleNext()
    }

    const copyResult = () => {
        if (result) {
            let text = `X${result.point1X} Z${result.point1Z} → X${result.point2X} Z${result.point2Z}`
            if (result.type === 'r' && result.i !== undefined && result.k !== undefined) {
                text += ` I${result.i} K${result.k}`
            }
            navigator.clipboard.writeText(text)
        }
    }

    if (currentStep === 'result' && result) {
        return (
            <div className="step-form">
                <div className="step-form-header">
                    <button className="back-button" onClick={handleReset}>←</button>
                    <h2 className="step-form-title">
                        {result.type === 'c' ? 'C面取り' : 'R面取り'}計算結果
                    </h2>
                </div>

                <div className="result-section">
                    <h3 className="result-title">📐 座標</h3>
                    <div className="result-grid">
                        <div className="result-item">
                            <div className="result-label">開始点X</div>
                            <div className="result-value">{result.point1X}</div>
                        </div>
                        <div className="result-item">
                            <div className="result-label">開始点Z</div>
                            <div className="result-value">{result.point1Z}</div>
                        </div>
                        <div className="result-item">
                            <div className="result-label">終了点X</div>
                            <div className="result-value">{result.point2X}</div>
                        </div>
                        <div className="result-item">
                            <div className="result-label">終了点Z</div>
                            <div className="result-value">{result.point2Z}</div>
                        </div>
                    </div>

                    {result.type === 'r' && result.i !== undefined && (
                        <>
                            <h3 className="result-title" style={{ marginTop: '1rem' }}>🔄 円弧データ</h3>
                            <div className="result-grid">
                                <div className="result-item">
                                    <div className="result-label">I値</div>
                                    <div className="result-value">{result.i}</div>
                                </div>
                                <div className="result-item">
                                    <div className="result-label">K値</div>
                                    <div className="result-value">{result.k}</div>
                                </div>
                            </div>
                        </>
                    )}

                    <button className="btn btn-primary copy-button" onClick={copyResult}>
                        📋 座標をコピー
                    </button>
                </div>

                <div className="step-actions">
                    <button className="btn btn-secondary" onClick={handleReset}>新規計算</button>
                    <button className="btn btn-ghost" onClick={onBack}>戻る</button>
                </div>
            </div>
        )
    }

    return (
        <div className="step-form">
            <div className="step-form-header">
                <button className="back-button" onClick={handleBack}>←</button>
                <h2 className="step-form-title">面取り計算</h2>
            </div>

            {currentStep !== 'type' && (
                <div className="step-progress">
                    <div className="step-progress-text">
                        <span>ステップ {currentStepIndex} / {steps.length - 2}</span>
                        <span>{stepLabels[currentStep].label}</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}

            <div className="step-content">
                <label className="step-label">{stepLabels[currentStep].label}</label>

                {currentStep === 'type' && (
                    <div className="direction-buttons">
                        <button className="btn btn-secondary" onClick={() => handleTypeSelect('c')}>
                            ⌐ C面取り
                        </button>
                        <button className="btn btn-secondary" onClick={() => handleTypeSelect('r')}>
                            ◠ R面取り
                        </button>
                    </div>
                )}

                {currentStep === 'direction' && (
                    <div className="direction-buttons">
                        <button className="btn btn-secondary" onClick={() => handleDirectionSelect('outer')}>
                            外径側
                        </button>
                        <button className="btn btn-secondary" onClick={() => handleDirectionSelect('inner')}>
                            内径側
                        </button>
                    </div>
                )}

                {currentStep === 'edgeType' && (
                    <div className="direction-buttons">
                        <button className="btn btn-secondary" onClick={() => handleEdgeTypeSelect('end')}>
                            端面
                        </button>
                        <button className="btn btn-secondary" onClick={() => handleEdgeTypeSelect('shoulder')}>
                            肩部
                        </button>
                    </div>
                )}

                {['size', 'startX', 'startZ'].includes(currentStep) && (
                    <>
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
                    </>
                )}
            </div>

            {['size', 'startX', 'startZ'].includes(currentStep) && (
                <div className="step-actions">
                    <button className="btn btn-secondary" onClick={handleBack}>← 戻る</button>
                    <button className="btn btn-primary" onClick={handleNext} disabled={!inputValue}>
                        次へ →
                    </button>
                </div>
            )}
        </div>
    )
}
