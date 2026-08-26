# game_music

GitHub Pagesだけでゲーム制作とゲーム音楽基盤を練習するプロジェクトです。

## Games

### Game 01 — Mystic Match

12枚のカードから同じ紋章の6ペアを見つける45秒のメモリーゲーム。

- Fantasy Music Pack
- Normal / Tension / Result
- 残り10秒でTensionへクロスフェード
- BGM / SE 個別ON/OFF・音量調整
- ベストスコアをlocalStorageへ保存

URL: https://kameusagiyahoo.github.io/game_music/

### Game 02 — Orbit Rush

9マスの中から光ったターゲットを追い続ける30秒の反射神経ゲーム。

- Game 01と同じ `MusicManager` を再利用
- Neon Music Pack
- Normal / Overdrive / Result
- コンボ・スコア・ベストスコア

URL: https://kameusagiyahoo.github.io/game_music/games/orbit-rush/

### Game 03 — Pulse Forge

音楽の拍に同期して4方向の炉心を叩く40秒のリズム / 反射ゲーム。

- Pulse Music Pack
- Web Audioの音楽クロックをゲーム側でも利用
- PERFECT / GOOD / MISS判定
- プレイ精度からEnergyを算出
- Energy 40%でBUILD、75%でOVERDRIVE
- 状態変化は即時ではなく「次の小節頭」に予約
- 小節頭でMusic LayerとBPMをクロスフェード
- BAR / BEAT / NEXT BARを画面表示

URL: https://kameusagiyahoo.github.io/game_music/games/pulse-forge/

## Music Engine v2

```text
Game Logic
    ↓ state / performance
MusicManager
    ↓
Quantized Transition
    ↓ next bar
Music Pack / Layers
```

`src/music-manager.js` はゲーム固有の曲を持ちません。曲データは `src/music-packs/` に分離されています。

### v1機能

- `play(mode)`
- `transitionTo(mode, seconds)`
- Music Pack差し替え
- クロスフェード
- BGM / SE 個別ON/OFF
- BGM / SE 個別音量
- 共通SE
- iPhone Safari向けWeb Audio再生

### v2追加機能

- `transitionTo(mode, { quantize: "bar", crossfadeBeats: 2 })`
- 次の小節境界まで遷移を予約
- 予約中のTransitionを差し替え / キャンセル
- `onSync()` でBAR / BEAT / subdivisionをゲーム側へ通知
- Music PackごとのLayer ON/OFF
- ゲーム成績から音楽Intensityを動的変更

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
    ├── neon.js
    └── pulse.js
games/
├── orbit-rush/
│   ├── index.html
│   ├── game.js
│   └── styles.css
└── pulse-forge/
    ├── index.html
    ├── game.js
    └── styles.css
```

## Next candidates

- WAV / MP3 Music Pack対応
- stemsを使った本格Layer Mixer
- 曲の小節位置を維持したままstemsを追加・削除
- Victory / Game Over専用Stinger
- Music Pack選択画面
- Game 04追加
