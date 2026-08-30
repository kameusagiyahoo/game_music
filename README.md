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
- Pulse Pack v1.3.0は44.1 kHz stereoのM4A / OGG / WAVを収録
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
   └─ Pulse Forge WAV v1.4.0
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

現在のPulse Manifest例:

```js
{
  schemaVersion: "1.3.0",
  id: "pulse",
  version: "1.4.0",
  name: "Pulse Forge WAV",
  engine: "wav-stem",
  states: ["normal", "build", "overdrive", "result"],
  stems: ["drums", "bass", "chords", "melody", "sparkle"],
  stingers: ["victory", "gameover"],
  transitionCues: ["fill", "whoosh", "riser", "impact"],
  masteringProfile: "game-balanced-v1",
  formats: ["m4a", "ogg", "wav"],
  facadeApi: "1.3.0"
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
//   requested: 11,
//   loaded: 11,
//   cache: { entries, ready, bytes, hits, misses, ... }
// }
```

Facade API versionはv14で `1.1.0`、v16で `1.2.0`、v17で `1.3.0`、v20のRealtime Meter API追加で現在は `1.4.0` です。

利用箇所:

- Pulse Forge: ページ表示直後に5 Stem + 2 Stinger + 4 Transition Cueをpreload
- Aether Shift: wav-stem Packを選択 / 次Waveへ予約した時点でpreload
- Resolver Lab: Pack選択時にpreloadし、START前にPRELOADED状態を表示

START後に選択形式のdecodeが失敗した場合はv13のRuntime Decode Fallbackがそのまま動作し、次形式のbytesを取得して再試行します。

CIでは `tools/check_music_preload_cache.mjs` が以下を検証します。

- preload時に11 audio assetsを取得
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
  +-- intercept only /assets/transitions/
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
//   entries: 11
// }
```

Resolver Labでは `PRELOADED 11/11 · PERSISTENT 11` のように永続保存件数も表示します。

CIでは `tools/check_music_persistent_cache.mjs` が以下を検証します。

- 初回preloadで11 assetだけnetwork取得
- Memory Cacheを全消去してページ再訪相当の状態を再現
- 2回目preloadがCache Storageから11 assetを復元
- 2回目のnetwork fetchが0
- Runtime音源URLへManifestのPack versionが付与される
- Browser cache moduleとService Workerのcache名が一致

### v16 — Beat / Bar Quantized Stingers & Transitions

Mode transition、Layer Mix、WAV Stingerを同じTransport境界へ予約できます。

```js
await music.state("result", {
  quantize: "bar"
});

await music.outcome(true, {
  quantize: "bar"
});
```

対応値:

```text
immediate
beat
bar
```

WAV Stingerは `setTimeout()` ではなくAudioContext時刻へ直接予約します。

```text
Result確定
    |
    v
現在のTransport位置
    |
    +--> NEXT BEAT
    |
    +--> NEXT BAR
             |
             v
AudioBufferSource.start(exactAudioContextTime)
             |
             v
Victory / Game Over Stinger
```

BGM duckもStinger開始境界に合わせ、attack時間ぶんだけ手前からGain rampを予約します。

WAV Engineでは以下を同じTransportへQuantizeできます。

- Mode transition
- Layer preset / layer mix
- Victory / Game Over Stinger

procedural EngineのMode transition / Layer Mixも `beat / bar` を利用できます。

Facade:

```js
music.state("tension", { quantize: "beat" });
music.outcome("victory", { quantize: "bar" });
music.cancel("stinger");
```

`music.info()` では予約中Stingerも確認できます。

```js
music.info().stinger;
// {
//   name: "victory",
//   quantize: "bar",
//   scheduledAt: 12.957,
//   pending: true,
//   playing: false
// }
```

Pulse ForgeとAether ShiftのResultでは、Result Stateと勝敗Stingerを次小節頭へ揃える構成に変更しています。

Resolver LabではStingerをNEXT BEATへ予約し、WAV MixerではQUANTIZE ON時にNEXT BARへ予約して挙動を確認できます。

Facade API versionは `1.2.0` です。

CIの `tools/check_music_quantization.mjs` では以下を実Transport時刻で検証します。

- WAV next-beat / next-bar時刻計算
- WAV Mode transitionが次Beatで適用される
- WAV Layer presetが同じBeatで適用される
- Stingerの `AudioBufferSource.start()` が次小節時刻になる
- BGM duck rampがStinger境界で完了する
- 予約中Stingerをcancelできる
- procedural Mode transitionが次Beatで適用される

### v17 — Transition Fill / Whoosh Engine

Pulse Pack v1.3.0に、状態遷移専用の実Audio Cueを4種類追加しています。

```text
fill    = short drum fill
whoosh  = noise + upward sweep
riser   = tonal / noise build-up
impact  = low-frequency transition hit
```

各CueはStem / Stingerと同様に3形式です。

```text
M4A / AAC
OGG / Vorbis
WAV
```

Manifest Schema v1.2.0では `transitionCues` を正式metadataとして管理します。

```js
transitionCues: [
  "fill",
  "whoosh",
  "riser",
  "impact"
]
```

Pulse Packのmodeごとの既定Cue:

```text
normal     <- whoosh / before
build      <- riser  / before
overdrive  <- fill   / before
result     <- impact / at
```

`before` はCueの終了時刻をBeat / Bar境界へ合わせます。

```text
Fill start
    |
    | 0.82 sec
    v
