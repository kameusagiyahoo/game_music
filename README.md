# game_music

GitHub Pagesだけでゲーム制作とゲーム音楽基盤を練習するプロジェクトです。

## Games

### Game 01 — Mystic Match

12枚のカードから同じ紋章の6ペアを見つける45秒のメモリーゲーム。

- Normal / Tension / Result
- 残り10秒でTensionへクロスフェード
- `createMusicFacade()` で共通Facadeを生成
- Music Registryからprocedural Packを解決
- 共通BGM / SE設定を利用

URL: https://kameusagiyahoo.github.io/game_music/

### Game 02 — Orbit Rush

9マスの中から光ったターゲットを追い続ける30秒の反射神経ゲーム。

- `createMusicFacade()` で共通Facadeを生成
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
- `createMusicFacade()` がResolver経由でWAV Stem Runtimeを自動生成
- 共通BGM / SE設定を利用

URL: https://kameusagiyahoo.github.io/game_music/games/pulse-forge/

### Game 04 — Rune Relay

4つのルーンの点灯順を覚え、同じ順番で入力する45秒のシーケンス記憶ゲーム。

- `createMusicFacade()` で共通Facadeを生成
- Music PackボタンをRegistryから自動生成
- Fantasy / Neon / Clockworkを選択可能
- プレイ中のPack変更は次の小節頭へ予約
- Pack変更を共通Settingsへ保存
- 残り10秒で現在または予約中PackのTensionへ移行

URL: https://kameusagiyahoo.github.io/game_music/games/rune-relay/

### Game 05 — Aether Shift

9つのノードを追いかける4ウェーブ制の反射ゲーム。

- `createMusicFacade()` だけで再生Facadeを生成
- Fantasy / Neon / Clockwork / Pulse WAVを同じPack UIから選択
- Pack変更は次のウェーブ境界へ予約
- procedural ↔ WAV Stemでもゲームロジックを変更せずRuntime交換
- ゲーム側は `normal / tension / result` の共通Stateだけを送信
- WAV EngineではStateがFocus / Overdrive / Result Stem Mixへ自動変換
- 勝敗演出もStinger対応EngineならWAV Stinger、それ以外はSEへ自動フォールバック
- 共通BGM / SE設定を利用

URL: https://kameusagiyahoo.github.io/game_music/games/aether-shift/
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
```

## Music Asset Resolver

`src/music-asset-resolver.js` がRegistryと再生Engineの間を仲介します。

ゲームや検証画面はPack IDまたはGame IDだけを渡し、Resolverが適切なManagerを生成します。

```text
Game / Tool
    |
    | packId or gameId
    v
Music Asset Resolver
    |
    +--> Registry entry: engine = procedural
    |        -> MusicManager
    |
    +--> Registry entry: engine = wav-stem
             -> WavStemMusicManager
```

主なAPI:

```js
resolveMusicAsset({ gameId, packId, engine });
createMusicRuntime({ gameId, packId, callbacks, settings });
getRuntimeDescriptor(runtime);
applyMusicState(runtime, state, options);
playMusicOutcome(runtime, success, options);
stopMusicRuntime(runtime);
```

`createMusicRuntime()` の戻り値:

```js
{
  entry,
  engine,
  manager,
  settings,
  capabilities
}
```

Capabilitiesには、Pack切替・Layer Mix・WAV Stem・Stingerなど、そのEngineが扱える機能を持たせています。

## Asset Resolver Lab

Packの再生方式を意識せず、4つの登録Packを同じ画面から試せる検証ページです。

- Fantasy -> proceduralを自動選択
- Neon -> proceduralを自動選択
- Clockwork -> proceduralを自動選択
- Pulse WAV -> wav-stemを自動選択
- Engine capabilitiesを表示
- PackごとのModeを自動生成
- WAV PackではStem Mix preset / Stingerも自動表示
- 共通BGM / SE設定をそのまま利用

URL: https://kameusagiyahoo.github.io/game_music/debug/resolver/

## Music Engine v8

```text
                       Music Registry
                    /                  \
          procedural                    wav-stem
              \                         /
               \                       /
                Music Asset Resolver
                         |
              createMusicRuntime()
                         |
              +----------+----------+
              |                     |
        MusicManager        WavStemMusicManager
              |                     |
       generated audio          WAV assets
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
- `/settings/music/` 共通Settings画面

### v8
- `src/music-asset-resolver.js`
- Pack IDからEngineを自動判定
- Game IDから既定Engineを自動判定
- `createMusicRuntime()` でManager生成を共通化
- EngineごとのCapabilities定義
- `/debug/resolver/` Asset Resolver Lab
- procedural / WAVを同じ選択UIから再生可能
- `applyMusicState()` でEngine固有のMode / Stem Preset差を吸収
- `playMusicOutcome()` でWAV Stinger / procedural SEを自動選択
- Game 05でウェーブ境界のEngine hot-swapを実証

