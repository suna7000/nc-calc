import { useState, useEffect } from 'react'
import type { MachineSettings, Tool, ToolTipNumber, MachiningType, InsertShape } from '../models/settings'
import { defaultMachineSettings } from '../models/settings'
import { ToolIcon } from './ToolIcon'
import './ShapeBuilder/ShapeBuilder.css'
import './ToolManager.css'

export function ToolManager() {
    const [machineSettings, setMachineSettings] = useState<MachineSettings>(defaultMachineSettings)
    const [isAdding, setIsAdding] = useState(false)
    const [editingToolId, setEditingToolId] = useState<string | null>(null)

    // 初期化時に設定を読み込む
    useEffect(() => {
        const saved = localStorage.getItem('nc_calc_settings')
        if (saved) {
            const parsed = JSON.parse(saved)
            if (parsed.machine) {
                setMachineSettings(parsed.machine)
            }
        }
    }, [])

    // 設定を保存
    const saveSettings = (newSettings: MachineSettings) => {
        setMachineSettings(newSettings)
        const saved = localStorage.getItem('nc_calc_settings')
        const current = saved ? JSON.parse(saved) : {}
        localStorage.setItem('nc_calc_settings', JSON.stringify({
            ...current,
            machine: newSettings
        }))
    }

    const handleAddTool = (shape: InsertShape) => {
        const id = `t${Date.now()}`
        const toolDefaults: Record<InsertShape, Partial<Tool>> = {
            W: { type: 'external', leadAngle: 95, backAngle: 5, noseRadius: 0.8, toolTipNumber: 3 },
            C: { type: 'external', leadAngle: 95, backAngle: 5, noseRadius: 0.8, toolTipNumber: 3 },
            D: { type: 'external', leadAngle: 93, backAngle: 32, noseRadius: 0.4, toolTipNumber: 3 },
            V: { type: 'external', leadAngle: 93, backAngle: 52, noseRadius: 0.4, toolTipNumber: 3 },
            S: { type: 'external', leadAngle: 45, backAngle: 45, noseRadius: 0.8, toolTipNumber: 3 },
            T: { type: 'external', leadAngle: 93, backAngle: 27, noseRadius: 0.4, toolTipNumber: 3 },
            R: { type: 'external', leadAngle: 0, backAngle: 0, noseRadius: 4.0, toolTipNumber: 3 },
            K: { type: 'external', leadAngle: 93, backAngle: 32, noseRadius: 0.4, toolTipNumber: 3 },
            L: { type: 'external', leadAngle: 90, backAngle: 0, noseRadius: 0.4, toolTipNumber: 3 },
            A: { type: 'external', leadAngle: 95, backAngle: 0, noseRadius: 0.4, toolTipNumber: 3 },
            B: { type: 'external', leadAngle: 95, backAngle: 3, noseRadius: 0.4, toolTipNumber: 3 },
            H: { type: 'external', leadAngle: 90, backAngle: 0, noseRadius: 0.4, toolTipNumber: 3 },
            M: { type: 'external', leadAngle: 95, backAngle: -1, noseRadius: 0.4, toolTipNumber: 3 },
            O: { type: 'external', leadAngle: 90, backAngle: 0, noseRadius: 0.4, toolTipNumber: 3 },
            P: { type: 'external', leadAngle: 90, backAngle: 0, noseRadius: 0.4, toolTipNumber: 3 },
            GROOVING: { type: 'grooving', width: 3, noseRadius: 0.2, toolTipNumber: 3, referencePoint: 'left', leadAngle: 90, backAngle: 0 },
            THREADING: { type: 'threading', noseRadius: 0.1, toolTipNumber: 3, width: 2.0, leadAngle: 60, backAngle: 0 },
            OTHER: { type: 'external', noseRadius: 0.4, toolTipNumber: 3, leadAngle: 90, backAngle: 5 }
        }

        const selectedDefaults = toolDefaults[shape]
        const newTool: Tool = {
            id,
            name: `${shape}形状 工具`,
            insertShape: shape,
            hand: 'right',
            type: selectedDefaults.type as MachiningType,
            noseRadius: selectedDefaults.noseRadius || 0.4,
            toolTipNumber: selectedDefaults.toolTipNumber as ToolTipNumber,
            ...selectedDefaults
        } as Tool

        saveSettings({
            ...machineSettings,
            toolLibrary: [...machineSettings.toolLibrary, newTool],
            activeToolId: id
        })
        setIsAdding(false)
        setEditingToolId(id)
    }

    const handleUpdateTool = (id: string, updates: Partial<Tool>) => {
        saveSettings({
            ...machineSettings,
            toolLibrary: machineSettings.toolLibrary.map((t: Tool) =>
                t.id === id ? { ...t, ...updates } : t
            )
        })
    }

    const handleDeleteTool = (id: string) => {
        if (machineSettings.toolLibrary.length <= 1) return
        const newLibrary = machineSettings.toolLibrary.filter((t: Tool) => t.id !== id)
        saveSettings({
            ...machineSettings,
            toolLibrary: newLibrary,
            activeToolId: machineSettings.activeToolId === id ? newLibrary[0].id : machineSettings.activeToolId
        })
    }

    const handleSelectTool = (id: string) => {
        saveSettings({
            ...machineSettings,
            activeToolId: id
        })
    }

    const { toolLibrary, activeToolId } = machineSettings
    const editingTool = toolLibrary.find((t: Tool) => t.id === editingToolId)

    // デフォルト工具のIDリスト（これらは表示しない）
    const defaultIds = ['t01', 't02', 't03', 't04', 't05']
    const userTools = toolLibrary.filter((t: Tool) => !defaultIds.includes(t.id))

    const shapeOptions: { label: string; value: InsertShape }[] = [
        { label: 'W (六角80°)', value: 'W' },
        { label: 'C (菱形80°)', value: 'C' },
        { label: 'D (菱形55°)', value: 'D' },
        { label: 'V (菱形35°)', value: 'V' },
        { label: 'S (正方形)', value: 'S' },
        { label: 'T (三角形)', value: 'T' },
        { label: 'R (丸駒)', value: 'R' },
        { label: 'K (55°平行)', value: 'K' },
        { label: 'L (長方形)', value: 'L' },
        { label: 'A (菱形85°)', value: 'A' },
        { label: 'B (菱形82°)', value: 'B' },
        { label: 'H (六角)', value: 'H' },
        { label: 'M (菱形86°)', value: 'M' },
        { label: 'O (八角)', value: 'O' },
        { label: 'P (五角)', value: 'P' },
        { label: '溝入れ', value: 'GROOVING' },
        { label: 'ねじ切り', value: 'THREADING' },
        { label: 'その他', value: 'OTHER' }
    ]

    return (
        <div className="shape-builder">
            <div className="builder-header">
                <h2>🛠 工具管理</h2>
            </div>

            {/* 工具リスト（カード型表示） */}
            <div className="input-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>工具ライブラリ</h3>
                    <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
                        + 追加
                    </button>
                </div>

                <div className="tool-grid">
                    {userTools.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🧰</div>
                            <p>工具が登録されていません。<br />「+ 追加」から自分流の工具を登録しましょう！</p>
                        </div>
                    ) : (
                        userTools.map((tool: Tool) => (
                            <div
                                key={tool.id}
                                className={`tool-card ${tool.id === activeToolId ? 'active' : ''}`}
                                onClick={() => handleSelectTool(tool.id)}
                            >
                                {tool.id === activeToolId && <div className="active-tool-badge">✓</div>}
                                <div className="tool-card-icon">
                                    <ToolIcon shape={tool.insertShape || 'OTHER'} size={50} color={tool.id === activeToolId ? 'var(--color-success)' : '#e6b422'} />
                                </div>
                                <div className="tool-card-name" title={tool.name}>{tool.name}</div>
                                <div className="tool-card-info">
                                    {tool.type === 'grooving' ? `幅 ${tool.width}mm` : `R${tool.noseRadius}`}
                                </div>
                                <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', width: '100%', marginTop: 'auto' }}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setEditingToolId(tool.id)
                                    }}
                                >
                                    設定
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 新規登録：形状選択オーバーレイ */}
            {isAdding && (
                <div className="tool-edit-overlay" onClick={() => setIsAdding(false)}>
                    <div className="tool-edit-sheet" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>チップ形状を選択</h3>
                            <button className="btn" onClick={() => setIsAdding(false)}>✕</button>
                        </div>
                        <div className="shape-selection-grid">
                            {shapeOptions.map(opt => (
                                <div key={opt.value} className="shape-item" onClick={() => handleAddTool(opt.value)}>
                                    <ToolIcon shape={opt.value} size={32} />
                                    <span>{opt.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 編集ボトムシート */}
            {editingTool && (
                <div className="tool-edit-overlay" onClick={() => setEditingToolId(null)}>
                    <div className="tool-edit-sheet" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <ToolIcon shape={editingTool.insertShape || 'OTHER'} size={40} color="var(--color-accent)" />
                                <h3 style={{ margin: 0 }}>工具の編集</h3>
                            </div>
                            <button className="btn" onClick={() => setEditingToolId(null)}>完了</button>
                        </div>

                        <div className="input-row">
                            <div className="input-group">
                                <label>工具名</label>
                                <input
                                    type="text"
                                    className="step-input"
                                    value={editingTool.name}
                                    onChange={(e) => handleUpdateTool(editingTool.id, { name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="input-row">
                            <div className="input-group">
                                <label>加工種別</label>
                                <select
                                    className="step-input small"
                                    value={editingTool.type}
                                    onChange={(e) => handleUpdateTool(editingTool.id, { type: e.target.value as MachiningType })}
                                >
                                    <option value="external">外径</option>
                                    <option value="internal">内径</option>
                                    <option value="facing">端面</option>
                                    <option value="grooving">溝入れ</option>
                                    <option value="threading">ねじ切り</option>
                                    <option value="other">その他</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>工具の勝手</label>
                                <select
                                    className="step-input small"
                                    value={editingTool.hand}
                                    onChange={(e) => handleUpdateTool(editingTool.id, { hand: e.target.value as 'right' | 'left' | 'neutral' })}
                                >
                                    <option value="right">右勝手</option>
                                    <option value="left">左勝手</option>
                                    <option value="neutral">勝手なし</option>
                                </select>
                            </div>
                        </div>

                        {editingTool.type === 'grooving' ? (
                            <div className="input-row">
                                <div className="input-group">
                                    <label>工具幅 (mm)</label>
                                    <input
                                        type="number"
                                        className="step-input small"
                                        step="0.1"
                                        value={editingTool.width || ''}
                                        onChange={(e) => handleUpdateTool(editingTool.id, { width: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>基準点</label>
                                    <select
                                        className="step-input small"
                                        value={editingTool.referencePoint || 'left'}
                                        onChange={(e) => handleUpdateTool(editingTool.id, { referencePoint: e.target.value as 'left' | 'center' | 'right' })}
                                    >
                                        <option value="left">左端</option>
                                        <option value="center">中央</option>
                                        <option value="right">右端</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="input-row">
                                    <div className="input-group">
                                        <label>ノーズR (mm)</label>
                                        <input
                                            type="number"
                                            className="step-input small"
                                            step="0.01"
                                            value={editingTool.noseRadius}
                                            onChange={(e) => handleUpdateTool(editingTool.id, { noseRadius: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>仮想刃先 (0-9)</label>
                                        <input
                                            type="number"
                                            className="step-input small"
                                            min="0" max="9"
                                            value={editingTool.toolTipNumber}
                                            onChange={(e) => handleUpdateTool(editingTool.id, { toolTipNumber: (parseInt(e.target.value) || 0) as ToolTipNumber })}
                                        />
                                    </div>
                                </div>
                                <div className="input-row">
                                    <div className="input-group">
                                        <label>主切刃角 (°)</label>
                                        <input
                                            type="number"
                                            className="step-input small"
                                            value={editingTool.leadAngle}
                                            onChange={(e) => handleUpdateTool(editingTool.id, { leadAngle: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>副切刃角 (°)</label>
                                        <input
                                            type="number"
                                            className="step-input small"
                                            value={editingTool.backAngle}
                                            onChange={(e) => handleUpdateTool(editingTool.id, { backAngle: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                            <button
                                className="btn"
                                onClick={() => {
                                    if (window.confirm('この工具を削除しますか？')) {
                                        handleDeleteTool(editingTool.id)
                                        setEditingToolId(null)
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: '1px solid var(--color-danger)',
                                    color: 'var(--color-danger)'
                                }}
                            >
                                削除
                            </button>
                            <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setEditingToolId(null)}>
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
