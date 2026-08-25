# game_music

GitHub Pagesだけでゲーム制作とゲーム音楽基盤を練習するためのプロジェクトです。

## Game 01 — Mystic Match

12枚のカードから同じ紋章の6ペアを見つける、45秒制限のメモリーゲームです。

### 現在の実装

- iPhone向けレスポンシブUI
- 12枚 / 6ペアのカードシャッフル
- 45秒タイマー
- 残り10秒で `tension` 状態へ遷移
- 手数・ペア数・スコア表示
- ベストスコアを `localStorage` に保存
- Web Audio APIによる簡易SE
- サウンドON/OFF

### ゲーム状態

```text
ready
  ↓
playing
  ↓ 残り10秒
tension
  ↓
result
```

この状態遷移を、次の段階で共通 Music Manager に接続します。

## GitHub Pages

https://kameusagiyahoo.github.io/game_music/