NEXT BAR
    |
    +-- Mode transition
    +-- Layer transition
    +-- Victory / Game Over Stinger
```

`at` はCueそのものを境界時刻から開始します。

```text
NEXT BAR
   |
   +-- Impact start
   +-- Result state
   +-- Result mix
   +-- Victory / Game Over
```

WAV Engineでは `AudioBufferSource.start(AudioContextTime)` を使ってCueを予約し、State transition側にも同じ `scheduledAt` を共有します。

共通FacadeではState変更時にPackのmodeMapからTransition Cueを自動選択します。

```js
await music.state("tension", {
  quantize: "bar"
});
```

Pulseでは内部的にFillが自動挿入されます。自動演出を無効化する場合:

```js
await music.state("tension", {
  quantize: "bar",
  transitionCue: false
});
```

明示的なCue再生も可能です。

```js
await music.transitionCue("riser", {
  quantize: "bar",
  position: "before"
});

music.cancel("transitionCue");
```

Result State後に `music.outcome()` を呼ぶ場合、v17では直前のState transition時刻を保持し、Victory / Game Over Stingerを同じ境界へ自動整列します。

Capabilities:

```js
music.info().capabilities.transitionCues === true;
```

Pulseのpreload対象は以下の11 assetです。

```text
5 synchronized stems
2 result stingers
4 transition cues
-------------------
11 assets
```

Transition CueもMemory Cache / Persistent Cache / Service Worker / Runtime Format Fallbackの対象です。

音源生成:

```text
tools/generate_pulse_stems.py
        |
        +-- stems
        +-- stingers
        +-- fill / whoosh / riser / impact
        |
        v
GitHub Actions + ffmpeg
        |
        +-- M4A
        +-- OGG
        +-- WAV
```

CIの `tools/check_music_transition_cues.mjs` では以下を検証します。

- Overdriveの既定CueがFill / before
- Fillの終了時刻がState transition境界と一致
- Mode / Layer transitionが同じ `scheduledAt` を共有
- Victory Stingerが同一境界へ整列
- Impactが次小節頭から開始
- AudioBufferSourceの予約時刻が計画時刻と一致

Resolver Labでは4種類のCueを個別に試聴できます。

### v18 — 44.1 kHz Stereo Audio Upgrade

Pulse Pack v1.3.0では、5 Stem / 2 Stinger / 4 Transition Cueをすべて44.1 kHz・2ch Stereoへ再生成しています。

```text
44,100 Hz
2 channels
16-bit PCM source WAV
M4A / AAC 160 kbps
OGG / Vorbis q5
```

Stemは単純なdual-monoではなく、Stemごとに異なるstereo widthとmicro-delayを持ちます。

```text
Bass      = narrow stereo
Drums     = moderate stereo
Melody    = medium stereo
Chords    = wide stereo
Sparkle   = widest stereo
```

同期Stemではmicro-delayを循環参照で生成するため、左右差を作ってもフレーム数とループ周期は変わりません。

Pulseの4小節Loopは112 BPM / 44.1 kHzでちょうど以下になります。

```text
16 beats
378,000 frames
8.571428... seconds
```

5 Stemすべてが同じ378,000 framesを持つことをCIで検証します。

Stinger / Transition CueもStereo化しています。

```text
Victory / Game Over
Fill / Whoosh / Riser / Impact
```

特にWhoosh / Riserは広め、Impact / Bass系は狭めにして、低域の定位を中央寄りに保ちます。

生成Pipeline:

```text
Python synthesis
    |
    v
