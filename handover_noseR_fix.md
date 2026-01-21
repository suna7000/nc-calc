# ノーズR補正修正 - 引き継ぎドキュメント

## 1. 問題の原因特定（二重補正）

### 発見された問題

`calculateCorner`と`CenterTrackCalculator`の両方でノーズR補正が適用され、**二重補正**が発生していた。

```
【誤った処理フロー】
1. calculateCorner: 補正R（元R + noseR）で接点計算 → X45.973
2. CenterTrackCalculator: さらに法線方向にnoseR分オフセット → X46.207
   → 結果: 約0.24mmの過剰補正
```

### 修正内容

1. **`shape.ts` - calculateCorner**:
   - 補正R（元R + noseR）を使用して接点計算 ✅
   - noseRパラメータを復元

2. **`noseRCompensation.ts` - CenterTrackCalculator**:
   - 法線オフセットを無効化（既に補正済み）
   - pToO変換も無効化（座標は既に仮想刃先点O）
   - `calculateArcOffset`: 円弧半径補正を無効化

---

## 2. 正しい計算方法の確立

### 確定した計算フロー

```
【正しい処理フロー】
1. calculateCorner: 補正R（元R + noseR）で接点計算
2. CenterTrackCalculator: 何もしない（パススルー）
3. 出力: NCプログラムに直接書ける座標（G41/G42不要）
```

### 計算式（工場長のネタ帳/SKILL.mdより）

```javascript
// 補正R
補正R = 元R + noseR  // 角R（凸）の場合
補正R = 元R - noseR  // 隅R（凹）の場合

// 接線距離
接線距離 = 補正R / tan(θ/2)

// 接点座標（B点 = 円弧始点）
B点_X = 基準X
B点_Z = 基準Z + 接線距離  // Z方向に戻る

// 円弧終点（A点）
bd間 = 補正R × (1 - cos(θ))
de間 = 補正R × sin(θ)
A点_X = B点_X - 2 × bd間
A点_Z = B点_Z - de間
```

---

## 3. 更新したドキュメント一覧

| ファイル | 変更内容 |
|---------|---------|
| `shape.ts` | calculateCornerにnoseRパラメータ復元、補正Rで接点計算 |
| `noseRCompensation.ts` | CenterTrackCalculator無効化、calculateArcOffset無効化 |

### 新規作成テストファイル

- `compare_all.test.ts`: 理論計算・アプリ出力・ユーザー期待値の比較
- `koujoucho_method.test.ts`: 工場長のネタ帳の計算方法検証
- `skill_formula.test.ts`: SKILL.mdの計算式検証
- `user_expectation.test.ts`: ユーザー期待値再現テスト

---

## 4. 確定した仕様（G41/G42不要）

### 出力仕様

- **目的**: NCプログラムに直接書ける座標を出力
- **G41/G42**: **不要**（アプリ側で補正計算済み）
- **出力座標**: 仮想刃先点O（工具中心Pではない）

### UIの「geometric/smid」設定

- 現状、計算ロジックでは**使用されていない**
- 将来的に2つの計算方式を切り替える想定だが未実装

---

## 5. 残課題（Z座標のずれ0.56mm）

### 現状

| 項目 | アプリ出力 | ユーザー期待値 | 差 |
|------|-----------|--------------|-----|
| R終点X | **45.973** | **45.97** | ✅ 0.003mm |
| R始点Z | -100.627 | -101.19 | ❌ **0.563mm** |
| R終点Z | -101.264 | -101.82 | ❌ **0.556mm** |

### 0.56mmの原因仮説

1. **ノーズR補正量（fz）の適用漏れ**
   - 公式: `fz = noseR × (1 - tan(θ/2))`
   - θ=45度、noseR=0.4の場合: `fz = 0.4 × (1 - 0.4142) = 0.234mm`
   - これでは0.56mmの説明がつかない

2. **接点計算の基準点が異なる**
   - ユーザー期待値はZ-101.19（コーナー点-101から-0.19mm先）
   - 私の計算はZ-100.627（コーナー点から+0.373mm手前）
   - 符号が逆転している

3. **補正Rで計算した座標の解釈が異なる**
   - 私の理解: 補正Rで計算 = 工具中心軌跡P（のつもりだったが実際は違う？）

---

## 6. 必要な修正の方針

### 短期（優先）

1. **ユーザー期待値の計算過程を確認**
   - `Z-101.19`がどのように算出されたか
   - 使用した計算式・基準点

2. **calculateCornerの接点計算ロジックを検証**
   - 二等分線方向の計算が正しいか
   - 接線距離の適用方向が正しいか

### 中期

1. **geometric/smid切り替えの実装**
   - settings.tsの`method`設定を計算ロジックで使用

2. **テストケースの充実**
   - ユーザー期待値に基づく検証テスト追加

### 参考資料

- 工場長のネタ帳: https://koujoucho-neta.com/
- SKILL.md: `/Users/sin-mac/nc-calc/.agent/skills/noseR-calculation/SKILL.md`
- nose_r_compensation_reference.md: `/Users/sin-mac/nc-calc/docs/nose_r_compensation_reference.md`
