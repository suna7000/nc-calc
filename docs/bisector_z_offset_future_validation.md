# Bisector Z-Offset実装：未検証領域と今後の課題

**作成日**: 2026年2月21日
**関連**: [bisector_method_z_offset_implementation.md](./bisector_method_z_offset_implementation.md)
**背景**: ChatGPT peer reviewにより、現在の実装の適用範囲と限界が明確化された

---

## 概要

条件付きZ方向オフセット実装（`dz = isConvex ? 0 : noseR`）は、**外径加工・Tip3・後刃物台・-Z切削**という限定的な条件下でのみ検証済みです。

本ドキュメントは、**未検証領域**と**今後の課題**を整理し、将来の拡張や検証作業のロードマップを提供します。

---

## 1. 未検証領域（適用範囲外）

現在の実装は以下の条件では**検証されていません**。これらの条件に適用する場合は、独自の検証が必須です。

### 1.1 加工方式

| 条件 | 状態 | リスク |
|------|------|--------|
| 外径加工 | ✅ 検証済み | - |
| **内径加工** | ❌ 未検証 | 法線方向が逆転、凸/凹定義が入れ替わる可能性 |

**内径加工での懸念**:
- 外径の「凸円弧」が内径では「凹」扱いになる可能性
- 工具姿勢が異なり、V_offsetの符号が変わる可能性
- `isConvex` 判定ロジックが破綻する可能性

### 1.2 工具チップ番号

| チップ番号 | 物理定義 | 状態 | リスク |
|-----------|----------|------|--------|
| 3 | 外径/前向き | ✅ 検証済み | - |
| **1** | 内径/奥向き | ❌ 未検証 | V_offset符号が異なる（`dz = isConvex ? 0 : -noseR`） |
| **2** | 内径/前向き | ❌ 未検証 | 内径加工特有の問題 |
| **4** | 外径/奥向き | ❌ 未検証 | V_offset符号が異なる（`dz = isConvex ? 0 : -noseR`） |
| **8** | 端面 | ❌ 未検証 | 特殊なオフセット（`dz = 0` 固定） |

**チップ番号による違い**:
```typescript
// 現在の実装
case 3: dz = isConvex ? 0 : noseR;    // 外径/前
case 4: dz = isConvex ? 0 : -noseR;   // 外径/奥 ← 符号が逆！
case 2: dz = isConvex ? 0 : noseR;    // 内径/前
case 1: dz = isConvex ? 0 : -noseR;   // 内径/奥 ← 符号が逆！
```

符号が逆転するチップ番号では、**条件分岐のロジック自体が異なる可能性**があります。

### 1.3 刃物台・切削方向

| 条件 | 状態 | リスク |
|------|------|--------|
| 後刃物台 | ✅ 検証済み | - |
| **前刃物台** | ❌ 未検証 | G02/G03判定が反転、法線方向が変わる |
| -Z方向切削 | ✅ 検証済み | - |
| **+Z方向切削** | ❌ 未検証 | 進行方向が逆転、法線ベクトルの符号が変わる |

### 1.4 進行方向の逆転

| ケース | 状態 | リスク |
|--------|------|--------|
| 通常方向（例：上→下） | ✅ 検証済み | - |
| **逆方向（例：下→上）** | ❌ 未検証 | 法線ベクトルが反転、`isConvex` 判定が破綻する可能性 |

**同じ形状でも進行方向を逆にすると**:
- 法線ベクトルの向きが反転
- G02/G03の割り当てが変わる
- 条件分岐が機能しない可能性

---

## 2. 理論的課題（本質的理解の欠如）

### 2.1 P座標の定義が不明確

**現状**:
```
P = 本実装のBisector計算が返すノード座標
```

**問題**:
- Pは純粋な「工具中心」なのか？
- 既にオフセット成分を含むのか？
- どの座標系で定義されているのか？

**必要な作業**:
1. Bisectorアルゴリズムの数式化
2. 各ノードでのP計算式を明示
3. Pの幾何学的意味を厳密に定義

### 2.2 一般解（法線ベース）の欠如

**現状の実装**:
```typescript
// 形状タイプで条件分岐
const dz = isConvex ? 0 : noseR
```

**理想的な実装**:
```typescript
// 法線ベクトルから導出される一般式
const normalZ = getNormalZ(segment, position)
const dz = noseR * f(normalZ)  // 何らかの関数f

// 凸円弧でこれが0になる理由を数学的に証明
```

