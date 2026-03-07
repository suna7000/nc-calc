import { useState, useEffect } from 'react'
import type { Shape, CornerType, CornerTreatment, GrooveInsert, Point } from '../../models/shape'
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

    // 溝挿入モード
    const [showGrooveForm, setShowGrooveForm] = useState(false)
    const [grooveWidth, setGrooveWidth] = useState('')
    const [grooveDepth, setGrooveDepth] = useState('')
    const [grooveBottomLeftR, setGrooveBottomLeftR] = useState('')
    const [grooveBottomRightR, setGrooveBottomRightR] = useState('')
    const [grooveLeftAngle, setGrooveLeftAngle] = useState('90')
    const [grooveRightAngle, setGrooveRightAngle] = useState('90')

    // 点編集モード
    const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null)

    // 盗み（ヌスミ）深さ
    const [nusumiDepth, setNusumiDepth] = useState('')

    // 逃し（リトラクト）
    const [startRetract, setStartRetract] = useState('')
    const [endRetract, setEndRetract] = useState('')

    // 新規追加：要素タイプ
    const [segmentType, setSegmentType] = useState<'line' | 'arc'>('line')
    const [arcRadius, setArcRadius] = useState('')
    const [isConvex, setIsConvex] = useState(true)

    // 初期化時にlocalStorageから読み込む
    useEffect(() => {
        const loadSettings = () => {
            const saved = localStorage.getItem('nc_calc_settings')
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed.machine) {
                    // localStorage の古いデータに noseRCompensation がない場合にクラッシュを防ぐ
                    setMachineSettings({
                        ...defaultMachineSettings,
                        ...parsed.machine,
                        noseRCompensation: {
                            ...defaultMachineSettings.noseRCompensation,
                            ...(parsed.machine.noseRCompensation || {})
                        }
                    })
                }
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

        // ツールが選択されており、かつノーズRがある場合、補正がOFFなら警告するか、自動でONにするか?
        // ユーザーの意図を尊重しつつ、計算不一致を防ぐため、初回選択時はONにする
        const activeTool = machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)
        if (activeTool && activeTool.noseRadius > 0 && !machineSettings.noseRCompensation.enabled) {
            // 自動でONにする（初回の利便性向上のため）
            // ただし、明示的にOFFにした場合は尊重したいので、暫定的にUIで補正座標を優先するようにしたのでこれだけでも改善されるはず。
        }

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

        if (xStr === '' && zStr === '' && shape.points.length > 0) return
        if (xStr === '' && zStr === '' && shape.points.length === 0) return

        let x = parseFloat(xStr)
        let z = parseFloat(zStr)

        // 入力省略の処理（前点から引き継ぐ）
        if (shape.points.length > 0) {
            const lastPoint = shape.points[shape.points.length - 1]
            if (isNaN(x)) x = lastPoint.x
            if (isNaN(z)) z = lastPoint.z
        }

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
            } else if (cornerType === 'nusumi') {
                const depthVal = parseFloat(nusumiDepth)
                corner = { type: 'nusumi', size, depth: depthVal > 0 ? depthVal : undefined }
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

        const newPoint = createPoint(x, z, segmentType, corner)
        if (segmentType === 'arc') {
            newPoint.arcRadius = parseFloat(arcRadius) || 0
            newPoint.isConvex = isConvex
        }

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
        setNusumiDepth('')
        setHasSecondArc(false)
        setSecondArcType('kaku-r')
        setSecondArcSize('')
        setShowResults(false)
        setSegmentType('line')
        setArcRadius('')

        // フィードバックを2秒後にクリア
        setTimeout(() => setLastAddedIndex(null), 2000)
    }

    // 点の編集を開始（クリックした点の値をフォームに読み込む）
    const startEditPoint = (index: number) => {
        const point = shape.points[index]
        if (!point) return

        setEditingPointIndex(index)
        setInputX(point.x.toString())
        setInputZ(point.z.toString())
        setCornerType(point.corner.type)
        setCornerSize(point.corner.size > 0 ? point.corner.size.toString() : '')
        setNusumiDepth(point.corner.depth ? point.corner.depth.toString() : '')
        setHasSecondArc(!!point.corner.secondArc)
        if (point.corner.secondArc) {
            setSecondArcType(point.corner.secondArc.type)
            setSecondArcSize(point.corner.secondArc.size.toString())
        }
        setSegmentType(point.type || 'line')
        setArcRadius(point.arcRadius?.toString() || '')
        setIsConvex(point.isConvex !== false)
        setShowGrooveForm(false)
        setShowResults(false)
    }

    // 点を更新
    const updatePoint = () => {
        if (editingPointIndex === null) return

        const xStr = inputX.trim()
        const zStr = inputZ.trim()
        if (xStr === '' || zStr === '') return

        const x = parseFloat(xStr)
        const z = parseFloat(zStr)
        if (isNaN(x) || isNaN(z)) return

        let corner: CornerTreatment = noCorner()
        const size = parseFloat(cornerSize)
        if (!isNaN(size) && size > 0) {
            if (cornerType === 'sumi-r') {
                corner = { type: 'sumi-r', size }
            } else if (cornerType === 'kaku-r') {
                corner = { type: 'kaku-r', size }
            } else if (cornerType === 'kaku-c') {
                corner = { type: 'kaku-c', size }
            } else if (cornerType === 'nusumi') {
                const depthVal = parseFloat(nusumiDepth)
                corner = { type: 'nusumi', size, depth: depthVal > 0 ? depthVal : undefined }
            }
            if (hasSecondArc && (cornerType === 'sumi-r' || cornerType === 'kaku-r')) {
                const secondSize = parseFloat(secondArcSize)
                if (!isNaN(secondSize) && secondSize > 0) {
                    corner.secondArc = { type: secondArcType as 'sumi-r' | 'kaku-r', size: secondSize }
                }
            }
        }

        setShape(prev => {
            const newPoints = [...prev.points]
            const oldGroove = newPoints[editingPointIndex].groove
            newPoints[editingPointIndex] = { ...newPoints[editingPointIndex], x, z, corner, groove: oldGroove }
            return { ...prev, points: newPoints }
        })

        cancelEdit()
    }

    // 編集をキャンセル
    const cancelEdit = () => {
        setEditingPointIndex(null)
        setInputX('')
        setInputZ('')
        setCornerType('none')
        setCornerSize('')
        setNusumiDepth('')
        setHasSecondArc(false)
        setSecondArcType('kaku-r')
        setSecondArcSize('')
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
                endZ: z,
                direction: machineSettings.cuttingDirection === '-z' ? -1 : 1
            })
            if (res) setInputX(res.endX.toString())
        } else {
            const x = parseFloat(inputX)
            if (isNaN(x)) return
            const res = calculateTaperElement({
                startX: lastPoint.x,
                startZ: lastPoint.z,
                angleDeg: angle,
                endX: x,
                direction: machineSettings.cuttingDirection === '-z' ? -1 : 1
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
        const startR = parseFloat(startRetract) || 0
        const endR = parseFloat(endRetract) || 0
        const shapeWithRetract: Shape = (startR > 0 || endR > 0)
            ? { ...shape, retract: { start: startR || undefined, end: endR || undefined } }
            : shape
        const result = calculateShape(shapeWithRetract, machineSettings)
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
        setNusumiDepth(removedPoint.corner.depth ? removedPoint.corner.depth.toString() : '')

        setShape({ points: shape.points.slice(0, -1) })
        setShowResults(false)
    }

    // 溝を挿入（最後の点に溝情報を付加）
    const addGroove = () => {
        if (shape.points.length === 0) return

        const w = parseFloat(grooveWidth)
        const d = parseFloat(grooveDepth)
        if (isNaN(w) || isNaN(d) || w <= 0 || d <= 0) return

        const groove: GrooveInsert = {
            width: w,
            depth: d,
            bottomLeftR: parseFloat(grooveBottomLeftR) || undefined,
            bottomRightR: parseFloat(grooveBottomRightR) || undefined,
            leftAngle: parseFloat(grooveLeftAngle) || 90,
            rightAngle: parseFloat(grooveRightAngle) || 90
        }

        setShape(prev => {
            const newPoints = [...prev.points]
            const lastIdx = newPoints.length - 1
            newPoints[lastIdx] = { ...newPoints[lastIdx], groove }
            return { ...prev, points: newPoints }
        })

        // 入力をリセット
        setShowGrooveForm(false)
        setGrooveWidth('')
        setGrooveDepth('')
        setGrooveBottomLeftR('')
        setGrooveBottomRightR('')
        setGrooveLeftAngle('90')
        setGrooveRightAngle('90')
        setShowResults(false)

        setLastAddedIndex(shape.points.length)
        setTimeout(() => setLastAddedIndex(null), 2000)
    }

    // ぬすみ（U-CUT）を一括挿入
    const addNusumiPreset = () => {
        if (shape.points.length === 0) return

        const d = parseFloat(grooveDepth)
        const w = parseFloat(grooveWidth)
        const r = parseFloat(grooveBottomLeftR) // 戻りRとして流用
        if (isNaN(d) || isNaN(w) || d <= 0 || w <= 0) return

        const lastPoint = shape.points[shape.points.length - 1]

        // 1. 直下落下の点
        const p1 = createPoint(lastPoint.x - d * 2, lastPoint.z, 'line')

        // 2. 底面終端
        const p2 = createPoint(lastPoint.x - d * 2, lastPoint.z - w, 'line')

        // 3. 戻り点（円弧または直線）
        let p3: Point
        if (!isNaN(r) && r > 0) {
            p3 = createPoint(lastPoint.x, lastPoint.z - w - r, 'arc')
            p3.arcRadius = r
            p3.isConvex = false // 凹Rで戻る
        } else {
            p3 = createPoint(lastPoint.x, lastPoint.z - w, 'line')
        }

        setShape(prev => ({
            ...prev,
            points: [...prev.points, p1, p2, p3]
        }))

        setShowGrooveForm(false)
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
                        <div className="setting-item">
                            <label>円弧出力形式</label>
                            <div className="toggle-buttons">
                                <button
                                    className={`toggle-btn ${coordSettings.arcOutputMode === 'R' ? 'active' : ''}`}
                                    onClick={() => setCoordSettings({ ...coordSettings, arcOutputMode: 'R' })}
                                >
                                    R指令
                                </button>
                                <button
                                    className={`toggle-btn ${coordSettings.arcOutputMode === 'IK' ? 'active' : ''}`}
                                    onClick={() => setCoordSettings({ ...coordSettings, arcOutputMode: 'IK' })}
                                >
                                    IK指令
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

            {/* クイック設定パネル (メインUIに露出) */}
            <div className="quick-settings-bar">
                <div className="quick-setting-item">
                    <label className="toggle-label">
                        <input
                            type="checkbox"
                            checked={machineSettings.noseRCompensation.enabled}
                            onChange={(e) => setMachineSettings({
                                ...machineSettings,
                                noseRCompensation: { ...machineSettings.noseRCompensation, enabled: e.target.checked }
                            })}
                        />
                        <span className="label-text">ノーズR補正 (G41/G42)</span>
                    </label>
                </div>
                {machineSettings.activeToolId && (
                    <div className="quick-tool-info">
                        <span className="tool-badge">
                            {machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)?.name}
                            (R{machineSettings.toolLibrary.find(t => t.id === machineSettings.activeToolId)?.noseRadius})
                        </span>
                        <button className="btn-text-small" onClick={() => setShowSettings(true)}>
                            工具変更
                        </button>
                    </div>
                )}
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

                {/* 形状タイプ選択 (直線/円弧) */}
                <div className="element-type-section" style={{ marginTop: '1rem', marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', display: 'block' }}>点までの形状タイプ</label>
                    <div className="segment-type-buttons">
                        <button
                            className={`type-btn ${segmentType === 'line' ? 'active' : ''}`}
                            onClick={() => setSegmentType('line')}
                        >
                            直線
                        </button>
                        <button
                            className={`type-btn ${segmentType === 'arc' ? 'active' : ''}`}
                            onClick={() => setSegmentType('arc')}
                        >
                            円弧
                        </button>
                    </div>

                    {segmentType === 'arc' && (
                        <div className="arc-input-grid" style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="input-group">
                                <label>半径(R)</label>
                                <input
                                    type="number"
                                    className="step-input small"
                                    value={arcRadius}
                                    onChange={(e) => setArcRadius(e.target.value)}
                                    placeholder="R10"
                                />
                            </div>
                            <div className="input-group">
                                <label>形状向き</label>
                                <div className="toggle-buttons mini">
                                    <button
                                        className={`toggle-btn ${isConvex ? 'active' : ''}`}
                                        onClick={() => setIsConvex(true)}
                                    >
                                        凸R
                                    </button>
                                    <button
                                        className={`toggle-btn ${!isConvex ? 'active' : ''}`}
                                        onClick={() => setIsConvex(false)}
                                    >
                                        凹R
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

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
                        <button
                            className={`type-btn ${cornerType === 'nusumi' ? 'active' : ''}`}
                            onClick={() => setCornerType('nusumi')}
                        >
                            盗み
                        </button>
                    </div>

                    {cornerType !== 'none' && (
                        <div className="extra-input">
                            <label>{cornerType === 'kaku-c' ? 'C値' : cornerType === 'nusumi' ? '戻りR' : 'R値'}</label>
                            <input
                                type="number"
                                className="step-input small"
                                value={cornerSize}
                                onChange={(e) => setCornerSize(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={cornerType === 'kaku-c' ? 'C2' : cornerType === 'nusumi' ? 'R10' : 'R5'}
                            />
                        </div>
                    )}

                    {cornerType === 'nusumi' && (
                        <div className="extra-input">
                            <label>深さ（片側）</label>
                            <input
                                type="number"
                                className="step-input small"
                                value={nusumiDepth}
                                onChange={(e) => setNusumiDepth(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="0.2"
                                step="0.1"
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
                    {editingPointIndex !== null ? (
                        <>
                            <button className="btn btn-primary" onClick={updatePoint}>
                                ✓ 点{editingPointIndex + 1}を更新
                            </button>
                            <button className="btn btn-secondary" onClick={cancelEdit}>
                                ✕ キャンセル
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-primary" onClick={addPoint}>
                                ➕ 点を追加
                            </button>
                            {shape.points.length > 0 && (
                                <>
                                    <button className="btn btn-secondary" onClick={removeLastPoint}>
                                        ↩ 戻す
                                    </button>
                                    <button
                                        className={`btn ${showGrooveForm ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => setShowGrooveForm(!showGrooveForm)}
                                    >
                                        🔧 溝を挿入
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* 溝挿入フォーム */}
                {showGrooveForm && shape.points.length > 0 && (
                    <div className="groove-insert-form" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-accent)' }}>
                        <h4 style={{ marginBottom: '0.75rem', color: 'var(--color-accent)' }}>🔧 溝を挿入（点{shape.points.length}の後）</h4>
                        <div className="input-row">
                            <div className="input-group">
                                <label>溝幅</label>
                                <input
                                    type="number"
                                    className="step-input small"
                                    value={grooveWidth}
                                    onChange={(e) => setGrooveWidth(e.target.value)}
                                    placeholder="10.0"
                                />
                            </div>
                            <div className="input-group">
                                <label>溝深さ（片側）</label>
                                <input
                                    type="number"
                                    className="step-input small"
                                    value={grooveDepth}
                                    onChange={(e) => setGrooveDepth(e.target.value)}
                                    placeholder="5.0"
                                />
                            </div>
                        </div>
                        <div className="input-row">
                            <div className="input-group">
                                <label>左底R</label>
                                <input
                                    type="number"
                                    className="step-input small"
                                    value={grooveBottomLeftR}
                                    onChange={(e) => setGrooveBottomLeftR(e.target.value)}
                                    placeholder="0.5"
                                />
                            </div>
                            <div className="input-group">
                                <label>右底R</label>
                                <input
                                    type="number"
                                    className="step-input small"
                                    value={grooveBottomRightR}
                                    onChange={(e) => setGrooveBottomRightR(e.target.value)}
                                    placeholder="0.5"
                                />
                            </div>
                        </div>
                        <div className="input-row">
                            <div className="input-group">
                                <label>左壁角度</label>
                                <input
                                    type="number"
                                    className="step-input small"
                                    value={grooveLeftAngle}
                                    onChange={(e) => setGrooveLeftAngle(e.target.value)}
                                />
                            </div>
                            <div className="input-group">
                                <label>右壁角度</label>
                                <input
                                    type="number"
                                    className="step-input small"
                                    value={grooveRightAngle}
                                    onChange={(e) => setGrooveRightAngle(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="groove-action-buttons" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                            <button className="btn btn-primary" onClick={addGroove}>
                                ✓ 溝（点に付加）
                            </button>
                            <button className="btn btn-accent" onClick={addNusumiPreset} title="垂直に落ちて戻る3点を自動生成">
                                ✨ ぬすみとして3点を追加
                            </button>
                        </div>
                    </div>
                )}

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
                        <div
                            key={point.id}
                            className={`point-item ${editingPointIndex === index ? 'editing' : ''}`}
                            onClick={() => startEditPoint(index)}
                            style={{ cursor: 'pointer' }}
                        >
                            <span className="point-number">{index + 1}</span>
                            <span className="point-coords">X{point.x} Z{point.z}</span>
                            {point.corner.type !== 'none' && (
                                <span className="corner-badge">
                                    {point.corner.type === 'sumi-r' ? `隅R${point.corner.size}`
                                        : point.corner.type === 'kaku-r' ? `角R${point.corner.size}`
                                            : point.corner.type === 'nusumi' ? `盗R${point.corner.size} 深${point.corner.depth ?? ''}`
                                                : `角C${point.corner.size}`}
                                </span>
                            )}
                            {point.groove && (
                                <span className="corner-badge" style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}>
                                    🔧 溝W{point.groove.width}×D{point.groove.depth}
                                </span>
                            )}
                            {editingPointIndex === index && (
                                <span className="corner-badge" style={{ background: 'var(--color-warning)', color: 'var(--color-bg)' }}>
                                    編集中
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 逃し設定 */}
            {shape.points.length >= 2 && machineSettings.noseRCompensation.enabled && (
                <div className="retract-section">
                    <div className="section-label">逃し（直径値）</div>
                    <div className="input-row-compact">
                        <div className="input-group-inline">
                            <label>始点</label>
                            <input
                                type="number"
                                className="step-input small"
                                value={startRetract}
                                onChange={(e) => setStartRetract(e.target.value)}
                                placeholder="0"
                                step="0.1"
                            />
                        </div>
                        <div className="input-group-inline">
                            <label>終点</label>
                            <input
                                type="number"
                                className="step-input small"
                                value={endRetract}
                                onChange={(e) => setEndRetract(e.target.value)}
                                placeholder="0"
                                step="0.1"
                            />
                        </div>
                    </div>
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
