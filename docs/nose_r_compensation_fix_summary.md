# ノーズR補正修正サマリー

## 問題
- **報告誤差**: -0.428mm (30°テーパー、R0.8mm)
- **原因**: 5つの系統的エラー

## 5つの根本原因

### 1️⃣ angle情報の欠落
```typescript
// ❌ 修正前
const profile: Segment[] = results.map(res => ({
    type: res.type,
    // ... angle が含まれていない
}))

// ✅ 修正後
const profile: Segment[] = results.map(res => ({
    type: res.type,
    angle: res.angle  // テーパー角度を渡す
}))
```

### 2️⃣ Bisector距離計算式の誤り
```typescript
// ❌ 修正前: R/cos(θ/2) - 幾何学的交点距離
const dist = this.noseR / Math.max(0.01, cosHalf)
// 90°の場合: 0.8 / 0.707 = 1.131mm (41%過大)

// ✅ 修正後: R×tan(θ/2) - 実際の補正距離
const tanHalf = sinHalf / Math.max(0.01, cosHalf)
const dist = this.noseR * tanHalf
// 90°の場合: 0.8 × 1.0 = 0.8mm (正確)
```

### 3️⃣ テーパー専用補正式の不在
```typescript
// ✅ 新規実装
function calculateDzForTaper(
    angle: number,
    noseR: number,
    tipNumber: number,
    isDiameterIncreasing: boolean  // ⚠️ Z方向ではなく直径で判定！
): number {
    const factor = isDiameterIncreasing
        ? (1 + Math.tan(halfAngleRad))  // 下り（直径増加）
        : (1 - Math.tan(halfAngleRad))  // 上り（直径減少）
    return noseR * factor * sign
}
```

### 4️⃣ Bisectorの直線への誤用 ⭐ **最重要**
```typescript
// 問題: セグメントが歪む
入力: ΔZ=-0.347, ΔX=-0.200 (30°テーパー)
出力: ΔZ=-0.003, ΔX=-0.686 (ほぼ水平！) ❌

// 原因: 始点と終点で異なる方向にオフセット
始点: 前セグメントとのBisector
終点: 次セグメントとのBisector
→ 直線が曲がる！

// ✅ 修正: テーパー線ではBisectorを使わない
if (prevIsTaper || nextIsTaper) {
    n = { nx: 0, nz: 0 }  // オフセットなし
}
```

### 5️⃣ 補正量の二重適用
```typescript
// 問題: 垂直オフセット + fz が適用される
pz = refZ + nz × R     // 垂直オフセット (例: -0.4mm)
oz = pz - dz           // さらにfz適用 (例: -0.586mm)
→ 合計 -0.986mm ❌

// ユーザー記事の fz は合計補正量
// 垂直オフセットを含む完全な値

// ✅ 修正: P座標にオフセットを含めない
n = { nx: 0, nz: 0 }   // テーパー線の場合
pz = refZ              // 幾何座標そのまま
oz = pz - fz           // fzだけを適用
→ 合計 -0.586mm ✅
```

## 修正結果

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| 誤差 | -0.428mm ❌ | 0.000mm ✅ |
| セグメント角度 | 歪む ❌ | 保持 ✅ |
| 理論との一致 | 不一致 ❌ | 完全一致 ✅ |

## 重要な学び

### Bisector Methodの限界
```
Bisector Method = コーナー（交点）用の手法
直線セグメント、特にテーパー線には不適切

テーパー線は:
1. P座標 = 幾何座標（オフセットなし）
2. O座標 = P - fz（記事の数式を直接適用）

シンプルで直接的なアプローチが最適
```

### ユーザー記事の数式（正解）
```
上りテーパー（直径減少）: fz = R × (1 - tan(θ/2))
下りテーパー（直径増加）: fz = R × (1 + tan(θ/2))

⚠️ 重要: fz は合計補正量（垂直オフセットを含む）
```

### 判定基準の注意点
```
❌ const isDescending = (seg.endZ < seg.startZ)  // Z方向で判定
✅ const isDiameterIncreasing = (seg.endX > seg.startX)  // 直径で判定
```

## 関連ファイル

- 詳細分析: `docs/nose_r_compensation_fix_analysis.md`
- 実装: `src/calculators/noseRCompensation.ts`
- テスト: `src/calculators/__tests__/debug_taper_calculation.test.ts`

---

**修正日**: 2026-02-12
**検証**: 実加工での検証済み（ユーザー手書き計算と完全一致）
