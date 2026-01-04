import type { MachineSettings, Tool, ToolTipNumber, MachiningType } from '../../models/settings'

interface ToolSettingsProps {
    machineSettings: MachineSettings
    onUpdate: (settings: Partial<MachineSettings>) => void
}

export function ToolSettings({ machineSettings, onUpdate }: ToolSettingsProps) {
    const { toolLibrary, activeToolId } = machineSettings

    const handleAddTool = () => {
        const newTool: Tool = {
            id: `t${Date.now()}`,
            name: '新規工具',
            type: 'external',
            hand: 'right',
            noseRadius: 0.4,
            toolTipNumber: 3,
            leadAngle: 93,
            backAngle: 3
        }
        onUpdate({
            toolLibrary: [...toolLibrary, newTool]
        })
    }

    const handleUpdateTool = (id: string, updates: Partial<Tool>) => {
        onUpdate({
            toolLibrary: toolLibrary.map(t => t.id === id ? { ...t, ...updates } : t)
        })
    }

    const handleDeleteTool = (id: string) => {
        if (toolLibrary.length <= 1) return
        const newLibrary = toolLibrary.filter(t => t.id !== id)
        onUpdate({
            toolLibrary: newLibrary,
            activeToolId: activeToolId === id ? newLibrary[0].id : activeToolId
        })
    }

    return (
        <div className="tool-settings">
            <h3>🛠 工具ライブラリ</h3>
            <div className="tool-list">
                {toolLibrary.map(tool => (
                    <div key={tool.id} className={`tool-item ${tool.id === activeToolId ? 'active' : ''}`}>
                        <div className="tool-header">
                            <input
                                type="text"
                                value={tool.name}
                                onChange={(e) => handleUpdateTool(tool.id, { name: e.target.value })}
                                placeholder="工具名"
                            />
                            <div className="tool-actions">
                                <button
                                    className={`btn-select ${tool.id === activeToolId ? 'selected' : ''}`}
                                    onClick={() => onUpdate({ activeToolId: tool.id })}
                                >
                                    {tool.id === activeToolId ? '選択中' : '選択'}
                                </button>
                                <button className="btn-delete" onClick={() => handleDeleteTool(tool.id)}>削除</button>
                            </div>
                        </div>

                        <div className="tool-grid">
                            <div className="field">
                                <label>加工種別</label>
                                <select
                                    value={tool.type}
                                    onChange={(e) => handleUpdateTool(tool.id, { type: e.target.value as MachiningType })}
                                >
                                    <option value="external">外径</option>
                                    <option value="internal">内径</option>
                                    <option value="facing">端面</option>
                                    <option value="grooving">溝入れ</option>
                                </select>
                            </div>
                            <div className="field">
                                <label>ノーズR</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={tool.noseRadius}
                                    onChange={(e) => handleUpdateTool(tool.id, { noseRadius: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="field">
                                <label>工具の勝手</label>
                                <select
                                    value={tool.hand}
                                    onChange={(e) => handleUpdateTool(tool.id, { hand: e.target.value as 'right' | 'left' | 'neutral' })}
                                >
                                    <option value="right">右勝手</option>
                                    <option value="left">左勝手</option>
                                    <option value="neutral">勝手なし</option>
                                </select>
                            </div>
                            <div className="field">
                                <label>仮想刃先(0-9)</label>
                                <input
                                    type="number"
                                    min="0" max="9"
                                    value={tool.toolTipNumber}
                                    onChange={(e) => handleUpdateTool(tool.id, { toolTipNumber: (parseInt(e.target.value) || 0) as ToolTipNumber })}
                                />
                            </div>
                            {tool.type === 'grooving' ? (
                                <>
                                    <div className="field">
                                        <label>工具幅</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={tool.width}
                                            onChange={(e) => handleUpdateTool(tool.id, { width: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="field">
                                        <label>基準点</label>
                                        <select
                                            value={tool.referencePoint || 'left'}
                                            onChange={(e) => handleUpdateTool(tool.id, { referencePoint: e.target.value as 'left' | 'center' | 'right' })}
                                        >
                                            <option value="left">左端</option>
                                            <option value="center">中央</option>
                                            <option value="right">右端</option>
                                        </select>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="field">
                                        <label>主切刃角(°)</label>
                                        <input
                                            type="number"
                                            value={tool.leadAngle}
                                            onChange={(e) => handleUpdateTool(tool.id, { leadAngle: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="field">
                                        <label>副切刃角(°)</label>
                                        <input
                                            type="number"
                                            value={tool.backAngle}
                                            onChange={(e) => handleUpdateTool(tool.id, { backAngle: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <button className="btn-add" onClick={handleAddTool}>+ 新しい工具を追加</button>

            <style dangerouslySetInnerHTML={{
                __html: `
                .tool-settings {
                    margin-top: 1rem;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                }
                .tool-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }
                .tool-item {
                    padding: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    background: rgba(0, 0, 0, 0.2);
                }
                .tool-item.active {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 10px rgba(var(--color-primary-rgb), 0.2);
                }
                .tool-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 1rem;
                }
                .tool-header input {
                    background: transparent;
                    border: none;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    font-size: 1.1rem;
                    font-weight: bold;
                    width: 60%;
                }
                .tool-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 0.8rem;
                }
                .field {
                    display: flex;
                    flex-direction: column;
                    gap: 0.3rem;
                }
                .field label {
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.6);
                }
                .field input, .field select {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                    color: white;
                    padding: 4px 8px;
                }
                .btn-add {
                    width: 100%;
                    padding: 0.8rem;
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                }
                .btn-select {
                    padding: 4px 12px;
                    border-radius: 4px;
                    border: 1px solid var(--color-primary);
                    background: transparent;
                    color: var(--color-primary);
                    cursor: pointer;
                }
                .btn-select.selected {
                    background: var(--color-primary);
                    color: white;
                }
                .btn-delete {
                    padding: 4px 12px;
                    background: transparent;
                    color: #ff4d4d;
                    border: 1px solid #ff4d4d;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-left: 0.5rem;
                }
            `}} />
        </div>
    )
}
