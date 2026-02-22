# Phase 2: 試験実装プラン

**作成日**: 2026年2月21日
**目的**: 一般解（bz ベース）を実際のコードに統合し、既存テストとの互換性を確認

---

## 実装方針

### アプローチ: フラグベースの段階的移行

既存の実装を破壊せず、新旧両方を並行実行できるようにする：

```typescript
const USE_BZ_BASED_DZ = false  // デフォルトは false（既存動作）
```

**利点**:
- リスク最小化（いつでも元に戻せる）
- A/Bテストが可能（両方の結果を比較）
- 段階的な検証が可能

---

## 必要な変更

### 1. ノード情報の拡張

**現在**（Line 80）:
```typescript
const nodes: { x: number, z: number, n: { nx: number, nz: number } }[] = []
```

**変更後**:
```typescript
const nodes: {
    x: number,
    z: number,
    n: { nx: number, nz: number },
    bisec?: { bx: number, bz: number, dist: number }  // ← 追加
}[] = []
```

**理由**: pToO 関数で bisec.bz を使用するため、保持する必要がある

---

### 2. bisec 情報の保存

**現在**（Line 88-92）:
```typescript
const n1 = this.getNormalAt(profile[i - 1], 'end')
const n2 = this.getNormalAt(profile[i], 'start')
const bisec = this.calculateBisector(n1, n2)
n = { nx: bisec.bx * (bisec.dist / this.noseR), nz: bisec.bz * (bisec.dist / this.noseR) }
// bisec はここで破棄される
```

**変更後**:
```typescript
const n1 = this.getNormalAt(profile[i - 1], 'end')
const n2 = this.getNormalAt(profile[i], 'start')
const bisec = this.calculateBisector(n1, n2)
n = { nx: bisec.bx * (bisec.dist / this.noseR), nz: bisec.bz * (bisec.dist / this.noseR) }

// ノードに bisec 情報を追加
nodes.push({ x: px, z: pz, n, bisec })  // ← bisec を保存
```

---

### 3. pToO 関数のシグネチャ拡張

**現在**（Line 41）:
```typescript
export function pToO(
    px: number,
    pz: number,
    noseR: number,
    toolType: number,
    isConvex: boolean = true
): { ox: number; oz: number }
```

**変更後**（後方互換性を保持）:
```typescript
export function pToO(
    px: number,
    pz: number,
    noseR: number,
    toolType: number,
    isConvexOrBisec: boolean | { bz: number } = true  // ← 型を拡張
): { ox: number; oz: number }
```

---

### 4. pToO 関数の内部ロジック更新

**現在**（Line 41-56）:
```typescript
export function pToO(px: number, pz: number, noseR: number, toolType: number, isConvex: boolean = true): { ox: number; oz: number } {
    let dx = 0, dz = 0
    switch (toolType) {
        case 3: dx = noseR; dz = isConvex ? 0 : noseR; break;
        case 4: dx = noseR; dz = isConvex ? 0 : -noseR; break;
        case 2: dx = -noseR; dz = isConvex ? 0 : noseR; break;
        case 1: dx = -noseR; dz = isConvex ? 0 : -noseR; break;
        case 8: dx = noseR; dz = 0; break;
        default: dx = noseR; dz = isConvex ? 0 : noseR;
    }
    const ox = px - (dx * 2)
    const oz = pz - dz
    return { ox: round3(ox), oz: round3(oz) }
}
```

**変更後**:
```typescript
// フラグ定数（後で環境変数に移行可能）
const USE_BZ_BASED_DZ = false  // デフォルトは既存動作

export function pToO(
    px: number,
    pz: number,
    noseR: number,
    toolType: number,
    isConvexOrBisec: boolean | { bz: number } = true
): { ox: number; oz: number } {
    let dx = 0, dz = 0

    // dx の計算（変更なし）
    switch (toolType) {
        case 2:
        case 1:
            dx = -noseR
            break
        default:
            dx = noseR
    }

    // dz の計算（新旧切り替え）
    if (USE_BZ_BASED_DZ && typeof isConvexOrBisec === 'object') {
        // 新実装: bz ベースの一般解
        dz = calculateDzFromBisector(isConvexOrBisec, noseR, toolType)
    } else {
        // 既存実装: isConvex ベース
        const isConvex = typeof isConvexOrBisec === 'boolean' ? isConvexOrBisec : true
        switch (toolType) {
            case 3: dz = isConvex ? 0 : noseR; break;
            case 4: dz = isConvex ? 0 : -noseR; break;
            case 2: dz = isConvex ? 0 : noseR; break;
            case 1: dz = isConvex ? 0 : -noseR; break;
            case 8: dz = 0; break;
            default: dz = isConvex ? 0 : noseR;
        }
    }

    const ox = px - (dx * 2)
    const oz = pz - dz
    return { ox: round3(ox), oz: round3(oz) }
}
```

