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
- 5本の同期ステムを常時同じ位置で進行
- Energy 40%でBUILD MIX、75%でOVERDRIVE MIXを予約
- 次の小節頭でステムGainだけを変更
- BPMと小節位置を維持したまま音の厚みが変化
- DRUMS / BASS / CHORDS / MELODY / SPARKLEのライブメーター表示
- BAR / BEAT / NEXT BAR MIXを画面表示

URL: https://kameusagiyahoo.github.io/game_music/games/pulse-forge/

## Music Engine v3

```text
Game Logic
    ↓ performance / state
MusicManager
    ↓
Shared Music Clock
    ├── DRUMS stem
    ├── BASS stem
    ├── CHORDS stem
    ├── MELODY stem
    └── SPARKLE stem
            ↓
      Quantized Layer Mixer
            ↓ next bar
        Music Root
```

`src/music-manager.js` はゲーム固有の曲を持ちません。曲データとステム配合は `src/music-packs/` に分離しています。

現段階のstemsはWAVファイルではなくWeb Audioでリアルタイム生成する「procedural stems」です。全レイヤーが同じ16ステップクロックを共有するため、音量0のレイヤーも演奏位置は失いません。

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
- 次の小節境界までMode Transitionを予約
- `onSync()` でBAR / BEAT / subdivisionをゲーム側へ通知

### v3追加機能

- DRUMS / BASS / CHORDS / MELODY / SPARKLEの独立Gain Bus
- `setLayerMix()`
- `setLayerPreset()`
- `setLayerPreset(name, { quantize: "bar", fadeBeats: 1 })`
- Layer Mixの予約 / キャンセル
- `onLayerChange()` で現在Mixと次のMixをUIへ通知
- Music Pack側に `layerPresets` を定義
- 同じ小節位置を維持したままレイヤーを追加・削除
- procedural kick / hi-hat stem

Pulse Forgeのプリセット例:

```text
FOCUS
Drums    22%
Bass     42%
Chords   68%
Melody   48%
Sparkle   0%

BUILD
Drums    56%
Bass     74%
Chords   82%
Melody   78%
Sparkle  28%

OVERDRIVE
Drums   100%
Bass    100%
Chords   92%
Melody  100%
Sparkle  78%
```

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

- procedural stemsを実WAV stemsへ差し替え
- AudioBufferによる複数WAVの完全同期再生
- Victory / Game Over専用Stinger
- Music Pack選択画面
- Music Debug / Mixer画面
- Game 04追加
