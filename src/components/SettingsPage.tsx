import { useState, useEffect } from 'react'
import type { MachineSettings, CoordinateSettings } from '../models/settings'
import { defaultMachineSettings, defaultCoordinateSettings } from '../models/settings'
import './ShapeBuilder/ShapeBuilder.css'

interface AppSettings {
    machine: MachineSettings
    coordinates: CoordinateSettings
}

export function SettingsPage() {
    const [settings, setSettings] = useState<AppSettings>({
        machine: defaultMachineSettings,
        coordinates: defaultCoordinateSettings
    })

    // 初期化時に設定を読み込む
    useEffect(() => {
        const saved = localStorage.getItem('nc_calc_settings')
        if (saved) {
            const parsed = JSON.parse(saved)
            setSettings({
                machine: parsed.machine || defaultMachineSettings,
                coordinates: parsed.coordinates || defaultCoordinateSettings
            })
        }
    }, [])

    // 設定を保存
    const saveSettings = (newSettings: AppSettings) => {
        setSettings(newSettings)
        localStorage.setItem('nc_calc_settings', JSON.stringify(newSettings))
    }

    const updateMachine = (updates: Partial<MachineSettings>) => {
        saveSettings({
            ...settings,
            machine: { ...settings.machine, ...updates }
        })
    }

    const updateCoordinates = (updates: Partial<CoordinateSettings>) => {
        saveSettings({
            ...settings,
            coordinates: { ...settings.coordinates, ...updates }
        })
    }

    return (
        <div className="shape-builder">
            <div className="builder-header">
                <h2>⚙ 設定</h2>
            </div>

            {/* 機械設定 */}
            <div className="input-section">
                <h3 style={{ margin: '0 0 1rem 0' }}>🏭 機械設定</h3>

                <div className="input-row">
                    <div className="input-group">
                        <label>刃物台位置</label>
                        <div className="segment-type-buttons">
                            <button
                                className={`type-btn ${settings.machine.toolPost === 'front' ? 'active' : ''}`}
                                onClick={() => updateMachine({ toolPost: 'front' })}
                            >
                                前刃物台
                            </button>
                            <button
                                className={`type-btn ${settings.machine.toolPost === 'rear' ? 'active' : ''}`}
                                onClick={() => updateMachine({ toolPost: 'rear' })}
                            >
                                後刃物台
                            </button>
                        </div>
                    </div>
                </div>

                <div className="input-row" style={{ marginTop: '1rem' }}>
                    <div className="input-group">
                        <label>切削方向</label>
                        <div className="segment-type-buttons">
                            <button
                                className={`type-btn ${settings.machine.cuttingDirection === '-z' ? 'active' : ''}`}
                                onClick={() => updateMachine({ cuttingDirection: '-z' })}
                            >
                                Z－方向
                            </button>
                            <button
                                className={`type-btn ${settings.machine.cuttingDirection === '+z' ? 'active' : ''}`}
                                onClick={() => updateMachine({ cuttingDirection: '+z' })}
                            >
                                Z＋方向
                            </button>
                        </div>
                    </div>
                </div>

                <div className="input-hint" style={{ marginTop: '1rem' }}>
                    前刃物台＋Z－方向が一般的なNC旋盤の設定です
                </div>
            </div>

            {/* 座標表示設定 */}
            <div className="input-section" style={{ marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 1rem 0' }}>📐 座標表示設定</h3>

                <div className="input-row">
                    <div className="input-group">
                        <label>X座標表示</label>
                        <div className="segment-type-buttons">
                            <button
                                className={`type-btn ${settings.coordinates.diameterMode ? 'active' : ''}`}
                                onClick={() => updateCoordinates({ diameterMode: true })}
                            >
                                直径指令
                            </button>
                            <button
                                className={`type-btn ${!settings.coordinates.diameterMode ? 'active' : ''}`}
                                onClick={() => updateCoordinates({ diameterMode: false })}
                            >
                                半径指令
                            </button>
                        </div>
                    </div>
                </div>

                <div className="input-row" style={{ marginTop: '1rem' }}>
                    <div className="input-group">
                        <label>小数点以下桁数</label>
                        <select
                            className="step-input small"
                            value={settings.coordinates.decimalPlaces}
                            onChange={(e) => updateCoordinates({ decimalPlaces: parseInt(e.target.value) as 1 | 2 | 3 | 4 })}
                        >
                            <option value={1}>1桁 (0.1)</option>
                            <option value={2}>2桁 (0.01)</option>
                            <option value={3}>3桁 (0.001)</option>
                            <option value={4}>4桁 (0.0001)</option>
                        </select>
                    </div>
                </div>

                <div className="input-hint" style={{ marginTop: '1rem' }}>
                    直径指令が一般的なNC旋盤の設定です
                </div>
            </div>

            {/* 保存状態表示 */}
            <div className="input-section" style={{ marginTop: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--color-success)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)' }}>
                    <span>✓</span>
                    <span>設定は自動的に保存されます</span>
                </div>
            </div>

            {/* 初期化オプション */}
            <div className="input-section" style={{ marginTop: '1rem', border: '1px dashed var(--color-border)' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-text-secondary)' }}>⚠️ 初期化オプション</h3>
                <button
                    className="btn btn-secondary"
                    style={{ width: '100%', color: 'var(--color-accent-secondary)' }}
                    onClick={() => {
                        if (window.confirm('工具ライブラリを標準プリセット（WNMG, DNMG等）に戻しますか？作成した工具データは消去されます。')) {
                            updateMachine({
                                toolLibrary: defaultMachineSettings.toolLibrary,
                                activeToolId: defaultMachineSettings.activeToolId
                            })
                            alert('工具ライブラリを更新しました。「工具」タブを確認してください。')
                        }
                    }}
                >
                    🛠 工具ライブラリを最新プリセットに戻す
                </button>
            </div>
        </div>
    )
}
