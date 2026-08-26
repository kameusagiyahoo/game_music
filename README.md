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
- Normal / Tension / Result
- コンボ・スコア・ベストスコア

URL: https://kameusagiyahoo.github.io/game_music/games/orbit-rush/

### Game 03 — Pulse Forge

音楽の拍に同期して4方向の炉心を叩く40秒のリズム / 反射ゲーム。

- 5本の実WAVステムを同一AudioContext時刻で完全同期スタート
- `drums.wav / bass.wav / chords.wav / melody.wav / sparkle.wav`
- 4小節 / 112 BPM / 22.05 kHz / mono WAV
- PERFECT / GOOD / MISS判定
- Energyに応じて次小節からStem Mixを変更
- WAV自体は止めず、全ステムの再生位置を維持
- Victory / Game Over専用WAV Stinger
- Stinger中はBGMをduckし、終了後に元の音量へ復帰

URL: https://kameusagiyahoo.github.io/game_music/games/pulse-forge/

### Game 04 — Rune Relay

4つのルーンの点灯順を覚え、同じ順番で入力する45秒のシーケンス記憶ゲーム。

- Fantasy / Neon / Clockworkの3 Music Packを選択可能
- プレイ中にもPack変更可能
- Pack変更は即時ではなく次の小節頭へ予約
- 新PackへクロスフェードしながらBAR位置を維持
- PackごとにNormal / Tension / Resultを共通インターフェース化
- 選択したPackをlocalStorageへ保存
- 残り10秒で現在または予約中PackのTensionへ移行

URL: https://kameusagiyahoo.github.io/game_music/games/rune-relay/

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

## Music Engine v6

現在は2系統の再生エンジンを同じプロジェクトで検証しています。

```text
Procedural Music
Game 01 / 02 / 04
        ↓
MusicManager
        ↓
Music Pack
├── Fantasy Table
├── Neon Orbit
└── Clockwork Grove
        ↓
Normal / Tension / Result
        ↓
Quantized Pack Switch

Real WAV Adaptive Music
Game 03
        ↓
WavStemMusicManager
        ↓
5 synchronized WAV stems
        +
Victory / Game Over Stinger
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
- `getDebugState()`
- Music Debug / Mixer画面

### v6

- `switchPack(pack, options)`
- `cancelPendingPackSwitch()`
- `getPackInfo()`
- `onPackChange()`
- `switchPack(pack, { quantize: "bar", crossfadeBeats: 2, mode: "normal" })`
- Pack変更を次小節頭へ予約
- 現在Pack / 予約PackをUIへ通知
- Pack切替後もゲーム側APIは `normal / tension / result` のまま維持
- Music Pack選択をゲーム設定としてlocalStorageへ保存

Game側は具体的な曲名を知らず、状態名だけをMusic Engineへ渡す方針です。

```text
Game State
  normal
  tension
  result
     ↓
MusicManager
     ↓
Selected Music Pack
```

この構造により、ゲームロジックを変更せず世界観だけを差し替えられます。

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
    ├── clockwork.js
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
├── pulse-forge/
└── rune-relay/
    ├── index.html
    ├── game.js
    └── styles.css
```

## Next candidates

- Music Pack Registryを共通モジュール化
- 全ゲーム共通の設定画面
- PackごとのWAV / procedural自動選択
- Stingerを小節頭 / beat頭へQuantize
- Transition専用Whoosh / Fill
- 44.1 kHz stereo stemsへの差し替え
- Game 05追加
