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

- 5本の実WAVステムを同一AudioContext時刻で完全同期スタート
- `drums.wav / bass.wav / chords.wav / melody.wav / sparkle.wav`
- 4小節 / 112 BPM / 22.05 kHz / mono WAV
- PERFECT / GOOD / MISS判定
- プレイ精度からEnergyを算出
- Energy 40%でBUILD MIX、75%でOVERDRIVE MIXを予約
- 次の小節頭でステムGainだけを変更
- WAV自体は止めず、全ステムの再生位置を維持
- DRUMS / BASS / CHORDS / MELODY / SPARKLEのライブメーター表示
- BAR / BEAT / NEXT BAR MIXを画面表示

URL: https://kameusagiyahoo.github.io/game_music/games/pulse-forge/

## Music Engine v4 — Real WAV Stem Transport

```text
Game Logic
    ↓ Energy / state
WavStemMusicManager
    ↓
AudioContext shared start time
    ├── drums.wav   ─ Gain Bus
    ├── bass.wav    ─ Gain Bus
    ├── chords.wav  ─ Gain Bus
    ├── melody.wav  ─ Gain Bus
    └── sparkle.wav ─ Gain Bus
            ↓
     Quantized Layer Mixer
            ↓ next bar
        Music Root
```

5本のWAVはすべて同じテンポ・長さ・開始位置で生成し、`AudioBufferSourceNode.start(startAt)` の同一 `startAt` を使って同時再生します。

音量0のステムも停止しません。裏で同じ位置をループし続けるため、BUILDやOVERDRIVEでGainを上げた瞬間も現在の小節位置から自然に参加します。

### v1

- Music Pack分離
- BGMクロスフェード
- BGM / SE ON/OFF・音量

### v2

- 小節境界へのQuantized Transition
- `onSync()` によるBAR / BEAT通知

### v3

- 5系統の独立Layer Bus
- `setLayerMix()` / `setLayerPreset()`
- 次小節からLayer Mixを適用
- Live Stem Mixer UI

### v4

- procedural stemsから実WAV stemsへ移行
- `src/wav-stem-manager.js`
- 5つのAudioBufferを同一時刻でスタート
- WAV再生位置を維持したままGainのみ変更
- AudioContext時間を基準にゲームのBeat Clockも同期
- 初回ロード後はブラウザキャッシュを利用
- GitHub ActionsでWAVを再生成可能

## WAV generation pipeline

```text
tools/generate_pulse_stems.py
        ↓
GitHub Actions
        ↓
assets/stems/pulse/
├── drums.wav
├── bass.wav
├── chords.wav
├── melody.wav
└── sparkle.wav
        ↓
GitHub Pages
        ↓
WavStemMusicManager
```

Workflow: `.github/workflows/generate-pulse-stems.yml`

曲生成条件をコードとして保存しているため、音楽内容を変更しても同じフォーマットの同期WAVを再生成できます。

## Structure

```text
index.html
styles.css
ui-enhancements.css
src/
├── game.js
├── music-manager.js
├── wav-stem-manager.js
└── music-packs/
    ├── fantasy.js
    ├── neon.js
    └── pulse.js
assets/
└── stems/
    └── pulse/
        ├── drums.wav
        ├── bass.wav
        ├── chords.wav
        ├── melody.wav
        └── sparkle.wav
tools/
└── generate_pulse_stems.py
games/
├── orbit-rush/
└── pulse-forge/
```

## Next candidates

- 高音質ステム（44.1 kHz stereo）への差し替え
- WAV / OGG / AACの自動フォーマット選択
- Victory / Game Over専用Stinger
- Music Pack選択画面
- Music Debug / Mixer画面
- Game 04追加
