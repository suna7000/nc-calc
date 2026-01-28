# 引き渡しレポート: ノーズR補正 隅R10問題

**作成日**: 2026年1月28日  
**対象形状**: X85/X100 段差 + 隅R10 + 角R0.5

---

## 1. 問題の形状

```
入力:
P1: X85 Z0
P2: X85 Z-458 (隅R10) ← 凹R
P3: X100 Z-458 (角R0.5) ← 凸R
P4: X100 Z-470

ノーズR: 0.8
```

![手書き図面](file:///Users/sin-mac/.gemini/antigravity/brain/fa1bd663-c2a5-430d-aa74-e96be9f8c194/uploaded_media_2_1769594193624.jpg)

---

## 2. 期待値と現状

| 項目 | 期待値 | 現在の出力 | 差異 |
|------|--------|-----------|------|
| 隅R10始点 Z | **-449.118** | -448.800 | **0.318mm** |

**注意**: この図面に45度テーパーは存在しない。前回レポートの「45度テーパー接続」は別テストケースの話。

---

## 3. 今回修正した内容

### ✅ R自動縮小ロジックの削除

**ファイル**: `src/calculators/shape.ts` (798-806行目)

**修正前**: 隅R10が自動的にR7.425に縮小されていた
**修正後**: ユーザー指定のRをそのまま使用

```diff
- if (tDist_in > l1 * 0.99 || tDist_out > l2 * 0.99) {
-     const maxR = Math.min(l1, l2) * 0.99 * Math.tan(half)
-     finalSize = Math.min(finalSize, maxR)
-     ...
- }
+ // ユーザー指定のRを尊重（自動縮小は行わない）
+ tDist_in = tDist_out = finalSize / Math.tan(half)
```

**結果**: R10が維持されるようになった (R: 10, 補正R: 9.2 ✅)

---

## 4. 残りの問題: 0.318mmのZオフセット

### 現象

```
ワーク形状Z: -448.000 ✅ (正しい: -458 + R10)
補正後Z:    -448.800 (pToOで noseR 0.8 を引いただけ)
期待Z:      -449.118
差異:        0.318mm
```

### 原因の仮説

`noseRCompensation.ts` の `pToO` 関数が単純に `oz = pz - noseR` としているため、**コーナー部での追加シフト（二等分線投影法）** が考慮されていない。

0.318mm ≈ tan(22.5°) × 0.8 ≈ 0.331mm に近い値。

### 調査すべき箇所

| ファイル | 関数 | 確認ポイント |
|---------|------|-------------|
| `noseRCompensation.ts` | `pToO()` (40-52行) | Z方向オフセットの計算式 |
| `noseRCompensation.ts` | `calculate()` (66-125行) | ノード生成時の法線計算 |
| `noseRCompensation.ts` | `getNormalAt()` (141-159行) | 法線ベクトルの極性 |

---

## 5. テストファイル

**検証用テスト**: `src/calculators/__tests__/sumi_r10_debug.test.ts`

```bash
npm test -- --run src/calculators/__tests__/sumi_r10_debug.test.ts
```

---

## 6. 現在のテスト状況

```
全テスト: 42 passed / 11 failed
主な失敗:
- shape_matrix: S字接続の精度
- toolpost_diff: gCode判定
- user_regression: スパイク (X=80)
```

---

## 7. ユーザーへの確認事項

期待値 `-449.118` がどういう計算で得られたか確認が必要：
- 使用したCAMソフト
- 計算式（可能であれば）
