# game_music

GitHub Pagesだけでゲーム制作とゲーム音楽基盤を練習するプロジェクトです。

## Games

### Game 01 — Mystic Match

12枚のカードから同じ紋章の6ペアを見つける45秒のメモリーゲーム。

- Normal BGM
- 残り10秒で Tension BGMへクロスフェード
- Result BGM
- BGM / SE 個別ON/OFF
- BGM / SE 個別音量
- ベストスコアを localStorage に保存

URL: https://kameusagiyahoo.github.io/game_music/

### Game 02 — Orbit Rush

9マスの中から光ったターゲットを追い続ける30秒の反射神経ゲーム。

- Mystic Matchと同じ `MusicManager` を再利用
- Neon Orbit Music Packを使用
- 残り8秒で Overdriveへクロスフェード
- コンボ・スコア・ベストスコア
- BGM / SE 個別設定

URL: https://kameusagiyahoo.github.io/game_music/games/orbit-rush/

## Music Engine v1

```text
Game Logic
    ↓
MusicManager
    ↓
Music Pack
├── fantasy.js
└── neon.js
```

`src/music-manager.js` はゲーム固有のメロディやBPMを持ちません。曲データは `src/music-packs/` に分離しています。

### 主な機能

- `play(mode)`
- `transitionTo(mode, seconds)`
- Music Pack差し替え
- BGMクロスフェード
- BGM ON/OFF
- SE ON/OFF
- BGM音量
- SE音量
- 共通SE
- iPhone Safari向けWeb Audio再生

## Structure

```text
index.html
styles.css
ui-enhancements.css
src/
├── game.js
├── music-manager.js
└── music-packs/
    ├── fantasy.js
    └── neon.js
games/
└── orbit-rush/
    ├── index.html
    ├── game.js
    └── styles.css
```

## Next candidates

- Victory / Game Over専用Music State
- 小節境界に同期したトランジション
- MIDI / WAV / MP3 Music Pack対応
- stemsを使ったAdaptive Music
- Game 03追加