**必要な作業**:
1. 一般解 `O = P - (2*noseR*n_x, noseR*n_z)` の導出
2. 現在の条件分岐が「一般解の最適化」なのかを証明
3. または、全く別の理屈であることを示す

### 2.3 なぜ機能するのかの証明不足

**観察事実**:
- 凸円弧: `dz = 0` で誤差±0.034mm
- 直線: `dz = noseR` で誤差改善

**未解明の疑問**:
1. なぜ凸円弧でdz=0が正しいのか？
2. なぜ直線でdz=Rが必要なのか？
3. Bisectorの内部計算が特殊な処理をしているのか？
4. P座標が既に部分的にオフセット済みなのか？

**必要な作業**:
- コードの詳細な数学的分析
- Bisector計算の各ステップを数式で表現
- P座標が持つ性質の理論的証明

---

## 3. 検証課題（ChatGPT提案）

ChatGPTによる peer review で提案された、最短3つの追加テストケース：

### Test 1: 進行方向逆転

**目的**: 同じ形状を逆方向から加工した場合の検証

```typescript
describe('進行方向逆転ケース', () => {
    it('凸円弧R0.5を上から下へ（通常）', () => {
        const shape = {
            points: [
                createPoint(66, 0, noCorner()),
                createPoint(66, -115, { type: 'kaku-r', size: 0.5 }),
                createPoint(63, -116.5, noCorner())
            ]
        }
        // dz=0 が機能することを確認
    })

    it('凸円弧R0.5を下から上へ（逆転）', () => {
        const shape = {
            points: [
                createPoint(63, -116.5, noCorner()),
                createPoint(66, -115, { type: 'kaku-r', size: 0.5 }),
                createPoint(66, 0, noCorner())
            ]
        }
        // dz=0 が機能するか？
        // リスク: 法線が反転して破綻する可能性
    })
})
```

**期待結果**: 両方向で `dz=0` が機能する
**リスク**: 法線ベクトルが反転し、条件分岐が破綻

### Test 2: 内径加工

**目的**: 内径側の円弧での検証

```typescript
describe('内径加工ケース', () => {
    it('内径側の円弧（外径の凸が内径では凹？）', () => {
        const settings = {
            ...defaultMachineSettings,
            toolLibrary: [{
                type: 'internal',  // 内径工具
                noseRadius: 0.4,
                toolTipNumber: 2,  // 内径/前向き
            }]
        }

        const shape = {
            points: [
                // 内径側の形状
            ]
        }

        // isConvex判定が正しく動作するか？
    })
})
```

**期待結果**: 凸/凹判定が正しく機能する
**リスク**: 外径の定義が内径で崩れる

### Test 3: 他のチップ番号

**目的**: Tip 4, Tip 2 での検証

```typescript
describe('他のチップ番号', () => {
    it('Tip 4（外径/奥向き）での凸円弧', () => {
        const settings = {
            toolLibrary: [{
                toolTipNumber: 4,  // dz符号が逆！
            }]
        }
        // dz = isConvex ? 0 : -noseR が機能するか？
    })

    it('Tip 2（内径/前向き）での凸円弧', () => {
        const settings = {
            toolLibrary: [{
                type: 'internal',
                toolTipNumber: 2,
            }]
        }
        // 内径＋符号の組み合わせが機能するか？
    })
})
```

**期待結果**: 符号が逆転するケースでも条件分岐が機能する
**リスク**: 符号逆転で破綻、または追加の条件分岐が必要

---

## 4. 実装課題（コードの改善余地）

### 4.1 isConvex判定の脆弱性

**現在の実装**:
```typescript
const isConvex = (seg.type === 'arc' && seg.isConvex !== false)
```

**問題点**:
1. セグメント単体の属性（進行方向を考慮していない）
2. 外径/内径で凸凹が入れ替わることを考慮していない
3. 法線方向との関係が不明確
4. `seg.isConvex` がどう設定されているか不透明

**改善案**:
```typescript
// 法線ベクトルと形状から動的に判定
function isConvexAtNode(
    segment: Segment,
    direction: 'forward' | 'backward',
    machineType: 'external' | 'internal'
): boolean {
    const normal = getNormalVector(segment, direction)
    const curvature = getCurvature(segment)

    // 外径: 外向き法線＋正の曲率 = 凸
    // 内径: 内向き法線＋負の曲率 = 凸（外径とは逆）
    if (machineType === 'external') {
        return curvature > 0 && normal.outward
    } else {
        return curvature < 0 && normal.inward
    }
}
```