## Music Engine v9 — Runtime API Unification

Game 01〜05の音楽初期化をすべて `createMusicRuntime()` に統一しました。

```text
Game 01 Mystic Match
Game 02 Orbit Rush
Game 03 Pulse Forge
Game 04 Rune Relay
Game 05 Aether Shift
        |
        | createMusicRuntime()
        v
Music Asset Resolver
        |
        +--> procedural -> MusicManager
        |
        +--> wav-stem   -> WavStemMusicManager
```

ゲームコードからの直接 `new MusicManager()` / `new WavStemMusicManager()` は禁止します。

境界を守るため、以下を追加しています。

- `tools/check_music_boundary.py`
- `.github/workflows/music-architecture-check.yml`
- Game 01〜05に `createMusicRuntime()` が存在することを検証
- GameコードからManager実装ファイルを直接importしていないことを検証

Engine固有機能はRuntime生成後のCapabilitiesに応じて利用し、Manager選択そのものはResolverへ集約します。

## Music Engine v10 — Common Facade API

Game 01〜05はMusic Managerを直接操作せず、`src/music-facade.js` の共通APIだけを利用します。

```js
music.start("normal");
music.state("tension");
music.cue("hit");
music.outcome(true);
music.stop();
```

高度機能もFacade越しに利用します。

```js
music.layer("build", { quantize: "bar" });
music.pack("neon", { quantize: "bar" });
music.audio({ musicVolume: 0.8, sfxVolume: 0.7 });
music.cancel("pack");
music.info();
```

構造:

```text
Game 01〜05
    |
    v
MusicFacade
    |
    v
Music Asset Resolver
    |
    +--> MusicManager
    |
    +--> WavStemMusicManager
```

ゲームコードでは以下を禁止しています。

- `createMusicRuntime()` の直接使用
- `.manager` 参照
- `MusicManager` / `WavStemMusicManager` の直接import
- `play / transitionTo / setLayerPreset / playStinger / sfx` などManager APIの直接呼び出し

`Music Architecture Check` がGitHub Actionsでこの境界とJavaScript構文を検証します。

## Music Engine v11 — Versioned Music Pack Manifest

各Music Packは音楽データだけでなく、versioned Manifestを持ちます。

```js
{
  schemaVersion: "1.0.0",
  id: "pulse",
  version: "1.0.0",
  name: "Pulse Forge WAV",
  engine: "wav-stem",
  states: ["normal", "build", "overdrive", "result"],
  stems: ["drums", "bass", "chords", "melody", "sparkle"],
  stingers: ["victory", "gameover"],
  facadeApi: "1.0.0"
}
```

構造:

```text
Music Pack
├─ pack data
└─ manifest
     ↓
createRegistryEntry()
     ↓
Music Registry
     ↓
Resolver / Facade / Settings
```

ManifestがSource of Truthになるため、Registry側でPack名・説明・version・Engine・state一覧を重複記述しません。

追加API:

```js
getMusicPackManifest(id);
listMusicPackManifests();
getMusicRegistrySnapshot();
music.info(); // version / schema / states / stems / stingersも返す
```

Settings画面では各Packのversion、state数、Stem数、Stinger数、Manifest schema version、Facade API versionを確認できます。

CIでは `tools/check_music_manifests.mjs` が以下を検証します。

- Pack versionがSemVer形式
- Manifest ID / Nameと実Packが一致
- 宣言したstateが `pack.modes` に存在
- Stem / Stinger宣言と実ファイル定義が一致
- Manifest schema互換性
- Facade API互換性
- Music Packファイル数とRegistry登録数の不一致
- Gameごとのdefault Packが実在

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

Manifest validation: `tools/check_music_manifests.mjs` / `.github/workflows/music-architecture-check.yml`

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
├── music-asset-resolver.js
├── music-facade.js
├── music-pack-manifest.js
└── music-packs/
    ├── fantasy.js
    ├── neon.js
    ├── clockwork.js
    └── pulse.js
settings/
└── music/
debug/
├── mixer/
└── resolver/
games/
├── orbit-rush/
├── pulse-forge/
└── rune-relay/
assets/
├── stems/pulse/
└── stingers/pulse/
```

## Next candidates

- Game 06追加

- WAV / OGG / AACのブラウザ対応Format Resolver
- procedural PackのWAV Stem版生成
- WAV / OGG / AACのブラウザ対応Format Resolver
- Stingerを小節頭 / beat頭へQuantize
- Transition専用Whoosh / Fill
- 44.1 kHz stereo stemsへの差し替え
