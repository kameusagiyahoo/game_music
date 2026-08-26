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
- Victory / Game Over専用WAV Stinger
- Stinger中はBGMをduckし、終了後に元の音量へ復帰

URL: https://kameusagiyahoo.github.io/game_music/games/pulse-forge/

## Music Debug / Mixer

ゲームロジックを介さずMusic Engineだけを直接操作する検証画面。

- WAV transport Start / Stop
- BAR / BEAT / elapsed time表示
- FOCUS / BUILD / OVERDRIVE / RESULTプリセット
- プリセットを次小節頭へQuantize
- Drums / Bass / Chords / Melody / Sparkleを個別0〜100%調整
- 各stemのSOLO
- Victory / Game Over Stinger単独テスト
- Stinger cache / WAV buffer状態表示

URL: https://kameusagiyahoo.github.io/game_music/debug/mixer/

## Music Engine v5

```text
                     ┌─ drums.wav   ─ Gain
                     ├─ bass.wav    ─ Gain
Game State ────────> ├─ chords.wav  ─ Gain ─┐
                     ├─ melody.wav  ─ Gain  │
                     └─ sparkle.wav ─ Gain  │
                                             ├─ Music Root ─┐
Victory / Game Over ─> Stinger Bus ──────────┘              │
                                                            ├─ Compressor ─ Output
SE ─────────────────> SFX Bus ──────────────────────────────┘
```

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
- GitHub ActionsでWAVを再生成

### v5

- `playStinger(name)`
- `victory.wav / gameover.wav`
- BGMを止めずにStingerをオーバーレイ
- Stinger中のBGM ducking / release
- Stinger用AudioBuffer cache
- `getDebugState()`
- Music Debug / Mixer画面
- 手動5stem Mixer / SOLO / preset検証

## Audio generation pipeline

```text
tools/generate_pulse_stems.py
        ↓
GitHub Actions
        ↓
assets/
├── stems/pulse/
│   ├── drums.wav
│   ├── bass.wav
│   ├── chords.wav
│   ├── melody.wav
│   └── sparkle.wav
└── stingers/pulse/
    ├── victory.wav
    └── gameover.wav
        ↓
GitHub Pages
        ↓
WavStemMusicManager
```

Workflow: `.github/workflows/generate-pulse-stems.yml`

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
├── stems/pulse/
└── stingers/pulse/
debug/
└── mixer/
    ├── index.html
    ├── mixer.js
    └── styles.css
tools/
└── generate_pulse_stems.py
games/
├── orbit-rush/
└── pulse-forge/
```

## Next candidates

- 44.1 kHz stereo stemsへの差し替え
- OGG / AACの自動フォーマット選択
- Music Pack選択画面
- Stingerを小節頭 / beat頭へQuantize
- Transition専用Whoosh / Fill
- Game 04追加
