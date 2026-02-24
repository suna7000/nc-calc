# ノーズR補正 クイックリファレンス

## 🚨 重要なルール

### ✅ DO（すべきこと）

```typescript
// 1. テーパー線の angle 情報を必ず伝達
const profile: Segment[] = results.map(res => ({
    ...res,
    angle: res.angle  // ⭐ 必須
}))

// 2. テーパー線では n = {0, 0} を使用
if (isTaperSegment(seg)) {
    n = { nx: 0, nz: 0 }  // P座標にオフセットなし
}

// 3. 直径で「上り/下り」を判定
const isDiameterIncreasing = seg.endX > seg.startX

// 4. テーパー専用関数を使用
if (isTaperSegment(seg)) {
    dz = calculateDzForTaper(seg.angle, noseR, tipNumber, isDiameterIncreasing)
}

// 5. Bisector距離は R×tan(θ/2)
const tanHalf = sinHalf / Math.max(0.01, cosHalf)
const dist = noseR * tanHalf
```

### ❌ DON'T（してはいけないこと）

```typescript
// 1. angle 情報を落とさない
// ❌ const profile = results.map(res => ({ type: res.type, ... }))

// 2. テーパー線にBisectorを使わない
// ❌ if (isTaperSegment) { n = this.getNormalAt(seg, 'end') }

// 3. Z座標で判定しない
// ❌ const isDescending = seg.endZ < seg.startZ

// 4. 標準dz計算を使わない
// ❌ dz = isConvex ? 0 : noseR

// 5. Bisector距離で R/cos を使わない
// ❌ const dist = noseR / Math.max(0.01, cosHalf)
```

## 📐 数式リファレンス

### テーパー補正式（ユーザーの記事）

```typescript
// 上りテーパー（直径減少）
fz = R × (1 - tan(θ/2))

// 下りテーパー（直径増加）
fz = R × (1 + tan(θ/2))

// 垂直線
fz = R

// 水平線
fz = 0
```

### Bisector距離

```typescript
// 正しい式
dist = R × tan(θ/2)

// 間違った式（使用禁止）
dist = R / cos(θ/2)  // ❌ 過大評価
```

### 補正座標計算

```typescript
// テーパー線の場合
P座標 = 幾何座標（オフセットなし）
O座標 = P座標 - fz

// コーナーの場合（非テーパー）
P座標 = 幾何座標 + 垂直オフセット
O座標 = P座標 - dz
```

## 🔍 判定フロー

### テーパー線の判定

```typescript
function isTaperSegment(seg: Segment): boolean {
    return seg.type === 'line' &&
           seg.angle !== undefined &&
           seg.angle !== 0 &&
           seg.angle !== 90
}
```

### 上り/下り判定

```typescript
// ✅ 正しい
const isDiameterIncreasing = seg.endX > seg.startX

// ❌ 間違い
const isDescending = seg.endZ < seg.startZ  // Z方向は無関係
```

## 🎯 典型的な実装パターン

### ノード計算

```typescript
// 端点ノード
if (i === 0 || i === profile.length) {
    const seg = (i === 0) ? profile[0] : profile[profile.length - 1]

    if (isTaperSegment(seg)) {
        n = { nx: 0, nz: 0 }  // ⭐ テーパー: オフセットなし
    } else {
        n = this.getNormalAt(seg, pos)
    }
}

// 接続点ノード
else {
    if (isTaperSegment(prevSeg) || isTaperSegment(nextSeg)) {
        n = { nx: 0, nz: 0 }  // ⭐ テーパー: オフセットなし
    } else {
        // 通常のBisector計算
        bisec = this.calculateBisector(n1, n2)
        n = {
            nx: bisec.bx * (bisec.dist / noseR),
            nz: bisec.bz * (bisec.dist / noseR)
        }
    }
}
```

### dz計算

```typescript
if (isTaperSegment(seg)) {
    // ⭐ テーパー専用
    const isDiameterIncreasing = seg.endX > seg.startX
    dz = calculateDzForTaper(
        seg.angle,
        noseR,
        tipNumber,
        isDiameterIncreasing
    )
} else {
    // 通常のセグメント
    dz = calculateDzFromBisector(
        bisec,
        noseR,
        tipNumber,
        isConvex
    )
}
```

## 📊 数値例

### 30°テーパー（R=0.8mm、上り）

