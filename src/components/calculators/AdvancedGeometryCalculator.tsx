import { useState } from 'react'
import {
    calculateTaperElement,
    calculateTaperAngle,
    findArcCenter,
    intersectLineCircle
} from '../../calculators/advancedGeometry'
import './AdvancedGeometryCalculator.css' // 必要に応じて作成

interface AdvancedGeometryCalculatorProps {
    onBack: () => void
}

type Mode = 'inverse_findX' | 'inverse_findZ' | 'inverse_findAngle' | 'center' | 'intersection' | null
type Step = 'mode' | 'startX' | 'startZ' | 'angleDeg' | 'endX' | 'endZ' | 'p1X' | 'p1Z' | 'p2X' | 'p2Z' | 'radius' | 'arcConfig' | 'lineP' | 'lineAngle' | 'circleC' | 'circleR' | 'result'

const stepLabels: Partial<Record<Step, { label: string; hint: string }>> = {
    mode: { label: '計算モード', hint: '計算したい項目を選択してください' },
    startX: { label: '始点X座標（直径）', hint: 'テーパーの開始点Xを直径で入力' },
    startZ: { label: '始点Z座標', hint: 'テーパーの開始点Zを入力' },
    angleDeg: { label: 'テーパー角度（度）', hint: '軸に対する片角を入力' },
    endX: { label: '終点X（直径）', hint: '既知の終点X座標を入力' },
    endZ: { label: '終点Z', hint: '既知の終点Z座標を入力' },
    p1X: { label: '円弧始点X（直径）', hint: '円弧の開始位置Xを入力' },
    p1Z: { label: '円弧始点Z', hint: '円弧の開始位置Zを入力' },
    p2X: { label: '円弧終点X（直径）', hint: '円弧の終了位置Xを入力' },
    p2Z: { label: '円弧終点Z', hint: '円弧の終了位置Zを入力' },
    radius: { label: '半径 R', hint: '円弧の半径を指定' },
    arcConfig: { label: '回転方向・優劣弧', hint: 'G02/G03 および 180度以上の判定' },
    lineP: { label: '直線通過点 (X, Z)', hint: 'テーパーが通過する座標を入力' },
    lineAngle: { label: '直線の角度', hint: 'テーパーの角度を入力' },
    circleC: { label: '円の中心 (X, Z)', hint: '円弧の中心座標を入力' },
    circleR: { label: '円の半径 R', hint: '円弧の半径を入力' },
    result: { label: '計算結果', hint: '' }
}

