import { useState, useEffect } from 'react'
import { calculateGroove, type GrooveResult } from '../../calculators/groove'
import { GroovePreview } from '../preview/GroovePreview'
import '../ShapeBuilder/ShapeBuilder.css'

interface GrooveCalculatorProps {
    onBack: () => void
}

type GrooveShapeType = 'rectangular' | 'corner-r' | 'full-r' | 'arc-bottom'

export function GrooveCalculator({ onBack }: GrooveCalculatorProps) {
    // 入力フォーム
    const [grooveCount, setGrooveCount] = useState<'single' | 'multiple'>('single')
    const [grooveShape, setGrooveShape] = useState<GrooveShapeType>('rectangular')
    const [diameter, setDiameter] = useState('')
    const [width, setWidth] = useState('')
    const [depth, setDepth] = useState('')
    const [startZ, setStartZ] = useState('')
    const [cornerR, setCornerR] = useState('')
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
        const w = parseFloat(width)
        const dp = parseFloat(depth)
        const sz = parseFloat(startZ)
        const cr = parseFloat(cornerR) || 0
        const ar = parseFloat(arcBottomR) || 0

        if (isNaN(d) || isNaN(w) || isNaN(sz)) {
            setResult(null)
            return
        }

        if (d <= 0 || w <= 0) {
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
            width: w,
            depth: effectiveDepth,
            startZ: sz,
            count: grooveCount === 'multiple' ? parseInt(count) : undefined,
            pitch: grooveCount === 'multiple' ? parseFloat(pitch) : undefined,
            cornerR: grooveShape === 'corner-r' ? cr : 0,
            fullR: isFullR,
            arcBottomR: grooveShape === 'arc-bottom' ? ar : 0,
            toolWidth: isGroovingTool ? activeTool.width : undefined,
            noseRadius: isGroovingTool ? activeTool.noseRadius : 0,
            referencePoint: isGroovingTool ? activeTool.referencePoint : undefined
        })

        setResult(res)
    }, [diameter, width, depth, startZ, cornerR, count, pitch, grooveCount, grooveShape, machineSettings])

    const handleClear = () => {
        setDiameter('')
        setWidth('')
        setDepth('')
        setStartZ('')
        setCornerR('')
        setCount('')
        setPitch('')
        setArcBottomR('')
        setResult(null)
    }

    const handleCopy = () => {
        if (!result) return
        const lines: string[] = []
        result.grooves.forEach((g, i) => {
            lines.push(`; 溝${g.index}`)
            lines.push(`N${(i + 1) * 100} G00 X${(g.entryX + 2).toFixed(3)} Z${g.entryZ.toFixed(3)}`)

            if (g.fullRArc) {
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
            lines.push(`N${(i + 1) * 100 + 50} G01 X${(g.entryX + 2).toFixed(3)}`)
        })
        navigator.clipboard.writeText(lines.join('\n'))
    }

    // 計算された深さを表示用に取得
    const getCalculatedDepth = () => {
        if (grooveShape === 'full-r') {
            const w = parseFloat(width)
            return isNaN(w) ? '—' : (w / 2).toFixed(3)
        }
        if (grooveShape === 'arc-bottom') {
            return depth || '—'
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

                {/* 溝形状選択 */}
                <div className="corner-section">
                    <label>溝形状</label>
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
                            ⚾ 指定R底
                        </button>
                    </div>
                    {grooveShape === 'full-r' && (
                        <div className="input-hint" style={{ marginTop: '0.5rem', color: 'var(--color-accent-secondary)' }}>
                            完全R形状: 深さ = 溝幅/2 として半円形の溝を加工
                        </div>
                    )}
                </div>

                {/* 基本パラメータ */}
                <div className="input-row">
                    <div className="input-group">
                        <label>加工径（直径）</label>
                        <input
                            type="number"
                            className="step-input small"
                            value={diameter}
                            onChange={(e) => setDiameter(e.target.value)}
                            placeholder="50.0"
                        />
                    </div>
                    <div className="input-group">
                        <label>開始Z位置</label>
                        <input
                            type="number"
                            className="step-input small"
                            value={startZ}
                            onChange={(e) => setStartZ(e.target.value)}
                            placeholder="-10.0"
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
                            placeholder="5.0"
                        />
                    </div>
                    <div className="input-group">
                        <label>溝深さ（片側）{grooveShape === 'full-r' && ' [自動]'}</label>
                        {grooveShape === 'full-r' ? (
                            <div className="step-input small" style={{
                                background: 'var(--color-bg-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                color: 'var(--color-text-secondary)'
                            }}>
                                {getCalculatedDepth()}
                            </div>
                        ) : (
                            <input
                                type="number"
                                className="step-input small"
                                value={depth}
                                onChange={(e) => setDepth(e.target.value)}
                                placeholder="3.0"
                            />
                        )}
                    </div>
                </div>

                <div className="input-row" style={{ marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                    <div className="input-group">
                        <div className="quick-buttons">
                            <button className="q-btn" onClick={() => setWidth('2.0')}>2.0</button>
                            <button className="q-btn" onClick={() => setWidth('3.0')}>3.0</button>
                            <button className="q-btn" onClick={() => setWidth('4.0')}>4.0</button>
                            <button className="q-btn" onClick={() => setWidth('5.0')}>5.0</button>
                        </div>
                    </div>
                    <div className="input-group">
                        <div className="quick-buttons">
                            <button className="q-btn" onClick={() => setDepth('1.0')}>1.0</button>
                            <button className="q-btn" onClick={() => setDepth('2.0')}>2.0</button>
                            <button className="q-btn" onClick={() => setDepth('3.0')}>3.0</button>
                        </div>
                    </div>
                </div>

                {/* 指定R底 - 指定R底形状のときのみ表示 */}
                {grooveShape === 'arc-bottom' && (
                    <div className="corner-section">
                        <label>指定R（円弧底）</label>
                        <div className="extra-input">
                            <input
                                type="number"
                                className="step-input small"
                                value={arcBottomR}
                                onChange={(e) => setArcBottomR(e.target.value)}
                                placeholder="10.0"
                            />
                            <div className="quick-buttons">
                                <button className="q-btn" onClick={() => setArcBottomR('10.0')}>10R</button>
                                <button className="q-btn" onClick={() => setArcBottomR('20.0')}>20R</button>
                                <button className="q-btn" onClick={() => setArcBottomR('50.0')}>50R</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 底R - 底R形状のときのみ表示 */}
                {grooveShape === 'corner-r' && (
                    <div className="corner-section">
                        <label>底R（隅R）</label>
                        <div className="extra-input">
                            <input
                                type="number"
                                className="step-input small"
                                value={cornerR}
                                onChange={(e) => setCornerR(e.target.value)}
                                placeholder="2.0"
                            />
                            <span className="input-hint">溝深さ以下を推奨</span>
                        </div>
                    </div>
                )}

                {/* 複数溝用パラメータ */}
                {grooveCount === 'multiple' && (
                    <div className="input-row">
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
                <div className="action-buttons">
                    <button className="btn btn-secondary" onClick={handleClear}>
                        🗑 クリア
                    </button>
                    {result && (
                        <button className="btn btn-primary" onClick={handleCopy}>
                            📋 NCコードコピー
                        </button>
                    )}
                </div>
            </div>

            {/* 計算結果表示 */}
            {result && result.grooves.length > 0 && (
                <div className="results-view" style={{ marginTop: '1rem' }}>
                    <div className="results-header">
                        <h3>📐 計算結果（{result.grooves.length}溝・{
                            result.grooveType === 'full-r' ? '完全R' :
                                result.grooveType === 'arc-bottom' ? '指定R底' :
                                    result.grooveType === 'corner-r' ? '底R' : '直角'
                        }）</h3>
                    </div>

                    {/* NCコード表示 */}
                    <div className="nc-code-view">
                        <div className="nc-code-header">
                            <span className="nc-code-title">NCプログラム</span>
                        </div>
                        <div className="nc-code-body">
                            {result.grooves.map((g, i) => (
                                <div key={i} className="nc-groove-block" style={{ marginBottom: '0.75rem' }}>
                                    <div className="nc-line">
                                        <span className="nc-line-num">N{(i + 1) * 100}</span>
                                        <span className="nc-command">G00 X{(g.entryX + 2).toFixed(3)} Z{g.entryZ.toFixed(3)}</span>
                                    </div>

                                    {g.fullRArc ? (
                                        // 完全Rまたは指定R底
                                        <div className="nc-line arc">
                                            <span className="nc-line-num">N{(i + 1) * 100 + 10}</span>
                                            <span className="nc-command">
                                                {g.fullRArc.gCode} X{g.fullRArc.endX.toFixed(3)} Z{g.fullRArc.endZ.toFixed(3)} I{g.fullRArc.i.toFixed(3)} K{g.fullRArc.k.toFixed(3)} F0.1
                                            </span>
                                        </div>
                                    ) : g.cornerR ? (
                                        // 底R形状
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
                                        // 直角形状
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
                                        <span className="nc-line-num">N{(i + 1) * 100 + 50}</span>
                                        <span className="nc-command">G01 X{(g.entryX + 2).toFixed(3)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 座標テーブル */}
                    <div className="coord-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>溝</th>
                                    <th>進入X</th>
                                    <th>進入Z</th>
                                    <th>底X</th>
                                    <th>退避Z</th>
                                    {(result.grooveType === 'full-r' || result.grooveType === 'arc-bottom') && <th>R値</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {result.grooves.map((g) => (
                                    <tr key={g.index}>
                                        <td className="center">{g.index}</td>
                                        <td className="mono">{g.entryX.toFixed(3)}</td>
                                        <td className="mono">{g.entryZ.toFixed(3)}</td>
                                        <td className="mono highlight">{g.bottomX.toFixed(3)}</td>
                                        <td className="mono">{g.exitZ.toFixed(3)}</td>
                                        {g.fullRArc && <td className="mono">{g.fullRArc.radius.toFixed(3)}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
