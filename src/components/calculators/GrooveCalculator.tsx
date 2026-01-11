import { useState, useEffect } from 'react'
import { calculateGroove, type GrooveResult } from '../../calculators/groove'
import { GroovePreview } from '../preview/GroovePreview'
import '../ShapeBuilder/ShapeBuilder.css'

interface GrooveCalculatorProps {
    onBack: () => void
}

type GrooveShapeType = 'rectangular' | 'corner-r' | 'full-r' | 'arc-bottom' | 'advanced'

export function GrooveCalculator({ onBack }: GrooveCalculatorProps) {
    // 入力フォーム
    const [grooveCount, setGrooveCount] = useState<'single' | 'multiple'>('single')
    const [grooveShape, setGrooveShape] = useState<GrooveShapeType>('rectangular')
    const [diameter, setDiameter] = useState('')
    const [endDiameter, setEndDiameter] = useState('')
    const [width, setWidth] = useState('')
    const [depth, setDepth] = useState('')
    const [startZ, setStartZ] = useState('')
    const [cornerR, setCornerR] = useState('')

    // 高度な設定
    const [leftAngle, setLeftAngle] = useState('90')
    const [rightAngle, setRightAngle] = useState('90')
    const [bottomLeftR, setBottomLeftR] = useState('')
    const [bottomRightR, setBottomRightR] = useState('')
    const [showAdvanced, setShowAdvanced] = useState(false)

    // 角処理
    const [topLeftType, setTopLeftType] = useState<'none' | 'chamfer' | 'round'>('none')
    const [topLeftSize, setTopLeftSize] = useState('')
    const [topRightType, setTopRightType] = useState<'none' | 'chamfer' | 'round'>('none')
    const [topRightSize, setTopRightSize] = useState('')

    // 複数溝用
    const [count, setCount] = useState('')
    const [pitch, setPitch] = useState('')
    const [arcBottomR, setArcBottomR] = useState('')

    // 計算結果
    const [result, setResult] = useState<GrooveResult | null>(null)
    const [machineSettings, setMachineSettings] = useState<any>(null)

    // 初期化時に設定を読み込む
    useEffect(() => {
        const saved = localStorage.getItem('nc_calc_settings')
        if (saved) {
            setMachineSettings(JSON.parse(saved).machine)
        }
    }, [])

    // 入力値が変更されたら自動計算
    useEffect(() => {
        const d = parseFloat(diameter)
        const ed = endDiameter !== '' ? parseFloat(endDiameter) : undefined
        const w = parseFloat(width)
        const dp = parseFloat(depth)
        const sz = parseFloat(startZ) || 0 // 空の場合は0.0をデフォルトに
        const cr = parseFloat(cornerR) || 0
        const ar = parseFloat(arcBottomR) || 0

        const la = parseFloat(leftAngle) || 90
        const ra = parseFloat(rightAngle) || 90
        const blr = bottomLeftR !== '' ? parseFloat(bottomLeftR) : undefined
        const brr = bottomRightR !== '' ? parseFloat(bottomRightR) : undefined

        // 必須項目チェック（直径と幅が未入力なら計算しない）
        if (isNaN(d) || isNaN(w) || d <= 0 || w <= 0) {
            setResult(null)
            return
        }

        // 完全R形状の場合は深さを自動計算（R = 溝幅/2）
        const isFullR = grooveShape === 'full-r'
        const effectiveDepth = isFullR ? w / 2 : dp

        if (!isFullR && (isNaN(dp) || dp <= 0)) {
            setResult(null)
            return
        }

        // 複数溝の場合の追加チェック
        if (grooveCount === 'multiple') {
            const c = parseInt(count)
            const p = parseFloat(pitch)
            if (isNaN(c) || isNaN(p) || c <= 0 || p <= 0) {
                setResult(null)
                return
            }
        }

        // アクティブ工具の情報を取得
        const activeTool = machineSettings?.toolLibrary?.find((t: any) => t.id === machineSettings.activeToolId)
        const isGroovingTool = activeTool?.type === 'grooving'

        const res = calculateGroove({
            type: grooveCount,
            diameter: d,
            endDiameter: ed,
            width: w,
            depth: effectiveDepth,
            startZ: sz,
            count: grooveCount === 'multiple' ? parseInt(count) : undefined,
            pitch: grooveCount === 'multiple' ? parseFloat(pitch) : undefined,
            cornerR: (grooveShape === 'corner-r' && !blr && !brr) ? cr : 0,
            bottomLeftR: blr,
            bottomRightR: brr,
            leftAngle: la,
            rightAngle: ra,
            topLeftCorner: topLeftType !== 'none' ? { type: topLeftType, size: parseFloat(topLeftSize) || 0 } : undefined,
            topRightCorner: topRightType !== 'none' ? { type: topRightType, size: parseFloat(topRightSize) || 0 } : undefined,
            fullR: isFullR,
            arcBottomR: grooveShape === 'arc-bottom' ? ar : 0,
            toolWidth: isGroovingTool ? activeTool.width : undefined,
            noseRadius: isGroovingTool ? activeTool.noseRadius : 0,
            toolTipNumber: isGroovingTool ? activeTool.virtualTip : 3,
            referencePoint: isGroovingTool ? activeTool.referencePoint : undefined
        })

        setResult(res)
    }, [diameter, endDiameter, width, depth, startZ, cornerR, count, pitch, grooveCount, grooveShape, machineSettings, leftAngle, rightAngle, bottomLeftR, bottomRightR, topLeftType, topLeftSize, topRightType, topRightSize])

    const handleClear = () => {
        setDiameter('')
        setEndDiameter('')
        setWidth('')
        setDepth('')
        setStartZ('')
        setCornerR('')
        setCount('')
        setPitch('')
        setArcBottomR('')
        setLeftAngle('90')
        setRightAngle('90')
        setBottomLeftR('')
        setBottomRightR('')
        setTopLeftType('none')
        setTopLeftSize('')
        setTopRightType('none')
        setTopRightSize('')
        setResult(null)
    }

    const handleCopy = () => {
        if (!result) return
        const lines: string[] = []
        result.grooves.forEach((g, i) => {
            lines.push(`; 溝${g.index}`)
            lines.push(`N${(i + 1) * 100} G00 X${(g.entryX + 5).toFixed(3)} Z${g.entryZ.toFixed(3)}`)

            if (g.advancedSegments) {
                // 高度な形状の場合、すべてのセグメントの終点を G01 で出力
                g.advancedSegments.forEach((seg: any, sIdx: number) => {
                    const x = seg.compensated?.endX ?? seg.endX
                    const z = seg.compensated?.endZ ?? seg.endZ
                    lines.push(`N${(i + 1) * 100 + (sIdx + 1) * 10} G01 X${x.toFixed(3)} Z${z.toFixed(3)} F0.1`)
                })
            } else if (g.fullRArc) {
                // 完全Rまたは指定R底
                lines.push(`N${(i + 1) * 100 + 10} ${g.fullRArc.gCode} X${g.fullRArc.endX.toFixed(3)} Z${g.fullRArc.endZ.toFixed(3)} I${g.fullRArc.i.toFixed(3)} K${g.fullRArc.k.toFixed(3)} F0.1`)
            } else if (g.cornerR) {
                // 底R形状
                lines.push(`N${(i + 1) * 100 + 10} G01 X${g.cornerR.leftArc.startX.toFixed(3)} F0.1`)
                lines.push(`N${(i + 1) * 100 + 20} ${g.cornerR.leftArc.gCode} X${g.cornerR.leftArc.endX.toFixed(3)} Z${g.cornerR.leftArc.endZ.toFixed(3)} I${g.cornerR.leftArc.i.toFixed(3)} K${g.cornerR.leftArc.k.toFixed(3)}`)
                lines.push(`N${(i + 1) * 100 + 30} G01 Z${g.cornerR.rightArc.startZ.toFixed(3)}`)
                lines.push(`N${(i + 1) * 100 + 40} ${g.cornerR.rightArc.gCode} X${g.cornerR.rightArc.endX.toFixed(3)} Z${g.cornerR.rightArc.endZ.toFixed(3)} I${g.cornerR.rightArc.i.toFixed(3)} K${g.cornerR.rightArc.k.toFixed(3)}`)
            } else {
                // 直角形状
                lines.push(`N${(i + 1) * 100 + 10} G01 X${g.bottomX.toFixed(3)} F0.1`)
                lines.push(`N${(i + 1) * 100 + 20} G01 Z${g.exitZ.toFixed(3)}`)
            }
            lines.push(`N${(i + 1) * 100 + 90} G01 X${(g.entryX + 5).toFixed(3)}`)
        })
        navigator.clipboard.writeText(lines.join('\n'))
    }

    // 計算された深さを表示用に取得
    const getCalculatedDepth = () => {
        if (grooveShape === 'full-r') {
            const w = parseFloat(width)
            return isNaN(w) ? '—' : (w / 2).toFixed(3)
        }
        return depth || '—'
    }

    return (
        <div className="shape-builder">
            <div className="builder-header">
                <h2>🔧 溝入れ計算</h2>
                <div className="header-controls">
                    <button className="btn btn-icon" onClick={onBack} title="戻る">
                        ←
                    </button>
                </div>
            </div>

            {/* プレビュー */}
            <div className="preview-section">
                {result && result.grooves.length > 0 ? (
                    <GroovePreview result={result} />
                ) : (
                    <div className="preview-placeholder">
                        <span>溝形状がここに表示されます</span>
                    </div>
                )}
            </div>

            {/* 溝タイプ選択 */}
            <div className="input-section">
                <div className="corner-section">
                    <label>溝数</label>
                    <div className="segment-type-buttons">
                        <button
                            className={`type-btn ${grooveCount === 'single' ? 'active' : ''}`}
                            onClick={() => setGrooveCount('single')}
                        >
                            単一溝
                        </button>
                        <button
                            className={`type-btn ${grooveCount === 'multiple' ? 'active' : ''}`}
                            onClick={() => setGrooveCount('multiple')}
                        >
                            複数溝
                        </button>
                    </div>
                </div>

                <div className="corner-section">
                    <label>基本形状</label>
                    <div className="segment-type-buttons">
                        <button
                            className={`type-btn ${grooveShape === 'rectangular' ? 'active' : ''}`}
                            onClick={() => setGrooveShape('rectangular')}
                        >
                            ⊔ 直角
                        </button>
                        <button
                            className={`type-btn ${grooveShape === 'corner-r' ? 'active' : ''}`}
                            onClick={() => setGrooveShape('corner-r')}
                        >
                            ⌒ 底R
                        </button>
                        <button
                            className={`type-btn ${grooveShape === 'full-r' ? 'active' : ''}`}
                            onClick={() => setGrooveShape('full-r')}
                        >
                            ◠ 完全R
                        </button>
                        <button
                            className={`type-btn ${grooveShape === 'arc-bottom' ? 'active' : ''}`}
                            onClick={() => setGrooveShape('arc-bottom')}
                        >
                            ⚾ 円弧底
                        </button>
                    </div>
                </div>

                {/* パラメータ入力 */}
                <div className="input-row">
                    <div className="input-group">
                        <label>加工径（開始）</label>
                        <input
                            type="number"
                            className="step-input small"
                            value={diameter}
                            onChange={(e) => setDiameter(e.target.value)}
                            placeholder="100.0"
                        />
                    </div>
                    <div className="input-group">
                        <label>加工径（終了）</label>
                        <input
                            type="number"
                            className="step-input small"
                            value={endDiameter}
                            onChange={(e) => setEndDiameter(e.target.value)}
                            placeholder="100.0"
                        />
                    </div>
                </div>

                <div className="input-row">
                    <div className="input-group">
                        <label>溝幅</label>
                        <input
                            type="number"
                            className="step-input small"
                            value={width}
                            onChange={(e) => setWidth(e.target.value)}
                            placeholder="10.0"
                        />
                    </div>
                    <div className="input-group">
                        <label>開始Z位置</label>
                        <input
                            type="number"
                            className="step-input small"
                            value={startZ}
                            onChange={(e) => setStartZ(e.target.value)}
                            placeholder="0.0"
                        />
                    </div>
                </div>

                <div className="input-row">
                    <div className="input-group">
                        <label>溝深さ（片側）</label>
                        {grooveShape === 'full-r' ? (
                            <div className="step-input small readonly">
                                {getCalculatedDepth()}
                            </div>
                        ) : (
                            <input
                                type="number"
                                className="step-input small"
                                value={depth}
                                onChange={(e) => setDepth(e.target.value)}
                                placeholder="5.0"
                            />
                        )}
                    </div>
                    {grooveShape === 'corner-r' && (
                        <div className="input-group">
                            <label>底R（共通）</label>
                            <input
                                type="number"
                                className="step-input small"
                                value={cornerR}
                                onChange={(e) => setCornerR(e.target.value)}
                                placeholder="0.5"
                            />
                        </div>
                    )}
                </div>

                {/* 高度な設定トグル */}
                <div className="corner-section" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '1rem' }}>
                    <button
                        className={`btn ${showAdvanced ? 'btn-secondary' : 'btn-ghost'}`}
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{ width: '100%', justifyContent: 'space-between' }}
                    >
                        <span>{showAdvanced ? '▼ 高度な幾何設定を隠す' : '▶ 高度な幾何設定（テーパ・個別R・肩処理）'}</span>
                    </button>

                    {showAdvanced && (
                        <div className="advanced-fields" style={{ marginTop: '1rem' }}>
                            <div className="input-row">
                                <div className="input-group">
                                    <label>左壁角度（度）</label>
                                    <input
                                        type="number"
                                        className="step-input small"
                                        value={leftAngle}
                                        onChange={(e) => setLeftAngle(e.target.value)}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>右壁角度（度）</label>
                                    <input
                                        type="number"
                                        className="step-input small"
                                        value={rightAngle}
                                        onChange={(e) => setRightAngle(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="input-row">
                                <div className="input-group">
                                    <label>左底R</label>
                                    <input
                                        type="number"
                                        className="step-input small"
                                        value={bottomLeftR}
                                        onChange={(e) => setBottomLeftR(e.target.value)}
                                        placeholder="0.5"
                                    />
                                </div>
                                <div className="input-group">
                                    <label>右底R</label>
                                    <input
                                        type="number"
                                        className="step-input small"
                                        value={bottomRightR}
                                        onChange={(e) => setBottomRightR(e.target.value)}
                                        placeholder="0.5"
                                    />
                                </div>
                            </div>
                            <div className="input-row">
                                <div className="input-group">
                                    <label>左肩処理</label>
                                    <select value={topLeftType} onChange={(e: any) => setTopLeftType(e.target.value)} className="step-input small">
                                        <option value="none">なし</option>
                                        <option value="chamfer">面取り (C)</option>
                                        <option value="round">R加工</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>サイズ</label>
                                    <input
                                        type="number"
                                        className="step-input small"
                                        value={topLeftSize}
                                        onChange={(e) => setTopLeftSize(e.target.value)}
                                        disabled={topLeftType === 'none'}
                                    />
                                </div>
                            </div>
                            <div className="input-row">
                                <div className="input-group">
                                    <label>右肩処理</label>
                                    <select value={topRightType} onChange={(e: any) => setTopRightType(e.target.value)} className="step-input small">
                                        <option value="none">なし</option>
                                        <option value="chamfer">面取り (C)</option>
                                        <option value="round">R加工</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>サイズ</label>
                                    <input
                                        type="number"
                                        className="step-input small"
                                        value={topRightSize}
                                        onChange={(e) => setTopRightSize(e.target.value)}
                                        disabled={topRightType === 'none'}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 複数溝用パラメータ */}
                {grooveCount === 'multiple' && (
                    <div className="input-row" style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                        <div className="input-group">
                            <label>溝の数</label>
                            <input
                                type="number"
                                className="step-input small"
                                value={count}
                                onChange={(e) => setCount(e.target.value)}
                                placeholder="3"
                            />
                        </div>
                        <div className="input-group">
                            <label>溝ピッチ</label>
                            <input
                                type="number"
                                className="step-input small"
                                value={pitch}
                                onChange={(e) => setPitch(e.target.value)}
                                placeholder="10.0"
                            />
                        </div>
                    </div>
                )}

                {/* アクションボタン */}
                <div className="action-buttons" style={{ marginTop: '1rem' }}>
                    <button className="btn btn-secondary" onClick={handleClear}>
                        🗑 クリア
                    </button>
                    {result && (
                        <button className="btn btn-primary" onClick={handleCopy}>
                            📋 補正済みNCコピー
                        </button>
                    )}
                </div>
            </div>

            {/* 計算結果表示 */}
            {result && result.grooves.length > 0 && (
                <div className="results-view" style={{ marginTop: '1rem' }}>
                    <div className="results-header">
                        <h3>📐 計算結果（{result.grooves.length}溝・{
                            result.grooveType === 'advanced' ? '高度設定' :
                                result.grooveType === 'full-r' ? '完全R' :
                                    result.grooveType === 'arc-bottom' ? '指定R底' :
                                        result.grooveType === 'corner-r' ? '底R' : '直角'
                        }）</h3>
                    </div>

                    <div className="nc-code-view">
                        <div className="nc-code-header">
                            <span className="nc-code-title">NCプログラム（ノーズR補正済み）</span>
                        </div>
                        <div className="nc-code-body">
                            {result.grooves.map((g, i) => (
                                <div key={i} className="nc-groove-block" style={{ marginBottom: '0.75rem' }}>
                                    <div className="nc-line highlight"> ; --- 溝 {g.index} --- </div>
                                    <div className="nc-line">
                                        <span className="nc-line-num">N{(i + 1) * 100}</span>
                                        <span className="nc-command">G00 X{(g.entryX + 5).toFixed(3)} Z{g.entryZ.toFixed(3)}</span>
                                    </div>

                                    {g.advancedSegments ? (
                                        g.advancedSegments.map((seg: any, sIdx: number) => {
                                            const x = seg.compensated?.endX ?? seg.endX
                                            const z = seg.compensated?.endZ ?? seg.endZ
                                            return (
                                                <div className="nc-line" key={sIdx}>
                                                    <span className="nc-line-num">N{(i + 1) * 100 + (sIdx + 1) * 10}</span>
                                                    <span className="nc-command">G01 X{x.toFixed(3)} Z{z.toFixed(3)} F0.1</span>
                                                </div>
                                            )
                                        })
                                    ) : g.fullRArc ? (
                                        <div className="nc-line arc">
                                            <span className="nc-line-num">N{(i + 1) * 100 + 10}</span>
                                            <span className="nc-command">
                                                {g.fullRArc.gCode} X{g.fullRArc.endX.toFixed(3)} Z{g.fullRArc.endZ.toFixed(3)} I{g.fullRArc.i.toFixed(3)} K{g.fullRArc.k.toFixed(3)} F0.1
                                            </span>
                                        </div>
                                    ) : g.cornerR ? (
                                        <>
                                            <div className="nc-line">
                                                <span className="nc-line-num">N{(i + 1) * 100 + 10}</span>
                                                <span className="nc-command">G01 X{g.cornerR.leftArc.startX.toFixed(3)} F0.1</span>
                                            </div>
                                            <div className="nc-line corner-r">
                                                <span className="nc-line-num">N{(i + 1) * 100 + 20}</span>
                                                <span className="nc-command">
                                                    {g.cornerR.leftArc.gCode} X{g.cornerR.leftArc.endX.toFixed(3)} Z{g.cornerR.leftArc.endZ.toFixed(3)} I{g.cornerR.leftArc.i.toFixed(3)} K{g.cornerR.leftArc.k.toFixed(3)}
                                                </span>
                                            </div>
                                            <div className="nc-line">
                                                <span className="nc-line-num">N{(i + 1) * 100 + 30}</span>
                                                <span className="nc-command">G01 Z{g.cornerR.rightArc.startZ.toFixed(3)}</span>
                                            </div>
                                            <div className="nc-line corner-r">
                                                <span className="nc-line-num">N{(i + 1) * 100 + 40}</span>
                                                <span className="nc-command">
                                                    {g.cornerR.rightArc.gCode} X{g.cornerR.rightArc.endX.toFixed(3)} Z{g.cornerR.rightArc.endZ.toFixed(3)} I{g.cornerR.rightArc.i.toFixed(3)} K{g.cornerR.rightArc.k.toFixed(3)}
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="nc-line">
                                                <span className="nc-line-num">N{(i + 1) * 100 + 10}</span>
                                                <span className="nc-command">G01 X{g.bottomX.toFixed(3)} F0.1</span>
                                            </div>
                                            <div className="nc-line">
                                                <span className="nc-line-num">N{(i + 1) * 100 + 20}</span>
                                                <span className="nc-command">G01 Z{g.exitZ.toFixed(3)}</span>
                                            </div>
                                        </>
                                    )}

                                    <div className="nc-line">
                                        <span className="nc-line-num">N{(i + 1) * 100 + 90}</span>
                                        <span className="nc-command">G01 X{(g.entryX + 5).toFixed(3)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
