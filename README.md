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

- 5本の同期Stemを同一AudioContext時刻でスタート
- Pulse Pack v1.1.0はM4A / OGG / WAVを収録
- Browser Format Resolverが対応形式を自動選択
- Energyに応じて次小節からStem Mixを変更
- Victory / Game Over専用Stinger
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
- 勝敗演出もStinger対応EngineならAudio Stinger、それ以外はSEへ自動フォールバック
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
- Pack version / states / stems / stingers / formats表示
- Manifest schema / Facade API version表示
- 設定初期化

URL: https://kameusagiyahoo.github.io/game_music/settings/music/

設定は `game-music-global-settings-v1` としてlocalStorageへ保存します。

## Music Pack Registry

`src/music-registry.js` がManifestからRegistry entryを生成します。

```text
Music Registry
│
├─ procedural
│  ├─ Fantasy Table
│  ├─ Neon Orbit
│  └─ Clockwork Grove
│
└─ wav-stem
   └─ Pulse Forge WAV v1.1.0
      └─ M4A / OGG / WAV
```

## Music Asset Resolver

`src/music-asset-resolver.js` がRegistryと再生Engineの間を仲介します。wav-stem Packでは、Manager生成前にMusic Format Resolverも通ります。

```text
Game / Tool
    |
    | packId or gameId
    v
Music Asset Resolver
    |
    +--> procedural -> MusicManager
    |
    +--> wav-stem
             |
             v
       Music Format Resolver
             |
             v
       WavStemMusicManager
```

## Asset Resolver Lab

Packの再生方式を意識せず、4つの登録Packを同じ画面から試せる検証ページです。

- Fantasy -> proceduralを自動選択
- Neon -> proceduralを自動選択
- Clockwork -> proceduralを自動選択
- Pulse -> wav-stemを自動選択
- PulseではM4A / OGG / WAVの選択結果をFORMAT欄に表示
- Engine capabilitiesを表示
- PackごとのModeを自動生成
- WAV Stem PackではStem Mix preset / Stingerも自動表示

URL: https://kameusagiyahoo.github.io/game_music/debug/resolver/

## Music Engine history

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
- Victory / Game Over Stinger
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

### v8
- `src/music-asset-resolver.js`
- Pack ID / Game IDからEngineを自動判定
- `createMusicRuntime()` でManager生成を共通化
- Engine capabilities定義
- Asset Resolver Lab

### v9
- Game 01〜05の音楽初期化をResolver経由へ統一
- Architecture Checkを追加

### v10 — Common Facade API

Game 01〜05はMusic Managerを直接操作せず、`src/music-facade.js` の共通APIだけを利用します。

```js
music.start("normal");
music.state("tension");
music.cue("hit");
music.outcome(true);
music.stop();
```

高度機能:

```js
music.layer("build", { quantize: "bar" });
music.pack("neon", { quantize: "bar" });
music.audio({ musicVolume: 0.8, sfxVolume: 0.7 });
music.cancel("pack");
music.info();
```

### v11 — Versioned Music Pack Manifest

各Music Packは音楽データだけでなくversioned Manifestを持ちます。ManifestがPack metadataのSource of Truthです。

Pulse v1.1.0の例:

```js
{
  schemaVersion: "1.1.0",
  id: "pulse",
  version: "1.1.0",
  name: "Pulse Forge WAV",
  engine: "wav-stem",
  states: ["normal", "build", "overdrive", "result"],
  stems: ["drums", "bass", "chords", "melody", "sparkle"],
  stingers: ["victory", "gameover"],
  formats: ["m4a", "ogg", "wav"],
  facadeApi: "1.0.0"
}
```

CIでは `tools/check_music_manifests.mjs` がSemVer、Pack/Manifest整合性、State、Stem、Stinger、Format completeness、Schema/API互換性を検証します。

### v12 — Browser Audio Format Resolver

`src/music-format-resolver.js` がブラウザの `canPlayType()` を使い、wav-stem Packの音源形式を自動選択します。

```text
Pulse Manifest
formats = M4A / OGG / WAV
        |
        v
Browser canPlayType()
        |
        +--> M4A / AAC
        |      unavailable
        v
        +--> OGG / Vorbis
        |      unavailable
        v
        +--> WAV fallback
        |
        v
AudioContext.decodeAudioData()
```