```typescript
angle = 30              // 度
R = 0.8                 // mm
theta_half = 15         // 度
tan_15 = 0.2679

fz = 0.8 × (1 - 0.2679)
   = 0.8 × 0.7321
   = 0.586 mm

入力: Z-46
出力: Z-46.586
```

### 90°コーナー（R=0.8mm）

```typescript
// Bisector距離
angle = 90              // 度
theta_half = 45         // 度

正しい: dist = 0.8 × tan(45°) = 0.8 × 1.0 = 0.8 mm ✅
間違い: dist = 0.8 / cos(45°) = 0.8 / 0.707 = 1.13 mm ❌
誤差: 0.33 mm (41%過大)
```

## 🧪 テストの書き方

### テーパー補正のテスト

```typescript
it('30°テーパー（上り）の補正', () => {
    const seg = {
        type: 'line',
        startX: 60,
        startZ: -45.653,
        endX: 59.6,
        endZ: -46,
        angle: 30
    }

    const result = calculateCompensation(seg, { noseR: 0.8, tipNumber: 3 })

    // 期待値
    const expectedZ = -46.586

    expect(result.endZ).toBeCloseTo(expectedZ, 3)  // 0.001mm精度
})
```

### セグメント形状保持のテスト

```typescript
it('テーパー角度の保持', () => {
    const inputAngle = 30
    const inputDZ = seg.endZ - seg.startZ
    const inputDX = seg.endX - seg.startX

    const result = calculateCompensation(seg)

    const outputDZ = result.endZ - result.startZ
    const outputDX = result.endX - result.startX

    // 角度が保持されているか
    expect(outputDZ).toBeCloseTo(inputDZ, 2)
    expect(outputDX).toBeCloseTo(inputDX, 2)
})
```

## ⚠️ よくある間違い

### 間違い1: angle情報の欠落

```typescript
// ❌ 間違い
const profile = results.map(res => ({
    type: res.type,
    startX: res.startX,
    // angle が含まれていない
}))

// ✅ 正しい
const profile = results.map(res => ({
    type: res.type,
    startX: res.startX,
    angle: res.angle  // 必須
}))
```

### 間違い2: Z座標での判定

```typescript
// ❌ 間違い
const isDescending = seg.endZ < seg.startZ

// ✅ 正しい
const isDiameterIncreasing = seg.endX > seg.startX
```

### 間違い3: テーパー線にBisectorを使用

```typescript
// ❌ 間違い
if (isTaperSegment(seg)) {
    n = this.getNormalAt(seg, 'end')  // 垂直オフセット
}

// ✅ 正しい
if (isTaperSegment(seg)) {
    n = { nx: 0, nz: 0 }  // オフセットなし
}
```

### 間違い4: fzを追加補正として扱う

```typescript
// ❌ 間違い（二重補正）
pz = refZ + nz × R    // 垂直オフセット
oz = pz - fz          // さらにfz適用

// ✅ 正しい
pz = refZ             // オフセットなし
oz = pz - fz          // fzだけを適用
```

## 🔧 デバッグのヒント

### 誤差が大きい場合

```typescript
// 1. angle情報を確認
console.log('seg.angle:', seg.angle)
if (seg.angle === undefined) {
    console.error('❌ angle情報が欠落')
}

// 2. dz計算を確認
console.log('計算されたdz:', dz)
console.log('期待されるfz:', expectedFz)

// 3. ノード計算を確認
console.log('n:', n)
if (isTaperSegment && (n.nx !== 0 || n.nz !== 0)) {
    console.error('❌ テーパー線でオフセットあり')
}
```

### セグメントが歪む場合

```typescript
// 入力と出力の比較
const inputDZ = seg.endZ - seg.startZ
const inputDX = seg.endX - seg.startX
const outputDZ = result.endZ - result.startZ
const outputDX = result.endX - result.startX

console.log('入力: ΔZ=%f, ΔX=%f', inputDZ, inputDX)
console.log('出力: ΔZ=%f, ΔX=%f', outputDZ, outputDX)

if (Math.abs(outputDZ - inputDZ) > 0.01) {
    console.error('❌ Z方向に歪みあり')
}
```

## 📚 参考資料

- 詳細分析: `docs/nose_r_compensation_fix_analysis.md`
- 図解: `docs/nose_r_compensation_fix_diagram.md`
- コード: `src/calculators/noseRCompensation.ts`

---

**最終更新**: 2026-02-12
**メンテナー**: 開発チーム
