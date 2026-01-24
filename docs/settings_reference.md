# NC旋盤座標計算ツール 設定項目リファレンス

このドキュメントは、設定項目がどのように計算に影響するかを説明します。

---

## 1. 座標方向設定

### X軸方向 (`xDirection`)
| 値 | 意味 | 影響 |
|----|------|------|
| `+X ↑` (+1) | X+が上方向（標準） | プレビュー表示の上下反転 |
| `+X ↓` (-1) | X+が下方向 | プレビュー表示の上下反転 |

### Z軸方向 (`zDirection`)
| 値 | 意味 | 影響 |
|----|------|------|
| `+Z →` (+1) | Z+が右方向（標準） | プレビュー表示の左右反転 |
| `+Z ←` (-1) | Z+が左方向 | プレビュー表示の左右反転 |

**注意**: これらは表示のみに影響し、計算結果の座標値自体は変わりません。

---

## 2. 機械設定

### 刃物台 (`toolPost`)
| 値 | 意味 | 計算への影響 |
|----|------|------------|
| `前刃物台` (front) | 手前から加工 | ノーズR補正の法線方向が反転 (`dirX = -1`) |
| `後刃物台` (rear) | 奥から加工 | 標準の法線方向 (`dirX = +1`) |

**実装箇所**: `CenterTrackCalculator.constructor`
```typescript
this.dirX = toolPost === 'rear' ? 1 : -1;
```

### 切削方向 (`cuttingDirection`)
| 値 | 意味 | 計算への影響 |
|----|------|------------|
| `-Z方向` | チャックに向かって切削（標準） | G02/G03の判定、干渉チェック |
| `+Z方向` | チャックから離れて切削 | G02/G03の判定、干渉チェック |

**実装箇所**: `determineGCode()`, `checkInterference()`

---

## 3. ノーズR補正設定

### 補正モード (`noseRCompensation.enabled`)
| 値 | 意味 | 計算への影響 |
|----|------|------------|
| `補正なし` (false) | ワーク形状をそのまま出力 | `compensated` オブジェクトは生成されない |
| `G41/G42補正` (true) | ノーズR補正座標を計算 | `CenterTrackCalculator` が実行される |

### 計算方式 (`noseRCompensation.method`)
| 値 | 意味 | 現状 |
|----|------|------|
| `幾何学的` (geometric) | 法線オフセット法 | 実装済み・使用中 |
| `Smid方式` (smid) | Peter Smid方式 | **未実装**（UI表示のみ） |

**注意**: 現在は `method` の値に関わらず、`geometric` 方式のみが実行されます。

**実装箇所**: `shape.ts` の `calculateShape()` 内でノーズR補正が適用されます。

---

## 4. 工具設定

### 工具ライブラリ内の主要パラメータ

| パラメータ | 例 | 計算への影響 |
|-----------|---|------------|
| `noseRadius` | 0.4 mm | 補正R = 元R ± noseR、法線オフセット量 |
| `toolTipNumber` | 3 | 仮想刃先点Oの位置決定（`pToO` 関数） |
| `type` | external/internal | 法線方向の符号 (`sideSign`) |
| `hand` | right/left | 干渉チェック時の方向判定 |
| `leadAngle` / `backAngle` | 93° / 32° | テーパー干渉チェック |

### 仮想刃先番号 (`toolTipNumber`) の定義
```
    8      1      2
     ╲     │     ╱
   7──── 0 ────3  ← 外径右勝手標準
     ╱     │     ╲
    6      5      4
```

**実装箇所**: `noseRCompensation.ts` の `pToO()` 関数

---

## 5. 設定の保存

設定は `localStorage` に保存され、ブラウザを閉じても維持されます。

- **キー**: `nc_calc_settings`
- **形式**: JSON (`{ machine: {...}, coordinates: {...} }`)

---

## 6. 未実装・未使用の設定

| 設定 | 状態 |
|------|------|
| `noseRCompensation.method = 'smid'` | UI表示のみ、計算ロジックなし |
| `noseRCompensation.offsetNumber` | 表示専用（実際のNCコードには影響しない） |
| `noseRCompensation.compensationDirection` | 自動判定のみ実装、手動指定未実装 |
