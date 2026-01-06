# NC旋盤座標計算ツール

## 概要

NC旋盤プログラム作成時に必要な座標値を計算するWebアプリケーション。

## 技術スタック

- **フレームワーク**: Vite + React + TypeScript
- **スタイリング**: Vanilla CSS
- **図形描画**: SVG
- **ストレージ**: localStorage

## 開発コマンド

```bash
npm run dev    # 開発サーバー起動
npm run build  # ビルド
npm test       # テスト
```

## ディレクトリ構成

```
src/
├── components/      # UIコンポーネント
├── calculators/     # 計算ロジック（arc, taper, chamfer, groove, noseRadius）
└── features/        # 機能モジュール（history, naturalInput）
```

## 計算式

- **円弧補間**: I = Xc - Xs, K = Zc - Zs
- **テーパー**: tan(θ) = (X2 - X1) / (Z1 - Z2)
- **ノーズR補正**: [詳細リファレンス](docs/nose_r_compensation_reference.md)

## コーディング規約

- TypeScript厳格モード
- 計算関数は純粋関数として実装

## ⚠️ Git運用ルール（必須）

### 基本原則
- **変更するたびに必ずコミットする**
- 大きな変更を一度に行わず、小さな単位で区切る
- コミット前に `npm run build` でエラーがないことを確認

### コミットのタイミング
1. 機能追加・修正が完了したとき
2. バグ修正が完了したとき
3. リファクタリングが完了したとき
4. 設定ファイルを変更したとき

### コミットメッセージ（日本語）
```bash
git add .
git commit -m "溝入れ計算のクイックボタンを追加"
git commit -m "工具編集画面のバグを修正"
git commit -m "ToolIcon.tsxをリファクタリング"
```

### 禁止事項
- 複数の機能変更を1つのコミットにまとめない
- ビルドエラーがある状態でコミットしない
- 動作確認せずに大規模なリファクタリングを行わない