---

### 5. 一般解の実装（新規関数）

**新規追加**（pToO の前に配置）:
```typescript
/**
 * 一般化された dz 計算（bz ベース）
 *
 * Task 1-2-3 の検証結果に基づく最終版
 *
 * @param bisec - bisector計算結果 { bz: number, ... }
 * @param noseR - ノーズ半径
 * @param toolType - 工具チップ番号 (1-4, 8)
 * @returns dz - Z方向オフセット量
 */
function calculateDzFromBisector(
    bisec: { bz: number },
    noseR: number,
    toolType: number
): number {
    // ステップ1: bzの大きさで判定（形状タイプ・加工方式に依存しない）
    const bzThreshold = 0.01
    if (Math.abs(bisec.bz) < bzThreshold) {
        return 0  // 法線が水平 → 追加Z方向オフセット不要
    }

    // ステップ2: チップ番号で符号を決定
    //           [0,  1,  2,  3,  4,  5, 6, 7, 8]
    const dzSign = [0, -1, +1, +1, -1,  0, 0, 0, 0]
    const sign = dzSign[toolType] || +1

    // ステップ3: 符号付きオフセット量を返す
    return noseR * sign
}
```

---

### 6. calculateWithBisector での呼び出し更新

**現在**（Line 117-118）:
```typescript
const startIsConvex = (seg.type === 'arc' && seg.isConvex !== false)
const endIsConvex = (seg.type === 'arc' && seg.isConvex !== false)

const startO = pToO(sNode.x * 2, sNode.z, this.noseR, this.toolType, startIsConvex)
const endO = pToO(eNode.x * 2, eNode.z, this.noseR, this.toolType, endIsConvex)
```

**変更後**:
```typescript
const startIsConvex = (seg.type === 'arc' && seg.isConvex !== false)
const endIsConvex = (seg.type === 'arc' && seg.isConvex !== false)

// 新実装用: bisec がある場合は bisec を、ない場合は isConvex を渡す
const startParam = sNode.bisec || startIsConvex
const endParam = eNode.bisec || endIsConvex

const startO = pToO(sNode.x * 2, sNode.z, this.noseR, this.toolType, startParam)
const endO = pToO(eNode.x * 2, eNode.z, this.noseR, this.toolType, endParam)
```

---

## 実装の順序

### ステップ1: 準備（コミット1）
- [ ] `calculateDzFromBisector` 関数を追加
- [ ] `USE_BZ_BASED_DZ` フラグを false で追加
- [ ] pToO のシグネチャを拡張（後方互換性保持）

### ステップ2: データ保持（コミット2）
- [ ] nodes 型定義に bisec フィールド追加
- [ ] calculateWithBisector で bisec を保存
- [ ] pToO 呼び出し時に bisec を渡す

### ステップ3: 検証（コミット3）
- [ ] 既存テスト97個が全てパス確認（USE_BZ_BASED_DZ = false）
- [ ] フラグを true に変更
- [ ] 既存テスト97個が全てパス確認（USE_BZ_BASED_DZ = true）
- [ ] 新規テスト9個が全てパス確認

### ステップ4: 比較ログ（オプション、コミット4）
- [ ] 両方の実装で dz を計算
- [ ] 差異があればコンソールに出力
- [ ] 数週間の運用で差異を監視

---

## リスク管理

### リスク1: 既存テストが破綻
**対策**: フラグを false のままコミット、段階的に true に変更

### リスク2: bisec がない端点ノード
**対策**: `sNode.bisec || startIsConvex` で fallback

### リスク3: 数値的な微小差異
**対策**: round3() で丸め、許容誤差を設定

---

## 成功基準

### Phase 2 完了の定義

1. ✅ USE_BZ_BASED_DZ = false で既存テスト97個全パス
2. ✅ USE_BZ_BASED_DZ = true で既存テスト97個全パス
3. ✅ USE_BZ_BASED_DZ = true で新規テスト9個全パス
4. ✅ 差異ログで重大な不一致がないことを確認

### Phase 3 への移行基準

1. Phase 2 完了
2. 数週間の運用で問題報告なし
3. 差異ログでの不一致が許容範囲内（±0.001mm）

---

## タイムライン（推定）

- ステップ1-2: 1-2時間（実装）
- ステップ3: 30分（テスト実行）
- ステップ4: オプション（運用監視）

**合計**: 2-3時間で Phase 2 完了予定

---

## 次のアクション

1. ステップ1の実装開始
2. calculateDzFromBisector 関数を追加
3. pToO 関数を拡張

準備ができたら実装を開始します。