### 4.2 一般解への移行

**現在の実装**:
```typescript
// 条件分岐
const dz = isConvex ? 0 : noseR
```

**理想的な実装**:
```typescript
// 法線ベースの一般式
const normalVector = getNormalAtNode(segment, nodeIndex)
const dzFactor = calculateDzFactor(normalVector, segment.curvature)
const dz = noseR * dzFactor

// dzFactor が凸円弧で0、直線で1になる理由を数学的に導出
```

**メリット**:
- 形状タイプによらない汎用性
- 法線方向の変化に自動対応
- 理論的根拠が明確

---

## 5. 優先順位付き課題リスト

### 【優先度：高】理論の明確化

#### Task 1: Pの定義を数学的に記述
- **作業**: Bisectorアルゴリズムの数式化
- **成果物**: P計算式の厳密な定義ドキュメント
- **工数**: 2-3時間
- **重要性**: 全ての理論的基盤

#### Task 2: 一般解の導出
- **作業**: 法線ベクトルからの一般式を導出
- **成果物**: `O = P - f(normal, noseR)` の数学的証明
- **工数**: 2-3時間
- **重要性**: 条件分岐の正当性の証明

### 【優先度：中】検証範囲の拡大

#### Task 3: ChatGPT提案の3テスト実施
- **作業**: 進行方向逆転、内径加工、他チップ番号のテスト作成・実行
- **成果物**: テストファイル＋結果レポート
- **工数**: 1-2時間
- **重要性**: 破綻するケースの発見

#### Task 4: 体系的な検証マトリクス
- **作業**: 加工方式 × チップ番号 × 方向 の全組み合わせ検証
- **成果物**: 検証マトリクス表＋テストスイート
- **工数**: 4-6時間
- **重要性**: 一般性の確認

### 【優先度：低】コードのリファクタリング

#### Task 5: isConvex判定の改善
- **作業**: 法線方向を考慮した動的判定に変更
- **成果物**: リファクタリング後のコード
- **工数**: 2-3時間
- **重要性**: 保守性・拡張性の向上

#### Task 6: 一般解への移行
- **作業**: 条件分岐を法線ベースの一般式に置き換え
- **成果物**: リファクタリング後のコード＋性能検証
- **工数**: 3-4時間
- **重要性**: 長期的な保守性

---

## 6. 次のステップ

### オプションA: 理論の明確化（推奨）
**内容**: Task 1, 2 を実施
**工数**: 4-6時間
**成果**: 理論的基盤の確立、条件分岐の正当性証明

**メリット**:
- なぜ機能するのかが明確になる
- 一般化の可能性が見える
- 安心して拡張できる

### オプションB: 検証範囲の拡大
**内容**: Task 3, 4 を実施
**工数**: 5-8時間
**成果**: 破綻するケースの発見、適用範囲の拡大

**メリット**:
- 実用範囲が広がる
- バグの早期発見
- ユーザーへの価値提供

### オプションC: 現状維持
**内容**: 現在の適用範囲（外径・Tip3）で運用
**工数**: 0時間
**成果**: なし

**メリット**:
- リソース節約
- 現在の97テストは全てパス
- 実用上は問題なし

**デメリット**:
- 拡張時のリスク
- 理論的理解の欠如
- 将来の負債

---

## 7. 参考資料

### 関連ドキュメント
- [bisector_method_z_offset_implementation.md](./bisector_method_z_offset_implementation.md) - 現在の実装ノート
- [nose_r_compensation_reference.md](./nose_r_compensation_reference.md) - ノーズR補正の計算式リファレンス

### 関連テストファイル
- `src/calculators/__tests__/integrated_verification.test.ts` - 統合検証（現在）
- `src/calculators/__tests__/angle_verification.test.ts` - 角度検証（現在）
- （未作成）`direction_reversal.test.ts` - 進行方向逆転テスト
- （未作成）`internal_turning.test.ts` - 内径加工テスト
- （未作成）`other_tool_tips.test.ts` - 他チップ番号テスト

### 外部レビュー
- ChatGPT peer review (2026年2月21日)
  - P定義の曖昧性を指摘
  - 形状タイプだけでの条件分岐の危険性を指摘
  - 一般性の検証不足を指摘

---

## 8. 更新履歴

### 2026年2月21日
- 初版作成
- ChatGPT peer review の指摘を基に課題整理
- 未検証領域、理論的課題、検証課題、実装課題を体系化
- 優先順位付き課題リストと次のステップを提案
