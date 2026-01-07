import { useState, useEffect } from 'react'
import type { Shape, CornerType, CornerTreatment } from '../../models/shape'
import { createPoint, createEmptyShape, noCorner } from '../../models/shape'
import { calculateShape, formatResults } from '../../calculators/shape'
import { ShapePreview } from '../preview/ShapePreview'
import { ResultsView } from '../ResultsView/ResultsView'
import type { CoordinateSettings, MachineSettings } from '../../models/settings'
import { defaultCoordinateSettings, defaultMachineSettings } from '../../models/settings'
import { ToolSettings } from '../settings/ToolSettings'
import { calculateTaperElement } from '../../calculators/advancedGeometry'
import './ShapeBuilder.css'

export function ShapeBuilder() {
    const [shape, setShape] = useState<Shape>(createEmptyShape())
    const [inputX, setInputX] = useState('')
    const [inputZ, setInputZ] = useState('')
    const [cornerType, setCornerType] = useState<CornerType>('none')
    const [cornerSize, setCornerSize] = useState('')
    // 連続R（2つ目の円弧）
    const [hasSecondArc, setHasSecondArc] = useState(false)
    const [secondArcType, setSecondArcType] = useState<CornerType>('kaku-r')
    const [secondArcSize, setSecondArcSize] = useState('')

    const [showResults, setShowResults] = useState(false)
    const [calculatedResults, setCalculatedResults] = useState<string[]>([])
    const [showSettings, setShowSettings] = useState(false)
    const [coordSettings, setCoordSettings] = useState<CoordinateSettings>(defaultCoordinateSettings)
    const [machineSettings, setMachineSettings] = useState<MachineSettings>(defaultMachineSettings)

    // 角度入力（高度計算統合）
    const [inputAngle, setInputAngle] = useState('')
    const [isAngleMode, setIsAngleMode] = useState(false)


    const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null)
    const [isInitialized, setIsInitialized] = useState(false)

    // 初期化時にlocalStorageから読み込む
    useEffect(() => {
        const loadSettings = () => {
            const saved = localStorage.getItem('nc_calc_settings')
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed.machine) setMachineSettings(parsed.machine)
                if (parsed.coordinates) setCoordSettings(parsed.coordinates)
            }
        }

        loadSettings()

        const savedShape = localStorage.getItem('nc_calc_last_shape')
        if (savedShape) {
            setShape(JSON.parse(savedShape))
        }
        setIsInitialized(true)

        // 他のタブで設定が変更された場合に同期
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'nc_calc_settings' && e.newValue) {
                const parsed = JSON.parse(e.newValue)
                if (parsed.machine) setMachineSettings(parsed.machine)
                if (parsed.coordinates) setCoordSettings(parsed.coordinates)
            }
        }

        // タブがフォーカスされたときに設定を再読み込み
        const handleFocus = () => loadSettings()

        window.addEventListener('storage', handleStorageChange)
        window.addEventListener('focus', handleFocus)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('focus', handleFocus)
        }
    }, [])

    // 形状が変更されたら保存
    useEffect(() => {
        if (!isInitialized) return
        localStorage.setItem('nc_calc_last_shape', JSON.stringify(shape))
    }, [shape, isInitialized])

    // 設定が変更されたら保存（他のタブと同期させるため）
    useEffect(() => {
        if (!isInitialized) return
        const saved = localStorage.getItem('nc_calc_settings')
        const current = saved ? JSON.parse(saved) : {}
        localStorage.setItem('nc_calc_settings', JSON.stringify({
            ...current,
            machine: machineSettings,
            coordinates: coordSettings
        }))
    }, [machineSettings, coordSettings, isInitialized])

    const addPoint = () => {
        const xStr = inputX.trim()
        const zStr = inputZ.trim()

        if (xStr === '' || zStr === '') return

        const x = parseFloat(xStr)
        const z = parseFloat(zStr)

        if (isNaN(x) || isNaN(z)) return

        // 角処理を作成
        let corner: CornerTreatment = noCorner()
        const size = parseFloat(cornerSize)
        if (!isNaN(size) && size > 0) {
            if (cornerType === 'sumi-r') {
                corner = { type: 'sumi-r', size }
            } else if (cornerType === 'kaku-r') {
                corner = { type: 'kaku-r', size }
            } else if (cornerType === 'kaku-c') {
                corner = { type: 'kaku-c', size }
            }

            // 連続Rの処理
            if (hasSecondArc && (cornerType === 'sumi-r' || cornerType === 'kaku-r')) {
                const secondSize = parseFloat(secondArcSize)
                if (!isNaN(secondSize) && secondSize > 0) {
                    corner.secondArc = {
                        type: secondArcType as 'sumi-r' | 'kaku-r',
                        size: secondSize
                    }
                }
            }
        }

        const newPoint = createPoint(x, z, corner)

        setShape(prev => {
            const newPoints = [...prev.points, newPoint]
            setLastAddedIndex(newPoints.length)
            return { ...prev, points: newPoints }
        })

        // 入力をクリア
        setInputX('')
        setInputZ('')
        setInputAngle('')
        setIsAngleMode(false)
        setCornerType('none')
        setCornerSize('')
        setHasSecondArc(false)
        setSecondArcType('kaku-r')
        setSecondArcSize('')
        setShowResults(false)

        // フィードバックを2秒後にクリア
        setTimeout(() => setLastAddedIndex(null), 2000)
    }

    const calculateFromAngle = (type: 'x' | 'z') => {
        if (shape.points.length === 0) return
        const lastPoint = shape.points[shape.points.length - 1]
        const angle = parseFloat(inputAngle)
        if (isNaN(angle)) return

        if (type === 'x') {
            const z = parseFloat(inputZ)
            if (isNaN(z)) return
            const res = calculateTaperElement({
                startX: lastPoint.x,
                startZ: lastPoint.z,
                angleDeg: angle,
                endZ: z
            })
            if (res) setInputX(res.endX.toString())
        } else {
            const x = parseFloat(inputX)
            if (isNaN(x)) return
            const res = calculateTaperElement({
                startX: lastPoint.x,
                startZ: lastPoint.z,
                angleDeg: angle,
                endX: x
            })
            if (res) setInputZ(res.endZ.toString())
        }
    }


    const clearShape = () => {
        setShape(createEmptyShape())
        setShowResults(false)
        setCalculatedResults([])
    }

    const calculateAll = () => {
        const result = calculateShape(shape, machineSettings)
        const formatted = formatResults(result)
        setCalculatedResults(formatted)
        setShowResults(true)
    }

    const copyResults = () => {
        navigator.clipboard.writeText(calculatedResults.join('\n'))
    }

    const removeLastPoint = () => {
        if (shape.points.length === 0) return

        // 削除する点の値を取得して入力欄に復元
        const removedPoint = shape.points[shape.points.length - 1]
        setInputX(removedPoint.x.toString())
        setInputZ(removedPoint.z.toString())
        setCornerType(removedPoint.corner.type)
        setCornerSize(removedPoint.corner.size > 0 ? removedPoint.corner.size.toString() : '')

        setShape({ points: shape.points.slice(0, -1) })
        setShowResults(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            addPoint()
        }
    }

    return (
        <div className="shape-builder">
            <div className="builder-header">
                <h2>🔧 形状ビルダー</h2>
                <div className="header-controls">
                    <span className="point-count">{shape.points.length}点</span>
                    <button
                        className="btn btn-icon"
                        onClick={() => setShowSettings(!showSettings)}
                        title="座標設定"
                    >
                        ⚙️
                    </button>
                </div>
            </div>

            {/* 座標方向設定パネル */}
            {showSettings && (
                <div className="settings-panel">
                    <h4>座標方向設定</h4>
                    <div className="settings-grid">
                        <div className="setting-item">
                            <label>X軸方向</label>
                            <div className="toggle-buttons">
                                <button
                                    className={`toggle-btn ${coordSettings.xDirection === 1 ? 'active' : ''}`}
                                    onClick={() => setCoordSettings({ ...coordSettings, xDirection: 1 })}
                                >
                                    +X ↑
                                </button>
                                <button
                                    className={`toggle-btn ${coordSettings.xDirection === -1 ? 'active' : ''}`}
                                    onClick={() => setCoordSettings({ ...coordSettings, xDirection: -1 })}
                                >
                                    +X ↓
                                </button>
                            </div>
                        </div>
                        <div className="setting-item">
                            <label>Z軸方向</label>
                            <div className="toggle-buttons">
                                <button
                                    className={`toggle-btn ${coordSettings.zDirection === 1 ? 'active' : ''}`}
                                    onClick={() => setCoordSettings({ ...coordSettings, zDirection: 1 })}
                                >
                                    +Z →
                                </button>
                                <button
                                    className={`toggle-btn ${coordSettings.zDirection === -1 ? 'active' : ''}`}
                                    onClick={() => setCoordSettings({ ...coordSettings, zDirection: -1 })}
                                >
                                    +Z ←
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="settings-info">
                        現在: X+が{coordSettings.xDirection === 1 ? '上' : '下'}、Z+が{coordSettings.zDirection === 1 ? '右' : '左'}方向
                    </div>

                    <h4 style={{ marginTop: '16px' }}>機械設定</h4>
                    <div className="settings-grid">
                        <div className="setting-item">
                            <label>刃物台</label>
                            <div className="toggle-buttons">
                                <button
                                    className={`toggle-btn ${machineSettings.toolPost === 'front' ? 'active' : ''}`}
                                    onClick={() => setMachineSettings({ ...machineSettings, toolPost: 'front' })}
                                >
                                    前刃物台
                                </button>
                                <button
                                    className={`toggle-btn ${machineSettings.toolPost === 'rear' ? 'active' : ''}`}
                                    onClick={() => setMachineSettings({ ...machineSettings, toolPost: 'rear' })}
                                >
                                    後刃物台
                                </button>
                            </div>
                        </div>
                        <div className="setting-item">
                            <label>切削方向</label>
                            <div className="toggle-buttons">
                                <button
                                    className={`toggle-btn ${machineSettings.cuttingDirection === '-z' ? 'active' : ''}`}
                                    onClick={() => setMachineSettings({ ...machineSettings, cuttingDirection: '-z' })}
                                >
                                    -Z方向
                                </button>
                                <button
                                    className={`toggle-btn ${machineSettings.cuttingDirection === '+z' ? 'active' : ''}`}
                                    onClick={() => setMachineSettings({ ...machineSettings, cuttingDirection: '+z' })}
                                >
                                    +Z方向
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ノーズR補正設定 */}
                    <h4 style={{ marginTop: '16px' }}>ノーズR補正</h4>
                    <div className="settings-grid">
                        <div className="setting-item">
                            <label>補正モード</label>
                            <div className="toggle-buttons">
                                <button
                                    className={`toggle-btn ${!machineSettings.noseRCompensation.enabled ? 'active' : ''}`}
                                    onClick={() => setMachineSettings({
                                        ...machineSettings,
                                        noseRCompensation: { ...machineSettings.noseRCompensation, enabled: false }
                                    })}
                                >
                                    補正なし
                                </button>
                                <button
                                    className={`toggle-btn ${machineSettings.noseRCompensation.enabled ? 'active' : ''}`}
                                    onClick={() => setMachineSettings({
                                        ...machineSettings,
                                        noseRCompensation: { ...machineSettings.noseRCompensation, enabled: true }
                                    })}
                                >
                                    G41/G42補正
                                </button>
                            </div>
                        </div>
                    </div>
                    {machineSettings.noseRCompensation.enabled && (
                        <div style={{ marginTop: '8px' }}>
                            <div className="settings-info" style={{ color: 'var(--color-success)', marginBottom: '8px' }}>
                                ✓ 補正有効: 工具R{machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)?.noseRadius || 0}mm で座標を補正します
                            </div>
                            <div className="setting-item">
                                <span className="setting-label">計算方式</span>
                                <div className="toggle-buttons">
                                    <button
                                        className={`toggle-btn ${machineSettings.noseRCompensation.method === 'geometric' ? 'active' : ''}`}
                                        onClick={() => setMachineSettings({
                                            ...machineSettings,
                                            noseRCompensation: { ...machineSettings.noseRCompensation, method: 'geometric' }
                                        })}
                                        title="仮想刃先点と接点の差を計算（チップ番号対応）"
                                    >
                                        幾何学的
                                    </button>
                                    <button
                                        className={`toggle-btn ${machineSettings.noseRCompensation.method === 'smid' ? 'active' : ''}`}
                                        onClick={() => setMachineSettings({
                                            ...machineSettings,
                                            noseRCompensation: { ...machineSettings.noseRCompensation, method: 'smid' }
                                        })}
                                        title="Peter Smid CNC Programming Handbook Chapter 27"
                                    >
                                        Smid方式
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {!machineSettings.noseRCompensation.enabled && (
                        <div className="settings-info" style={{ marginTop: '8px' }}>
                            補正なし: ワーク形状の座標をそのまま出力します
                        </div>
                    )}

                    <ToolSettings
                        machineSettings={machineSettings}
                        onUpdate={(updates) => setMachineSettings({ ...machineSettings, ...updates })}
                    />

                </div>
            )}

            {/* プレビュー */}
            <div className="preview-section">
                <ShapePreview shape={shape} settings={coordSettings} />
            </div>

            {/* 点追加フォーム */}
            <div className="input-section">
                <div className="input-row">
                    <div className="input-group">
                        <label>X（直径）</label>
                        <div className="input-with-action">
                            <input
                                type="number"
                                className="step-input small"
                                value={inputX}
                                onChange={(e) => setInputX(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="0.000"
                            />
                            {isAngleMode && shape.points.length > 0 && (
                                <button className="btn-calc-small" onClick={() => calculateFromAngle('x')} title="角度からXを計算">
                                    calc
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Z</label>
                        <div className="input-with-action">
                            <input
                                type="number"
                                className="step-input small"
                                value={inputZ}
                                onChange={(e) => setInputZ(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="0.000"
                            />
                            {isAngleMode && shape.points.length > 0 && (
                                <button className="btn-calc-small" onClick={() => calculateFromAngle('z')} title="角度からZを計算">
                                    calc
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 角度入力（オプション） */}
                <div className="advanced-input-toggle">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={isAngleMode}
                            onChange={(e) => setIsAngleMode(e.target.checked)}
                        />
                        角度(θ)を指定して計算
                    </label>
                </div>

                {isAngleMode && (
                    <div className="input-row angle-input-row">
                        <div className="input-group">
                            <label>テーパー角度（片角）</label>
                            <input
                                type="number"
                                className="step-input small"
                                value={inputAngle}
                                onChange={(e) => setInputAngle(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="30.0"
                            />
                        </div>
                        <div className="input-group calc-info-group">
                            <span className="input-hint">
                                {shape.points.length > 0
                                    ? `前点(X${shape.points[shape.points.length - 1].x} Z${shape.points[shape.points.length - 1].z})基準`
                                    : "※ 始点がある場合に有効"}
                            </span>
                        </div>
                    </div>
                )}

                {/* 角処理設定 */}
                <div className="corner-section">
                    <label>この点の角処理</label>
                    <div className="segment-type-buttons">
                        <button
                            className={`type-btn ${cornerType === 'none' ? 'active' : ''}`}
                            onClick={() => setCornerType('none')}
                        >
                            なし
                        </button>
                        <button
                            className={`type-btn ${cornerType === 'sumi-r' ? 'active' : ''}`}
                            onClick={() => setCornerType('sumi-r')}
                        >
                            隅R
                        </button>
                        <button
                            className={`type-btn ${cornerType === 'kaku-r' ? 'active' : ''}`}
                            onClick={() => setCornerType('kaku-r')}
                        >
                            角R
                        </button>
                        <button
                            className={`type-btn ${cornerType === 'kaku-c' ? 'active' : ''}`}
                            onClick={() => setCornerType('kaku-c')}
                        >
                            角C
                        </button>
                    </div>

                    {cornerType !== 'none' && (
                        <div className="extra-input">
                            <label>{cornerType === 'kaku-c' ? 'C値' : 'R値'}</label>
                            <input
                                type="number"
                                className="step-input small"
                                value={cornerSize}
                                onChange={(e) => setCornerSize(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={cornerType === 'kaku-c' ? 'C2' : 'R5'}
                            />
                        </div>
                    )}

                    {/* 連続R（円弧→円弧）オプション */}
                    {(cornerType === 'sumi-r' || cornerType === 'kaku-r') && (
                        <div className="second-arc-section">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={hasSecondArc}
                                    onChange={(e) => setHasSecondArc(e.target.checked)}
                                />
                                連続R（2つ目の円弧を追加）
                            </label>

                            {hasSecondArc && (
                                <div className="second-arc-inputs">
                                    <div className="segment-type-buttons small">
                                        <button
                                            className={`type-btn ${secondArcType === 'sumi-r' ? 'active' : ''}`}
                                            onClick={() => setSecondArcType('sumi-r')}
                                        >
                                            隅R
                                        </button>
                                        <button
                                            className={`type-btn ${secondArcType === 'kaku-r' ? 'active' : ''}`}
                                            onClick={() => setSecondArcType('kaku-r')}
                                        >
                                            角R
                                        </button>
                                    </div>
                                    <div className="input-group">
                                        <label>第2R値</label>
                                        <input
                                            type="number"
                                            className="step-input small"
                                            value={secondArcSize}
                                            onChange={(e) => setSecondArcSize(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="R5"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>


                {/* アクションボタン */}
                <div className="action-buttons">
                    <button className="btn btn-primary" onClick={addPoint}>
                        ➕ 点を追加
                    </button>
                    {shape.points.length > 0 && (
                        <button className="btn btn-secondary" onClick={removeLastPoint}>
                            ↩ 戻す
                        </button>
                    )}
                </div>

                {/* 追加成功フィードバック */}
                {lastAddedIndex !== null && (
                    <div className="success-feedback">
                        ✓ 点{lastAddedIndex}を追加しました
                    </div>
                )}
            </div>

            {/* 点一覧 */}
            {shape.points.length > 0 && (
                <div className="points-list">
                    <h3>入力済みの点</h3>
                    {shape.points.map((point, index) => (
                        <div key={point.id} className="point-item">
                            <span className="point-number">{index + 1}</span>
                            <span className="point-coords">X{point.x} Z{point.z}</span>
                            {point.corner.type !== 'none' && (
                                <span className="corner-badge">
                                    {point.corner.type === 'sumi-r' ? `隅R${point.corner.size}`
                                        : point.corner.type === 'kaku-r' ? `角R${point.corner.size}`
                                            : `角C${point.corner.size}`}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 計算ボタン */}
            {shape.points.length >= 2 && (
                <div className="calculate-section">
                    <button className="btn btn-primary full-width" onClick={calculateAll}>
                        📐 全座標を計算
                    </button>
                </div>
            )}

            {/* 計算結果（CADスタイル） */}
            {showResults && (
                <ResultsView shape={shape} onCopy={copyResults} machineSettings={machineSettings} coordSettings={coordSettings} />
            )}

            {/* クリアボタン */}
            {shape.points.length > 0 && (
                <button className="btn btn-ghost full-width" onClick={clearShape}>
                    🗑 クリア
                </button>
            )}
        </div>
    )
}
