# NC旋盤 技術リファレンス 統合版

**最終更新**: 2026年2月21日
**バージョン**: 2.0
**ステータス**: アクティブ（このドキュメントが最新の技術基準）

---

## 目次

1. [基本概念](#1-基本概念)
2. [座標系とGコード](#2-座標系とgコード)
3. [工具とチップ番号](#3-工具とチップ番号)
4. [ノーズR補正理論](#4-ノーズr補正理論)
5. [コーナーR計算](#5-コーナーr計算)
6. [二等分線投影法（Bisector Method）](#6-二等分線投影法bisector-method)
7. [実装ガイドライン](#7-実装ガイドライン)
8. [検証フレームワーク](#8-検証フレームワーク)
9. [高度なトピック](#9-高度なトピック)
10. [参考文献](#10-参考文献)

---

## 1. 基本概念

### 1.1 NC旋盤の座標系

#### X軸（直径指定）
```
X座標 = 直径値（Φ値）
例: X100 → 半径50mm（Φ100）
```

**重要**:
- プログラムはX軸を**直径**で指定
- 幾何計算は**半径**で実行
- I/K値は常に**半径**で指定

#### Z軸（絶対位置）
```
Z0  = チャック面（原点）
Z負  = チャック側（通常の切削方向）
Z正  = 主軸端側
```

### 1.2 工具台の位置

| 工具台位置 | 英語 | 切削方向への影響 |
|----------|------|----------------|
| 後刃物台 | Rear | 標準（G02/G03が反転しない） |
| 前刃物台 | Front | G02/G03が反転 |

---

## 2. 座標系とGコード

### 2.1 基本移動コマンド

| Gコード | 機能 | 送り速度 |
|---------|------|---------|
| **G00** | 位置決め（早送り） | 最高速度 |
| **G01** | 直線補間 | F指定 |
| **G02** | 円弧補間（時計回り） | F指定 |
| **G03** | 円弧補間（反時計回り） | F指定 |

### 2.2 円弧補間（G02/G03）の指定方法

#### I/K方式（増分指定）
```gcode
G02 X80 Z-50 I-10 K0 F0.2
```
- **I**: 始点から中心へのX方向距離（半径値）
- **K**: 始点から中心へのZ方向距離

#### R方式（半径指定）
```gcode
G02 X80 Z-50 R10 F0.2
```
- **R**: 円弧の半径（180°以下の円弧用）

**注意**: R方式は180°超の円弧で曖昧性あり。I/K方式を推奨。

### 2.3 G02/G03の判定ルール

**基本原理**:
```typescript
// ベクトル外積による回転方向判定
const crossProduct = u1.x * u2.z - u1.z * u2.x
const isLeftTurn = crossProduct > 0

// G02/G03の決定（XOR論理）
const isG02 = isLeftTurn XOR (toolPost === 'rear') XOR (direction === '+z')
```

**判定表**:

| 左回転 | 工具台 | 切削方向 | Gコード |
|-------|-------|---------|---------|
| true  | rear  | -z      | **G02** |
| true  | front | -z      | **G03** |
| false | rear  | -z      | **G03** |
| false | front | -z      | **G02** |

---

## 3. 工具とチップ番号

### 3.1 ノーズR（刃先R）の構造

```
        刃先R
         ↓
    ____/‾‾\____  ← 切れ刃
   /            \
  |    工具中心   |
   \____________/
```

- **ノーズR**: 刃先の丸み半径（通常0.2〜1.6mm）
- **工具中心**: 制御システムが追従する基準点
- **仮想刃先点**: プログラム座標の基準点

### 3.2 チップ番号（仮想刃先点番号）

ISO/FANUC規格による9種類の仮想刃先位置定義。

```
     8 │ 7 │ 6
    ───┼───┼───
     1 │ 9 │ 5
    ───┼───┼───
     2 │ 3 │ 4
```

#### 主要チップ番号

| 番号 | 用途 | Xオフセット | Zオフセット（※） |
|:---:|:-----|:-----------:|:----------------:|
| **3** | 外径/前向き | `+R` | `+R` (凹/直線)<br>`0` (凸) |
| **2** | 内径/前向き | `-R` | `-R` (凹/直線)<br>`0` (凸) |
| **1** | 内径/奥向き | `-R` | `+R` (凹/直線)<br>`0` (凸) |
| **4** | 外径/奥向き | `+R` | `-R` (凹/直線)<br>`0` (凸) |
| **8** | 端面（X逃げ） | `+R` | `0` |

**※重要**: Zオフセットは二等分線法使用時、コーナータイプ（凸/凹）により異なる。詳細は[6.3節](#63-🔴-重要凸凹コーナーでのz方向オフセット適用の違い)参照。

### 3.3 P-to-O変換（工具中心→プログラム点）

**基本式**:
```
O = P - V_offset
```

**実装**（TypeScript）:
```typescript
function pToO(
  px: number,      // 工具中心X（直径値）
  pz: number,      // 工具中心Z
  noseR: number,   // ノーズR
  toolType: number,// チップ番号
  isConvex: boolean = true  // コーナータイプ
): { ox: number; oz: number } {
  let dx = 0, dz = 0

  switch (toolType) {
    case 3:
      dx = noseR
      dz = isConvex ? 0 : noseR  // ← 重要！
      break
    case 4:
      dx = noseR
      dz = isConvex ? 0 : -noseR
      break
    case 2:
      dx = -noseR
      dz = isConvex ? 0 : noseR
      break
    case 1:
      dx = -noseR
      dz = isConvex ? 0 : -noseR
      break
    case 8:
      dx = noseR
      dz = 0
      break
    default:
      dx = noseR
      dz = isConvex ? 0 : noseR
  }

  return {
    ox: px - dx * 2,  // 直径値換算
    oz: pz - dz
  }
}
```

---

## 4. ノーズR補正理論

### 4.1 補正の必要性

工具刃先は点ではなく円弧（ノーズR）を持つため、プログラム座標と実際の切削点にずれが生じる。

```
理想（点工具）:    実際（R工具）:
    |                 /‾‾\ ← ノーズR
    |                /    \
    |   ワーク       |ワーク\
    |               |      \
    └────           └───────\
                         ↑ 補正が必要
```

### 4.2 G41/G42補正コマンド

| コード | 意味 | 使用例 |
|--------|------|--------|
| **G41** | 左側補正 | 内径加工 |
| **G42** | 右側補正 | 外径加工 |
| **G40** | 補正キャンセル | 加工終了時 |

**プログラム例**:
```gcode
G00 X100 Z5          ; 接近
G42                  ; 右側補正ON
G01 X80 Z-50 F0.2    ; 切削
G40                  ; 補正OFF
G00 X120 Z10         ; 退避
```

### 4.3 補正方式の比較

| 方式 | 特徴 | 実装状況 |
|------|------|----------|
| **Bisector（二等分線）法** | 法線の平均方向にオフセット | ✅ 実装済 |
| **Smid法** | Peter Smidの幾何モデル | ⚠️ UI表示のみ |

**本アプリケーションの実装**: **Bisector法**を採用

---

## 5. コーナーR計算

### 5.1 凸コーナー（角R）vs 凹コーナー（隅R）

```
角R（凸）:          隅R（凹）:
  ______              ______
 /                           \
|                             |
└─────            ────┘
  ↑ 外側に丸み        ↑ 内側に丸み
```

| 種類 | 英語 | 幾何特性 | 補正半径 |
|------|------|---------|---------|
| **角R** | Corner R (Convex) | 外側に凸 | `R_work + R_nose` |
| **隅R** | Inside R (Concave) | 内側に凹 | `R_work - R_nose` |

### 5.2 コーナーR計算の基本式

#### 接線距離（Tangent Distance）

2つのセグメントが角度θで交差する場合:

```typescript
const tDist = R / Math.tan(θ / 2)
```

**例**: 45°コーナー、R=0.5mm
```
θ/2 = 22.5°
tDist = 0.5 / tan(22.5°) = 0.5 / 0.4142 = 1.207mm
```

#### 接点座標の計算

```typescript
// ベクトルu1方向の接点
const entryX = cornerX + u1.x * tDist
const entryZ = cornerZ + u1.z * tDist

// ベクトルu2方向の接点
const exitX = cornerX + u2.x * tDist
const exitZ = cornerZ + u2.z * tDist
```

### 5.3 円弧中心の計算

#### 二等分線による中心距離

```typescript
const angle = Math.acos(u1.x * u2.x + u1.z * u2.z)
const half = angle / 2
const cDist = R / Math.sin(half)
```

#### 二等分線方向ベクトル

```typescript
const bx = u1.x + u2.x
const bz = u1.z + u2.z
const bLen = Math.sqrt(bx * bx + bz * bz)

// 正規化
const bisectorX = bx / bLen
const bisectorZ = bz / bLen
```

#### 中心座標

```typescript
const centerX = cornerX + bisectorX * cDist
const centerZ = cornerZ + bisectorZ * cDist
```

### 5.4 凹コーナー（隅R）の特殊処理

凹コーナーでは法線方向が逆になる:

```typescript
// 外径加工の場合
if (isConcave) {
  // 法線を反転
  normalX = -normalX
  normalZ = -normalZ
}
```

**補正半径**:
```typescript
const compensatedR = isConvex
  ? (workR + noseR)      // 凸: 加算
  : Math.abs(workR - noseR)  // 凹: 減算
```

---

## 6. 二等分線投影法（Bisector Method）

### 6.1 基本原理

2つのセグメント接続点において、それぞれの法線ベクトルの二等分線方向に工具中心をオフセットする。

```
    n1 (法線1)
     ↑
     |    bisector (二等分線)
     |   ↗
     | ↗
     |/___→ n2 (法線2)
    交点
```

### 6.2 二等分線距離の計算式

```typescript
function calculateBisector(
  n1: { nx: number, nz: number },
  n2: { nx: number, nz: number },
  noseR: number
): { dist: number, bx: number, bz: number } {

  // 内積（cos θ）
  const dot = Math.max(-1.0, Math.min(1.0,
    n1.nx * n2.nx + n1.nz * n2.nz
  ))

  // cos(θ/2) の計算
  const cosHalf = Math.sqrt((1.0 + dot) / 2.0)

  // 幾何学的交点距離: R / cos(θ/2)
  // ※ただしS字/U字ターン（法線が90°超で反転）では発散防止
  const dist = (dot >= 0)
    ? noseR / Math.max(0.01, cosHalf)  // 凸コーナー
    : noseR                            // S字/凹コーナー

  // 二等分線方向ベクトル
  let bx = n1.nx + n2.nx
  let bz = n1.nz + n2.nz
  const len = Math.sqrt(bx * bx + bz * bz)

  if (len < 1e-4) {
    return { dist: noseR, bx: n1.nx, bz: n1.nz }
  }

  return {
    dist,
    bx: bx / len,
    bz: bz / len
  }
}
```

**数学的根拠**:

- **Peter Smid理論**: 2本のオフセット線の交点は、コーナー点から `R / cos(θ/2)` の距離
- **ISO補正理論**: 工具中心軌跡は二等分線上に配置される

### 6.3 🔴 重要：凸/凹コーナーでのZ方向オフセット適用の違い

**2026年2月12日 重大発見・修正**

#### 問題

二等分線法で計算した工具中心座標(P)からプログラム座標(O)への変換時、一律にZ方向オフセット(`dz = noseR`)を適用すると、**凸コーナー(角R)で系統的な誤差が発生**する。

#### 原因

二等分線法は凸コーナーの幾何学的オフセットを**既に正しく計算済み**であり、追加のZ方向オフセットは不要。一方、凹コーナー(隅R)や直線では追加オフセットが必要。

#### 正しい実装ルール

```typescript
// コーナータイプの判定
const isConvex = (seg.type === 'arc' && seg.isConvex !== false)
// true  → 凸円弧(角R)のみ
// false → 凹円弧(隅R)、直線

// pToO関数での適用
const dz = isConvex ? 0 : noseR
```

#### 検証結果

**テストケース**: 角R0.5、noseR=0.4mm

| 項目 | 修正前 | 修正後 | 改善率 |
|------|--------|--------|--------|
| Z方向誤差 | **-0.366mm** (≈ -noseR) | **+0.034mm** | **91%** |
| 隅R1誤差 | +0.035mm | +0.035mm | 維持 |
| 隅R2誤差 | <0.001mm | <0.001mm | 維持 |

#### 理論的根拠

1. 二等分線法は、法線ベクトルの平均方向に `dist = R / cos(θ/2)` でオフセット
2. この計算により、**凸コーナーでは工具中心が既に正しい位置に配置される**
3. pToO関数での追加Z方向オフセットは**二重補正**となる
4. 凹コーナーでは、工具が溝に入り込むため追加オフセットが必要
5. 直線セグメントも同様に追加オフセットが必要

#### 実装コード

```typescript
for (let i = 0; i < profile.length; i++) {
  const seg = profile[i]
  const sNode = nodes[i]
  const eNode = nodes[i + 1]

  // コーナータイプ判定
  const startIsConvex = (seg.type === 'arc' && seg.isConvex !== false)
  const endIsConvex = (seg.type === 'arc' && seg.isConvex !== false)

  // P→O変換
  const startO = pToO(
    sNode.x * 2, sNode.z,
    noseR, toolType,
    startIsConvex  // ← これが重要！
  )
  const endO = pToO(
    eNode.x * 2, eNode.z,
    noseR, toolType,
    endIsConvex
  )
}
```

---

## 7. 実装ガイドライン

### 7.1 🔴 分離原則（Separation Principle）

**最重要**: ワーク形状の幾何計算とノーズR補正は**完全に分離**する。

#### ❌ 間違った実装

```typescript
// 間違い: 第1段階でノーズRを加算
const compensatedR = cornerR + noseR  // ← 二重補正の原因！
const tDist = compensatedR / Math.tan(half)
```

この方法では:
1. 接点計算でノーズR分を加算
2. 補正計算でさらにノーズR分を加算
3. 結果として**2倍近くの補正**がかかる

#### ✅ 正しい実装

**第1段階: ワーク形状の幾何展開**
```typescript
// calculateCorner などの形状展開関数
// 引数: 図面上のR値、ノーズRは考慮しない

const cornerR = 0.5  // 図面値そのまま
const tDist = cornerR / Math.tan(half)

// 接点座標
const entryZ = cornerZ + u1z * tDist
const exitZ = cornerZ + u2z * tDist
```

**第2段階: ノーズR補正の適用**
```typescript
// CenterTrackCalculator
// 引数: ワーク形状座標、ノーズR、チップ番号

// 法線方向にノーズR分オフセット
const compensatedZ = workZ + normalZ * noseR

// チップ番号に応じたオフセット変換
const programZ = centerZ - tipOffsetZ
```

### 7.2 座標系の注意点

#### X座標: 直径 vs 半径

```typescript
// プログラム座標（入力）
const xDiameter = 100  // Φ100

// 幾何計算（処理）
const xRadius = xDiameter / 2  // 半径50mm

// 出力（NC出力）
const outputX = xRadius * 2  // 再度直径に
```

**ルール**:
- 入力: 直径
- 計算: 半径
- 出力: 直径
- **I/K値**: 常に半径

#### Z座標の符号

```typescript
// チャック面を原点とした絶対座標
const z0 = 0        // チャック面
const z_cut = -50   // チャック側（切削位置）
const z_tail = 100  // 主軸端側
```

### 7.3 数値精度

```typescript
function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}
```

**精度基準**: ±0.001mm（1μm）

### 7.4 角度の単位

JavaScriptの`Math`関数はラジアンを使用:

```typescript
const degToRad = (deg: number) => deg * Math.PI / 180
const radToDeg = (rad: number) => rad * 180 / Math.PI
```

---

## 8. 検証フレームワーク

### 8.1 幾何学的定義（G-Series）

独立した数学的真理として定義:

- **G-01**: 垂直線の法線 = (1, 0)
- **G-02**: 水平線の法線 = (0, 1) または (0, -1)
- **G-03**: θ°テーパーの法線 = (-sin(θ), cos(θ))
- **G-06**: 凸円弧の法線 = 中心から放射状
- **G-09**: 45°テーパー接続点のシフト量 = 0.469mm（R=0.8時の理論値）

### 8.2 補正定義（C-Series）

数学的モデルによる期待値:

- **C-01**: 垂直線の補正 = `fz = R × (1 - tan(0°)) = R`
- **C-02**: テーパーの補正 = `fz = R × (1 - tan(θ/2))`
- **C-03**: 凸円弧の補正半径 = `R_work + R_nose`
- **C-04**: 凹円弧の補正半径 = `R_work - R_nose`

### 8.3 エッジケース定義（E-Series）

限界動作の数学的期待:

- **E-01**: θ → 0° の極限（平行）→ tDist → ∞
- **E-02**: θ → 180° の極限（反転）→ 発散防止ガード
- **E-03**: R → ギャップ の場合 → 自動縮小 or 展開モード
- **E-04**: 連続R-R接続 → S字自動計算

### 8.4 数学的定数

```typescript
const MATH_CONSTANTS = {
  tan_15deg: 0.26795,   // tan(15°)
  tan_22_5deg: 0.4142,  // tan(22.5°)
  tan_30deg: 0.57735,   // tan(30°)
  sqrt2: 1.41421,       // √2
  sqrt3: 1.73205        // √3
}
```

### 8.5 テスト戦略

```typescript
// 浮動小数点誤差許容
expect(result).toBeCloseTo(expected, 3)  // 小数点3桁精度

// 座標配列の検証
expect(result.segments[i].endX).toBeCloseTo(66.000, 3)
expect(result.segments[i].endZ).toBeCloseTo(-114.827, 3)
```

---

## 9. 高度なトピック

### 9.1 Factory Manager Logic（展開モード）

**問題**: R > ギャップ の場合、通常は自動縮小されるが、ユーザー意図を尊重して展開したい。

**解決策**: Step R 交点クリッピング

```typescript
if (isExpanded) {
  // Exit点を次の壁との交点にクリップ
  const gap = l2
  const offset = finalSize - gap
  const shift = Math.sqrt(
    Math.max(0, finalSize * finalSize - offset * offset)
  )

  // 交点計算
  xX -= u2x * (finalSize - gap)
  xZ -= u2z * (finalSize - gap)
  xX += u1x * (finalSize - shift)
  xZ += u1z * (finalSize - shift)
}
```

**適用条件**:
- 隅R（凹）
- 90度段差
- R > ギャップ長
- 隣接ポイントにコーナーなし

### 9.2 隣接R-R接続（S字カーブ）

**条件**:
- 2つの連続R
- 平行な壁（`|u1 × u3| < 0.01`）
- S字方向（左→右 または 右→左）
- 極小ギャップ（`l2 < 0.1`）

**自動計算**:
```typescript
if (isParallel && isScurve && l2 < 0.1) {
  // Mazatrol方式S字接続
  const targetDist = R1 + R2  // S字の場合
  const dz_total = Math.sqrt(
    targetDist * targetDist - h * h
  )

  // Z配分（半径比）
  const dz1 = dz_total * (R1 / targetDist)
  const dz2 = dz_total * (R2 / targetDist)
}
```

### 9.3 Peter Smidの幾何モデル

**参考**: Peter Smid "CNC Programming Handbook"

- Virtual Wall（仮想壁）の概念
- Lead-in/Lead-out 軌跡の最適化
- 工具干渉チェック
- 表面粗さ理論

**現在の実装状況**: UI表示のみ（計算エンジン未実装）

---

## 10. 参考文献

### 10.1 外部リソース

| ソース | URL | 内容 |
|--------|-----|------|
| 工場長のネタ帳 | koujoucho-neta.com | 実務的計算例（図解付き） |
| 中村留精密工業 | nakamura-tome.co.jp/terakoya/noseR/ | 仮想刃先点の解説 |
| NCプログラム基礎知識 | s-projects.net | Gコード教科書PDF |

### 10.2 内部ドキュメント

- `CLAUDE.md`: 開発ガイドライン
- `README.md`: プロジェクト概要
- `docs/archive/`: 歴史的記録（引継ぎ文書など）

### 10.3 重要コミット履歴

```
4fa9c13 (2026-02-21) docs: 凸/凹コーナーZ方向オフセット問題を文書化
2bfce79 (2026-02-21) fix: 凸コーナーZ方向オフセット修正（91%改善）
6d38646 (2026-02-12) fix: R/cos(θ/2)に修正、スパイク対策追加
```

---

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026-02-21 | 2.0 | 統合版作成。凸/凹コーナーZ方向オフセット問題を追加 |
| 2026-01-24 | 1.5 | P-modelによる1μm精度達成 |
| 2026-01-12 | 1.0 | 初版（複数ファイルに分散） |

---

**メンテナンス責任者**: Claude Code
**問い合わせ**: GitHub Issues
**ライセンス**: プロジェクトルートのLICENSE参照