44.1 kHz stereo WAV
    |
    +--> WAV 16-bit PCM
    +--> OGG Vorbis q5
    +--> M4A AAC 160 kbps
    |
    v
ffprobe profile validation
    |
    v
GitHub Pages
```

Generation Workflowは全生成ファイルについて `ffprobe` を実行し、44,100 Hz / 2ch以外を拒否します。

さらに `tools/check_pulse_audio_profile.py` がリポジトリ内の実WAVを検査します。

- sample rate = 44,100 Hz
- channels = 2
- PCM = 16-bit
- 5 Stem = 378,000 framesで完全一致
- 左右チャンネルに実差分がありdual-monoではない
- Stinger / Transition CueもStereo

Pulse Pack versionを1.3.0へ上げたため、v15のPersistent Cacheでは `?gmv=1.3.0` となり、旧音源cacheから自動的に世代更新されます。

Engine APIやゲーム側の呼び出し方法は変更していません。

### v19 — Loudness / Mastering Engine

Pulse Pack v1.4.0では、生成音源とRuntime Master Busの両方へMasteringを導入しています。

```text
Source synthesis
      |
      v
per-asset RMS target
      +
peak ceiling
      |
      v
44.1 kHz stereo assets
      |
      v
runtime layer mix
      |
      v
-3 dB headroom trim
      |
      v
-1.5 dB peak limiter
      |
      v
AudioContext destination
```

生成時は全Assetを同じ音量へ揃えません。役割ごとにRMS targetとPeak Ceilingを設定します。

```text
Stem
Drums     RMS target -20 dBFS / peak ceiling -5 dBFS
Bass      RMS target -21 dBFS / peak ceiling -6 dBFS
Chords    RMS target -22 dBFS / peak ceiling -7 dBFS
Melody    RMS target -21 dBFS / peak ceiling -6 dBFS
Sparkle   RMS target -24 dBFS / peak ceiling -8 dBFS

Stinger
Victory   RMS target -16.5 dBFS / peak ceiling -2.5 dBFS
Game Over RMS target -18.0 dBFS / peak ceiling -3.0 dBFS

Transition
Fill      RMS target -18.5 dBFS / peak ceiling -4.0 dBFS
Whoosh    RMS target -20.0 dBFS / peak ceiling -5.0 dBFS
Riser     RMS target -19.0 dBFS / peak ceiling -4.5 dBFS
Impact    RMS target -16.5 dBFS / peak ceiling -2.5 dBFS
```

Masteringは「RMS targetへ近づけるGain」と「Peak Ceilingを守るGain」の小さい方を採用します。したがってDrumsやFillのようにTransientが大きい素材ではPeak Ceilingが先に効き、無理に平均音量を持ち上げません。

Pulse Pack metadata:

```js
mastering: {
  profile: "game-balanced-v1",
  headroomDb: -3.0,
  limiter: {
    thresholdDb: -1.5,
    kneeDb: 0,
    ratio: 20,
    attack: 0.003,
    release: 0.12
  }
}
```

Runtime Master Bus:

```text
Music Stem buses
Stinger bus
Transition Cue bus
SFX bus
      |
      v
Master
      |
      v
Headroom Trim (-3 dB)
      |
      v
Peak Limiter (-1.5 dB / 20:1)
      |
      v
Output
```

以前の常時強めに掛かるCompressorではなく、通常Mixはなるべく保持し、Stinger / Impact / Overdriveが重なった瞬間のPeak保護を主目的にしています。

Runtime情報:

```js
music.info().mastering;
// {
//   profile: "game-balanced-v1",
//   headroomDb: -3,
//   trimGain: 0.7079...,
//   limiter: {
//     thresholdDb: -1.5,
//     ratio: 20,
//     attack: 0.003,
//     release: 0.12,
//     reductionDb: ...
//   }
// }
```

Capabilities:

```js
music.info().capabilities.mastering === true;
```

Music SettingsとResolver Labでは `game-balanced-v1` を確認できます。Resolver LabではHeadroomも表示します。

CI:

- `tools/check_music_mastering.mjs`
  - Runtime graphが `Master -> Headroom Trim -> Limiter -> Destination`
  - Pack metadataとRuntime設定が一致
  - Headroom -3 dB
  - Limiter threshold -1.5 dB / ratio 20:1
- `tools/check_pulse_mastering.py`
  - 11 WAV assetのRMS / Peakを実測
  - deterministic生成結果との一致
  - Peak Ceiling違反がない
  - Focus / Build / Overdrive / ResultのStem合算Mixが過大でない

Pulse Packをv1.4.0へ更新したため、Persistent Audio Cacheは `?gmv=1.4.0` へ自動世代更新されます。

### v20 — Realtime Audio Meter / QA Dashboard

WAV Stem Engineの最終出力を、iPhone / Safari上でリアルタイム監視できます。

Mastering本線は変更せず、0音量の監視branchを追加しています。

```text
MasterTrim ─────────────> Limiter ─────────────> Speaker
    |                        |
    +--> PRE Analyser        +--> OUT Analyser
             |                        |
             +--------> MeterSink gain=0
                              |
                              v
                           Speaker
