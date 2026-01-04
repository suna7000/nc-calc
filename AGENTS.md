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

## コーディング規約

- TypeScript厳格モード
- 計算関数は純粋関数として実装