export function AdvancedGeometryCalculator({ onBack }: AdvancedGeometryCalculatorProps) {
    const [mode, setMode] = useState<Mode>(null)
    const [currentStep, setCurrentStep] = useState<Step>('mode')
    const [values, setValues] = useState<Record<string, any>>({})
    const [inputValue, setInputValue] = useState('')
    const [tempP, setTempP] = useState({ x: '', z: '' }) // X, Z 同時入力用

    // 各モードのステップ定義
    const modeSteps: Record<NonNullable<Mode>, Step[]> = {
        inverse_findX: ['startX', 'startZ', 'angleDeg', 'endZ'],
        inverse_findZ: ['startX', 'startZ', 'angleDeg', 'endX'],
        inverse_findAngle: ['startX', 'startZ', 'endX', 'endZ'],
        center: ['p1X', 'p1Z', 'p2X', 'p2Z', 'radius', 'arcConfig'],
        intersection: ['lineP', 'lineAngle', 'circleC', 'circleR']
    }

    const steps: Step[] = mode ? ['mode', ...modeSteps[mode], 'result'] : ['mode']
    const currentStepIndex = steps.indexOf(currentStep)
    const progress = mode ? (currentStepIndex / (steps.length - 1)) * 100 : 0

    const handleModeSelect = (selectedMode: Mode) => {
        setMode(selectedMode)
        if (selectedMode) {
            setCurrentStep(modeSteps[selectedMode][0])
        }
    }

    const handleNext = () => {
        if (currentStep === 'lineP' || currentStep === 'circleC') {
            const x = parseFloat(tempP.x)
            const z = parseFloat(tempP.z)
            if (isNaN(x) || isNaN(z)) return
            setValues({ ...values, [currentStep]: { x, z } })
            setTempP({ x: '', z: '' })
        } else if (currentStep !== 'arcConfig' && currentStep !== 'result') {
            const val = parseFloat(inputValue)
            if (isNaN(val)) return
            setValues({ ...values, [currentStep]: val })
            setInputValue('')
        }

        const nextIndex = currentStepIndex + 1
        if (nextIndex < steps.length) {
            setCurrentStep(steps[nextIndex])
        }
    }

    const handleBack = () => {
        if (currentStep === 'mode') {
            onBack()
        } else if (currentStepIndex === 1) {
            setMode(null)
            setCurrentStep('mode')
            setValues({})
        } else {
            setCurrentStep(steps[currentStepIndex - 1])
        }
    }

    const handleReset = () => {
        setMode(null)
        setCurrentStep('mode')
        setValues({})
        setInputValue('')
    }

    // 計算実行と結果表示
    const renderResult = () => {
        if (!mode) return null;
        let res: any = null;
        let resultNode: React.ReactNode = null;

        try {
            if (mode === 'inverse_findX') {
                res = calculateTaperElement({ startX: values.startX, startZ: values.startZ, angleDeg: values.angleDeg, endZ: values.endZ });
                resultNode = (
                    <div className="result-grid">
                        <div className="result-item"><div className="result-label">終点X</div><div className="result-value">{res?.endX}</div></div>
                        <div className="result-item"><div className="result-label">長さ</div><div className="result-value">{res?.length}</div></div>
                    </div>
                );
            } else if (mode === 'inverse_findZ') {
                res = calculateTaperElement({ startX: values.startX, startZ: values.startZ, angleDeg: values.angleDeg, endX: values.endX });
                resultNode = (
                    <div className="result-grid">
                        <div className="result-item"><div className="result-label">終点Z</div><div className="result-value">{res?.endZ}</div></div>
                        <div className="result-item"><div className="result-label">長さ</div><div className="result-value">{res?.length}</div></div>
                    </div>
                );
            } else if (mode === 'inverse_findAngle') {
                res = calculateTaperAngle(values.startX, values.startZ, values.endX, values.endZ);
                resultNode = (
                    <div className="result-grid"><div className="result-item"><div className="result-label">テーパー角度</div><div className="result-value">{res}°</div></div></div>
                );
            } else if (mode === 'center') {
                res = findArcCenter({ x: values.p1X, z: values.p1Z }, { x: values.p2X, z: values.p2Z }, values.radius, values.isLeftTurn, values.isLargeArc);
                if (res) {
                    const i = (res.xc - values.p1X) / 2;
                    const k = res.zc - values.p1Z;
                    resultNode = (
                        <div className="result-grid">
                            <div className="result-item"><div className="result-label">中心X</div><div className="result-value">{res.xc}</div></div>
                            <div className="result-item"><div className="result-label">中心Z</div><div className="result-value">{res.zc}</div></div>
                            <div className="result-item"><div className="result-label">I値</div><div className="result-value">{Math.round(i * 1000) / 1000}</div></div>
                            <div className="result-item"><div className="result-label">K値</div><div className="result-value">{Math.round(k * 1000) / 1000}</div></div>
                        </div>
                    );
                }
            } else if (mode === 'intersection') {
                const pts = intersectLineCircle(values.lineP, values.lineAngle, values.circleC, values.circleR);
                resultNode = (
                    <div className="result-grid">
                        {pts.map((p, i) => (
                            <div key={i} className="result-item"><div className="result-label">交点 {i + 1}</div><div className="result-value">X{p.x} Z{p.z}</div></div>
                        ))}
                    </div>
                );
            }
        } catch (e) {
            resultNode = <div className="error-message">計算に失敗しました</div>;
        }

        return (
            <div className="step-form">
                <div className="step-form-header">
                    <button className="back-button" onClick={handleReset}>←</button>
                    <h2 className="step-form-title">高度幾何計算結果</h2>
                </div>
                <div className="result-section">
                    <h3 className="result-title">📐 計算結果</h3>
                    {resultNode || <div className="error-message">有効な結果が得られませんでした</div>}
                </div>
                <div className="step-actions">
                    <button className="btn btn-secondary" onClick={handleReset}>新規計算</button>
                    <button className="btn btn-ghost" onClick={onBack}>戻る</button>
                </div>
            </div>
        );
    }

    if (currentStep === 'result') return renderResult();

    if (currentStep === 'mode') {
        return (
            <div className="step-form">
                <div className="step-form-header">
                    <button className="back-button" onClick={onBack}>←</button>
                    <h2 className="step-form-title">高度幾何計算</h2>
                </div>
                <div className="step-content">
                    <label className="step-label">{stepLabels.mode?.label}</label>
                    <div className="direction-buttons horizontal-scroll">
                        <button className="btn btn-secondary" onClick={() => handleModeSelect('inverse_findX')}>🔄 終点Xを求める</button>
                        <button className="btn btn-secondary" onClick={() => handleModeSelect('inverse_findZ')}>🔄 終点Zを求める</button>
                        <button className="btn btn-secondary" onClick={() => handleModeSelect('inverse_findAngle')}>📐 角度を求める</button>
                        <button className="btn btn-secondary" onClick={() => handleModeSelect('center')}>◎ 円弧中心の特定</button>
                        <button className="btn btn-secondary" onClick={() => handleModeSelect('intersection')}>✕ 直線と円の交点</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="step-form">
            <div className="step-form-header">
                <button className="back-button" onClick={handleBack}>←</button>
                <h2 className="step-form-title">高度幾何計算</h2>
            </div>

            <div className="step-progress">
                <div className="step-progress-text">
                    <span>ステップ {currentStepIndex} / {steps.length - 2}</span>
                    <span>{stepLabels[currentStep]?.label}</span>
                </div>
                <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="step-content">
                <label className="step-label">{stepLabels[currentStep]?.label}</label>

                {currentStep === 'arcConfig' ? (
                    <div className="direction-buttons">
                        <button className={`btn ${values.isLeftTurn ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setValues({ ...values, isLeftTurn: true })}>↺ G03 (左回)</button>
                        <button className={`btn ${!values.isLeftTurn ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setValues({ ...values, isLeftTurn: false })}>↻ G02 (右回)</button>
                        <button className={`btn ${values.isLargeArc ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setValues({ ...values, isLargeArc: true })} style={{ marginTop: '10px' }}>優弧 (180°超)</button>
                        <button className={`btn ${!values.isLargeArc ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setValues({ ...values, isLargeArc: false })} style={{ marginTop: '10px' }}>劣弧 (180°内)</button>
                    </div>
                ) : (currentStep === 'lineP' || currentStep === 'circleC') ? (
                    <div className="input-row">
                        <div className="input-group">
                            <label>X座標（直径）</label>
                            <input type="number" className="step-input" value={tempP.x} onChange={e => setTempP({ ...tempP, x: e.target.value })} placeholder="0.0" autoFocus />
                        </div>
                        <div className="input-group">
                            <label>Z座標</label>
                            <input type="number" className="step-input" value={tempP.z} onChange={e => setTempP({ ...tempP, z: e.target.value })} placeholder="0.0" />
                        </div>
                    </div>
                ) : (
                    <input
                        type="number"
                        className="step-input"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                        placeholder="0.000"
                        autoFocus
                    />
                )}

                <div className="step-hint">
                    <span className="hint-icon">💡</span>
                    {stepLabels[currentStep]?.hint}
                </div>
            </div>

            <div className="step-actions">
                <button className="btn btn-secondary" onClick={handleBack}>← 戻る</button>
                <button className="btn btn-primary" onClick={handleNext} disabled={(currentStep !== 'arcConfig' && currentStep !== 'lineP' && currentStep !== 'circleC' && !inputValue) || ((currentStep === 'lineP' || currentStep === 'circleC') && (!tempP.x || !tempP.z))}>
                    {currentStepIndex === steps.length - 2 ? '計算する →' : '次へ →'}
                </button>
            </div>
        </div>
    )
}