既定優先順位:

```text
M4A(AAC) -> OGG(Vorbis) -> WAV
```

M4Aを先頭にすることでiPhone / Safari系で使いやすい構成にしつつ、OGGとWAVをfallbackとして残します。

追加API / metadata:

```js
resolvePackAudioFormat(pack);
detectAudioFormatSupport();
music.info().audioFormat;
music.info().formats;
```

`tools/check_music_formats.mjs` が以下をCIで検証します。

- M4A対応 -> M4Aを選択
- M4A非対応 / OGG対応 -> OGGを選択
- M4A / OGG非対応 -> WAVを選択
- Stem URLとStinger URLが選択形式へ切り替わる

なおv12は `canPlayType()` に基づく事前選択です。v13ではこの事前選択の後段に実decode fallbackを追加しています。

### v13 — Runtime Decode Fallback

`WavStemMusicManager` が実際の `fetch()` / `decodeAudioData()` 失敗を検知し、次の形式へ自動再試行します。

```text
Browser selection
M4A
 |
 v
fetch + decode 失敗
 |
 v
OGG
 |
 v
fetch + decode 成功
 |
 v
5 Stemを同じOGG形式で確定
 |
 v
再生開始
```

重要なルール:

- Stemは1本ずつ別形式へ落とさず、5本すべて同じ形式で成功した場合だけ採用
- 初期選択がM4Aなら基本順序は `M4A -> OGG -> WAV`
- 初期選択がOGGなら `OGG -> WAV -> M4A`
- Stingerも独立してruntime fallback
- 成功したStem形式は `sessionStorage` にPack単位で記憶
- 同一セッションの次回起動では前回成功形式を優先
- `music.info().audioFormat` は予測値ではなく実decode成功形式を返す
- `music.info().audioFormatAttempts` で失敗履歴を確認可能

Capabilities:

```js
music.info().capabilities.runtimeDecodeFallback === true;
```

Resolver Labでは再生開始後に最終採用FORMATへ表示を更新し、fallbackが発生した場合は試行回数も表示します。

CIでは `tools/check_music_runtime_fallback.mjs` がM4A decode失敗を擬似的に発生させ、OGGへfallbackして5 Stemの再生準備が完了することを検証します。

### v14 — Audio Preload / Memory Cache

ページ表示後に、再生予定のwav-stem Packをネットワーク先読みします。iOS / Safariの自動再生制限には触れず、AudioContextの開始はユーザー操作後のままです。

```text
Page load / Pack select
        |
        v
music.preload()
        |
        v
Audio Asset Memory Cache
  5 Stems + Stingers
        |
        | user taps START
        v
AudioContext resume
        |
        v
cached bytes -> decodeAudioData()
        |
        v
synchronized playback
```

共有キャッシュは `src/audio-asset-cache.js` で管理します。同じURLへのpreloadとSTARTが重なっても同じPromiseを共有するため、二重fetchしません。

Facade API:

```js
await music.preload({ stingers: true });

music.info().preload;
// {
//   state: "ready",
//   format: "m4a",
//   requested: 7,
//   loaded: 7,
//   cache: { entries, ready, bytes, hits, misses, ... }
// }
```

Facade API versionはpreload追加に伴い `1.1.0` へminor updateしました。既存Packが要求するFacade API `1.0.0` とは後方互換です。

利用箇所:

- Pulse Forge: ページ表示直後に5 Stem + 2 Stingerをpreload
- Aether Shift: wav-stem Packを選択 / 次Waveへ予約した時点でpreload
- Resolver Lab: Pack選択時にpreloadし、START前にPRELOADED状態を表示

START後に選択形式のdecodeが失敗した場合はv13のRuntime Decode Fallbackがそのまま動作し、次形式のbytesを取得して再試行します。

CIでは `tools/check_music_preload_cache.mjs` が以下を検証します。

- preload時に7 audio assetsを取得
- START時にStemの追加network fetchが発生しない
- Victory Stinger再生時にも追加network fetchが発生しない
- 共有cache hitが発生する

### v15 — Persistent Audio Cache

