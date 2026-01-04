import { useState } from 'react'
import { calculateArc, type ArcInput, type ArcResult } from '../../calculators/arc'
import { ArcPreview } from '../preview/ArcPreview'

interface ArcCalculatorProps {
    onBack: () => void
}

type Step = 'startX' | 'startZ' | 'endX' | 'endZ' | 'radius' | 'direction' | 'result'

const stepConfig: Record<Step, { label: string; hint: string; type?: string }> = {
    startX: { label: '始点X座標（直径値）', hint: '加工開始点のX座標を直径値で入力', type: 'number' },
    startZ: { label: '始点Z座標', hint: 'ワーク端面を0とした位置', type: 'number' },
    endX: { label: '終点X座標（直径値）', hint: '加工終了点のX座標を直径値で入力', type: 'number' },
    endZ: { label: '終点Z座標', hint: 'ワーク端面を0とした位置', type: 'number' },
    radius: { label: '円弧半径 R', hint: '円弧の半径を入力', type: 'number' },
    direction: { label: '回転方向', hint: 'G02: 時計回り / G03: 反時計回り' },
    result: { label: '計算結果', hint: '' }
}

const steps: Step[] = ['startX', 'startZ', 'endX', 'endZ', 'radius', 'direction', 'result']

export function ArcCalculator({ onBack }: ArcCalculatorProps) {
    const [currentStep, setCurrentStep] = useState<Step>('startX')
    const [values, setValues] = useState<Partial<ArcInput>>({})
    const [result, setResult] = useState<ArcResult | null>(null)
    const [inputValue, setInputValue] = useState('')

    const currentStepIndex = steps.indexOf(currentStep)
    const progress = ((currentStepIndex) / (steps.length - 1)) * 100

    const handleNext = () => {
        if (currentStep === 'direction') {
            // 計算実行
            const input: ArcInput = {
                startX: values.startX!,
                startZ: values.startZ!,
                endX: values.endX!,
                endZ: values.endZ!,
                radius: values.radius!,
                direction: values.direction!
            }
            const calcResult = calculateArc(input)
            setResult(calcResult)
            setCurrentStep('result')
        } else if (currentStep !== 'result') {
            const numValue = parseFloat(inputValue)
            if (!isNaN(numValue)) {
                setValues({ ...values, [currentStep]: numValue })
                setInputValue('')
                setCurrentStep(steps[currentStepIndex + 1])
            }
        }
    }

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(steps[currentStepIndex - 1])
            setInputValue('')
        } else {
            onBack()
        }
    }

    const handleDirection = (dir: 'CW' | 'CCW') => {
        setValues({ ...values, direction: dir })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNext()
        }
    }

    const copyResult = () => {
        if (result) {
            const text = `I${result.i} K${result.k}`
            navigator.clipboard.writeText(text)
        }
    }

    const handleReset = () => {
        setCurrentStep('startX')
        setValues({})
        setResult(null)
        setInputValue('')
    }

    if (currentStep === 'result' && result) {
        return (
            <div className="step-form">
                <div className="step-form-header">
                    <button className="back-button" onClick={handleReset}>←</button>
                    <h2 className="step-form-title">円弧補間 計算結果</h2>
                </div>

                <div className="preview-section">
                    <div className="preview-title">プレビュー</div>
                    <ArcPreview
                        startX={values.startX!}
                        startZ={values.startZ!}
                        endX={values.endX!}
                        endZ={values.endZ!}
                        centerX={result.centerX}
                        centerZ={result.centerZ}
                        direction={values.direction!}
                    />
                </div>

                <div className="result-section">
                    <h3 className="result-title">📐 計算結果</h3>
                    <div className="result-grid">
                        <div className="result-item">
                            <div className="result-label">I値</div>
                            <div className="result-value">{result.i}</div>
                        </div>
                        <div className="result-item">
                            <div className="result-label">K値</div>
                            <div className="result-value">{result.k}</div>
                        </div>
                        <div className="result-item">
                            <div className="result-label">中心X</div>
                            <div className="result-value">{result.centerX}</div>
                        </div>
                        <div className="result-item">
                            <div className="result-label">中心Z</div>
                            <div className="result-value">{result.centerZ}</div>
                        </div>
                    </div>
                    <button className="btn btn-primary copy-button" onClick={copyResult}>
                        📋 I{result.i} K{result.k} をコピー
                    </button>
                </div>

                <div className="step-actions">
                    <button className="btn btn-secondary" onClick={handleReset}>
                        新規計算
                    </button>
                    <button className="btn btn-ghost" onClick={onBack}>
                        戻る
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="step-form">
            <div className="step-form-header">
                <button className="back-button" onClick={handleBack}>←</button>
                <h2 className="step-form-title">円弧補間（I, K値）</h2>
            </div>

            <div className="step-progress">
                <div className="step-progress-text">
                    <span>ステップ {currentStepIndex + 1} / {steps.length - 1}</span>
                    <span>{stepConfig[currentStep].label}</span>
                </div>
                <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="preview-section">
                <div className="preview-title">プレビュー</div>
                <ArcPreview
                    startX={values.startX}
                    startZ={values.startZ}
                    endX={values.endX}
                    endZ={values.endZ}
                    direction={values.direction}
                />
            </div>

            <div className="step-content">
                <label className="step-label">{stepConfig[currentStep].label}</label>

                {currentStep === 'direction' ? (
                    <div className="direction-buttons">
                        <button
                            className={`btn ${values.direction === 'CW' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleDirection('CW')}
                        >
                            ↻ G02 (CW)
                        </button>
                        <button
                            className={`btn ${values.direction === 'CCW' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleDirection('CCW')}
                        >
                            ↺ G03 (CCW)
                        </button>
                    </div>
                ) : (
                    <input
                        type="number"
                        className="step-input"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="0.000"
                        autoFocus
                    />
                )}

                <div className="step-hint">
                    <span className="hint-icon">💡</span>
                    {stepConfig[currentStep].hint}
                </div>
            </div>

            <div className="step-actions">
                <button className="btn btn-secondary" onClick={handleBack}>
                    ← 戻る
                </button>
                <button
                    className="btn btn-primary"
                    onClick={handleNext}
                    disabled={currentStep !== 'direction' && !inputValue}
                >
                    {currentStep === 'direction' ? '計算する →' : '次へ →'}
                </button>
            </div>
        </div>
    )
}
