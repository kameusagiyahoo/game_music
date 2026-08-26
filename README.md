# game_music

GitHub Pagesだけでゲーム制作とゲーム音楽基盤を練習するプロジェクトです。

## Games

### Game 01 — Mystic Match

12枚のカードから同じ紋章の6ペアを見つける45秒のメモリーゲーム。

- Normal / Tension / Result
- 残り10秒でTensionへクロスフェード
- Music Registryからprocedural Packを解決
- 共通BGM / SE設定を利用

URL: https://kameusagiyahoo.github.io/game_music/

### Game 02 — Orbit Rush

9マスの中から光ったターゲットを追い続ける30秒の反射神経ゲーム。

- Game 01と同じ `MusicManager` を再利用
- Normal / Tension / Result
- Music Registryからprocedural Packを解決
- 共通BGM / SE設定を利用

URL: https://kameusagiyahoo.github.io/game_music/games/orbit-rush/

### Game 03 — Pulse Forge

音楽の拍に同期して4方向の炉心を叩く40秒のリズム / 反射ゲーム。

- 5本の実WAVステムを同一AudioContext時刻で同期スタート
- Energyに応じて次小節からStem Mixを変更
- Victory / Game Over専用WAV Stinger
- Stinger中はBGMをduckし、終了後に元の音量へ復帰
- Registry上では `wav-stem` engineとして管理
- 共通BGM / SE設定を利用

URL: https://kameusagiyahoo.github.io/game_music/games/pulse-forge/

### Game 04 — Rune Relay

4つのルーンの点灯順を覚え、同じ順番で入力する45秒のシーケンス記憶ゲーム。

- Music PackボタンをRegistryから自動生成
- Fantasy / Neon / Clockworkを選択可能
- プレイ中のPack変更は次の小節頭へ予約
- Pack変更を共通Settingsへ保存
- 残り10秒で現在または予約中PackのTensionへ移行

URL: https://kameusagiyahoo.github.io/game_music/games/rune-relay/

## Global Music Settings

全ゲーム共通の音楽設定画面。

- BGM ON / OFF
- SE ON / OFF
- BGM音量
- SE音量
- procedural engineの共通Music Pack
- `ゲーム推奨 / Fantasy / Neon / Clockwork`
- WAV Stem engineの登録Pack表示
- Registry件数 / engine別件数表示
- 設定初期化

URL: https://kameusagiyahoo.github.io/game_music/settings/music/

設定は `game-music-global-settings-v1` としてlocalStorageへ保存します。

`ゲーム推奨` の場合は以下を使用します。

```text
Game 01 Mystic Match -> Fantasy Table
Game 02 Orbit Rush   -> Neon Orbit
Game 03 Pulse Forge  -> Pulse Forge WAV
Game 04 Rune Relay   -> Fantasy Table
```

Game 04でFantasy / Neon / Clockworkを直接選ぶと、そのPackがprocedural engineの共通既定値になり、次にGame 01 / 02を開いたときも同じPackを使用します。

## Music Pack Registry

`src/music-registry.js` がMusic Packと共通設定のSource of Truthです。

```text
Music Registry
│
├─ procedural
│  ├─ Fantasy Table
│  ├─ Neon Orbit
│  └─ Clockwork Grove
│
└─ wav-stem
   └─ Pulse Forge WAV

Global Settings
├─ proceduralPackId
├─ wavStemPackId
├─ bgmEnabled
├─ sfxEnabled
├─ bgmVolume
└─ sfxVolume
```

主なAPI:

```js
listMusicPacks({ engine });
getMusicSettings();
saveMusicSettings(patch);
resetMusicSettings();
resolveMusicPack(gameId, engine);
configureMusicManager(manager, settings);
applyMusicSettingsToControls(controls, settings);
```

## Music Engine v7

現在は2系統の再生エンジンを同じRegistryから管理しています。

```text
                   Music Registry
                  /              \
       procedural                  wav-stem
           |                          |
     MusicManager              WavStemMusicManager
      /    |    \                     |
 Fantasy Neon Clockwork           Pulse WAV
           |                          |
     Game 01/02/04                 Game 03
                  \              /
                   Global Settings
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

### v4
- procedural stemsから実WAV stemsへ移行
- 5つのAudioBufferを同一時刻でスタート
- GitHub ActionsでWAVを再生成

### v5
- `playStinger(name)`
- Victory / Game Over WAV Stinger
- BGM ducking / release
- Music Debug / Mixer画面

### v6
- `switchPack(pack, options)`
- Pack変更を次小節頭へ予約
- `onPackChange()` / `getPackInfo()`

### v7
- `src/music-registry.js`
- Packをengine種別で一元登録
- Gameごとの推奨PackをRegistryで管理
- 全ゲーム共通のBGM / SE設定
- procedural Packのグローバル選択
- Game 04のPack UIをRegistry自動生成へ変更
- `/settings/music/` 共通Settings画面

## Music Debug / Mixer

ゲームロジックを介さずWAV Music Engineだけを直接操作する検証画面。

URL: https://kameusagiyahoo.github.io/game_music/debug/mixer/

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
├── music-registry.js
└── music-packs/
    ├── fantasy.js
    ├── neon.js
    ├── clockwork.js
    └── pulse.js
settings/
└── music/
    ├── index.html
    ├── settings.js
    └── styles.css
debug/
└── mixer/
games/
├── orbit-rush/
├── pulse-forge/
└── rune-relay/
assets/
├── stems/pulse/
└── stingers/pulse/
```

## Next candidates

- Packごとの `procedural / WAV / OGG / AAC` 自動選択
- procedural PackのWAV Stem版生成
- Stingerを小節頭 / beat頭へQuantize
- Transition専用Whoosh / Fill
- 44.1 kHz stereo stemsへの差し替え
- Game 05追加
