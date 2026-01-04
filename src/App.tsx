import { useState } from 'react'
import './App.css'
import { ShapeBuilder } from './components/ShapeBuilder/ShapeBuilder'
import { GrooveCalculator } from './components/calculators/GrooveCalculator'
// import { AdvancedGeometryCalculator } from './components/calculators/AdvancedGeometryCalculator'
import { ToolManager } from './components/ToolManager'
import { SettingsPage } from './components/SettingsPage'

type TabType = 'shape' | 'groove' /* | 'advancedGeo' */ | 'tools' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('shape')

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          <span className="title-icon">⚙️</span>
          NC座標計算
        </h1>
        <nav className="app-tabs">
          <button
            className={`tab-btn ${activeTab === 'shape' ? 'active' : ''}`}
            onClick={() => setActiveTab('shape')}
          >
            📐 形状座標
          </button>
          <button
            className={`tab-btn ${activeTab === 'groove' ? 'active' : ''}`}
            onClick={() => setActiveTab('groove')}
          >
            ⊔ 溝入れ
          </button>
          {/* <button
            className={`tab-btn ${activeTab === 'advancedGeo' ? 'active' : ''}`}
            onClick={() => setActiveTab('advancedGeo')}
          >
            🔄 高度幾何
          </button> */}
          <button
            className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            🛠 工具
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙ 設定
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'shape' && <ShapeBuilder />}
        {activeTab === 'groove' && <GrooveCalculator onBack={() => setActiveTab('shape')} />}
        {/* {activeTab === 'advancedGeo' && <AdvancedGeometryCalculator onBack={() => setActiveTab('shape')} />} */}
        {activeTab === 'tools' && <ToolManager />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

export default App