v14のMemory Cacheに加えて、Cache StorageとService Workerで音源をブラウザへ永続保存します。

```text
First visit
    |
    v
music.preload()
    |
    +--> Memory Cache
    |
    +--> Cache Storage
           game-music-audio-v15
    |
    v
close page

Next visit
    |
    v
Cache Storage hit
    |
    v
Memory Cache
    |
    | user taps START
    v
decodeAudioData()
    |
    v
playback
```

Service Worker:

```text
music-sw.js
  |
  +-- intercept only /assets/stems/
  +-- intercept only /assets/stingers/
  +-- cache-first
  +-- HTML / JS / CSSには干渉しない
```

音源URLにはMusic Pack versionを自動付与します。

```text
drums.m4a?gmv=1.1.0
             |
Pack v1.2.0
             v
drums.m4a?gmv=1.2.0
```

同一pathnameの古い `gmv` entryは新version保存時に削除するため、古い音源を誤再利用せず、不要なversion cacheも蓄積し続けません。

Cache StorageとService Workerは同じ `game-music-audio-v15` cacheを共有するため、同一音源を二重保存しません。

v15でもiOSのAutoplay Policyは変更しません。ネットワーク取得はページ表示後に可能ですが、AudioContextのresume / 音声再生開始はユーザー操作後です。

Capabilities:

```js
music.info().capabilities.preload === true;
music.info().capabilities.memoryAssetCache === true;
music.info().capabilities.persistentAudioCache === true;
music.info().capabilities.serviceWorkerCache === true;
```

Preload結果:

```js
const info = await music.preload({ stingers: true });

info.persistent;
// {
//   supported: true,
//   name: "game-music-audio-v15",
//   entries: 7
// }
```

Resolver Labでは `PRELOADED 7/7 · PERSISTENT 7` のように永続保存件数も表示します。

CIでは `tools/check_music_persistent_cache.mjs` が以下を検証します。

- 初回preloadで7 assetだけnetwork取得
- Memory Cacheを全消去してページ再訪相当の状態を再現
- 2回目preloadがCache Storageから7 assetを復元
- 2回目のnetwork fetchが0
- Runtime音源URLへManifestのPack versionが付与される
- Browser cache moduleとService Workerのcache名が一致

## Music Debug / Mixer

ゲームロジックを介さずWAV Stem Music Engineだけを直接操作する検証画面。

URL: https://kameusagiyahoo.github.io/game_music/debug/mixer/

## Audio generation pipeline

```text
tools/generate_pulse_stems.py
        |
        v
WAV source
        |
        v
GitHub Actions + ffmpeg
        |
        +--> .m4a (AAC 128 kbps)
        +--> .ogg (Vorbis)
        +--> .wav (fallback/source)
        |
        v
GitHub Pages
        |
        v
Music Format Resolver
        |
        v
WavStemMusicManager
```

生成対象:

```text
assets/
├── stems/pulse/
│   ├── drums.{m4a,ogg,wav}
│   ├── bass.{m4a,ogg,wav}
│   ├── chords.{m4a,ogg,wav}
│   ├── melody.{m4a,ogg,wav}
│   └── sparkle.{m4a,ogg,wav}
└── stingers/pulse/
    ├── victory.{m4a,ogg,wav}
    └── gameover.{m4a,ogg,wav}
```

Workflow: `.github/workflows/generate-pulse-stems.yml`

Validation:
- `tools/check_music_boundary.py`
- `tools/check_music_manifests.mjs`
- `tools/check_music_formats.mjs`
- `tools/check_music_runtime_fallback.mjs`
- `tools/check_music_preload_cache.mjs`
- `tools/check_music_persistent_cache.mjs`
- `.github/workflows/music-architecture-check.yml`

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
├── music-format-resolver.js
├── music-facade.js
├── music-pack-manifest.js
├── audio-asset-cache.js
├── music-service-worker.js
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
├── rune-relay/
└── aether-shift/
assets/
├── stems/pulse/
└── stingers/pulse/
```

## Next candidates

- Game 06追加
- procedural Packの実Audio Stem版生成
- Stingerを小節頭 / beat頭へQuantize
- Transition専用Whoosh / Fill
- 44.1 kHz stereo stemsへの差し替え