```

Meter branchは `gain=0` なので本来の出力へ音を加算しません。

取得値:

```js
music.meter();
// {
//   supported: true,
//   sampleRate: 48000,
//   contextState: "running",
//   preLimiter: {
//     peakDbfs,
//     rmsDbfs
//   },
//   output: {
//     peakDbfs,
//     rmsDbfs
//   },
//   limiterReductionDb,
//   headroomDb,
//   mode,
//   layerPreset,
//   stems: {
//     drums: { gain, active, bufferReady },
//     ...
//   },
//   stinger,
//   transitionCue
// }
```

`sampleRate` はAssetの44.1 kHzではなく、その端末で実際に動いている `AudioContext.sampleRate` を表示します。iPhone側で48 kHzになった場合もその値を確認できます。

Facade API:

```js
const meter = music.meter();
```

10fps程度でMeterだけ取得できるよう、毎回 `music.info()` 全体を生成しない軽量APIにしています。

Capabilities:

```js
music.info().capabilities.realtimeMeter === true;
```

Audio QA Dashboard:

```text
/debug/audio-qa/
```

Dashboardでは以下をリアルタイム表示します。

- Pre-Limiter Peak / RMS
- Final Output Peak / RMS
- Limiter Gain Reduction
- Mastering Profile / Headroom
- 実AudioContext Sample Rate
- StemごとのLayer Gain / Active状態
- Stinger状態
- Transition Cue状態
- BAR / BEAT
- 約20秒のPeak / Limiter履歴

iPhone負荷を抑えるため、UI更新は約10fpsへ制限しています。

QA判定の目安:

```text
SAFE
  通常範囲

WATCH
  Pre-Limiter > +3 dB
  または Limiter Reduction <= -3 dB

LIMITER HEAVY
  Limiter Reduction <= -6 dB

CLIP RISK
  Post-Limiter Peak > -0.15 dBFS
```

`RESULT + VICTORY` ボタンでは、次小節頭へResult Mix / Impact / Victory Stingerを同時予約し、v19 Masteringを意図的にStress Testできます。

CIの `tools/check_music_metering.mjs` では以下を検証します。

- PRE / OUT AnalyserのPeak / RMS計算
- Limiter Reduction取得
- 実AudioContext Sample Rate取得
- Main Mastering経路が変更されていない
- MeterSink gain = 0
- Facade `music.meter()`
- AnalyserNode非対応環境で安全にfallback

Facade API versionは `1.4.0` です。

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
        +--> .m4a (AAC 160 kbps)
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
├── stingers/pulse/
│   ├── victory.{m4a,ogg,wav}
│   └── gameover.{m4a,ogg,wav}
└── transitions/pulse/
    ├── fill.{m4a,ogg,wav}
    ├── whoosh.{m4a,ogg,wav}
    ├── riser.{m4a,ogg,wav}
    └── impact.{m4a,ogg,wav}
```

Workflow: `.github/workflows/generate-pulse-stems.yml`

Validation:
- `tools/check_music_boundary.py`
- `tools/check_music_manifests.mjs`
- `tools/check_music_formats.mjs`
- `tools/check_music_runtime_fallback.mjs`
- `tools/check_music_preload_cache.mjs`
- `tools/check_music_persistent_cache.mjs`
- `tools/check_music_quantization.mjs`
- `tools/check_music_transition_cues.mjs`
- `tools/check_music_mastering.mjs`
- `tools/check_music_metering.mjs`
- `tools/check_pulse_audio_profile.py`
- `tools/check_pulse_mastering.py`
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
├── resolver/
└── audio-qa/
games/
├── orbit-rush/
├── pulse-forge/
├── rune-relay/
└── aether-shift/
assets/
├── stems/pulse/
├── stingers/pulse/
└── transitions/pulse/
```

## Next candidates

- Game 06追加
- procedural Packの実Audio Stem版生成
