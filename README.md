# game_music

GitHub Pagesだけでゲーム制作とゲーム音楽基盤を練習するプロジェクトです。

## Games

### Game 01 — Mystic Match

12枚のカードから同じ紋章の6ペアを見つける45秒のメモリーゲーム。

- Normal / Tension / Result
- 残り10秒でTensionへクロスフェード
- `createMusicFacade()` で共通Facadeを生成
- Music RegistryからFantasy WAV v2.0.0を解決
- ページ表示後に11 Audio Assetをpreload
- 共通BGM / SE設定を利用

URL: https://kameusagiyahoo.github.io/game_music/

### Game 02 — Orbit Rush

9マスの中から光ったターゲットを追い続ける30秒の反射神経ゲーム。

- `createMusicFacade()` で共通Facadeを生成
- Normal / Tension / Result
- Music RegistryからNeon WAV v2.0.0を解決
- ページ表示後に11 Audio Assetをpreload
- 残り8秒のOVERDRIVEを次小節へQuantize
- Result / Stingerも同じ小節境界へ整列
- 共通BGM / SE設定を利用

URL: https://kameusagiyahoo.github.io/game_music/games/orbit-rush/

### Game 03 — Pulse Forge

音楽の拍に同期して4方向の炉心を叩く40秒のリズム / 反射ゲーム。

- 5本の同期Stemを同一AudioContext時刻でスタート
- Pulse Pack v1.4.1は44.1 kHz stereoのM4A / OGG / WAVを収録
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
- Fantasy WAV / Neon WAV / Clockwork WAV / Pulse WAVを選択可能
- 同一Engine内のPack変更は次小節頭へ予約
- procedural ↔ WAV Stemは次のシーケンス境界でRuntime交換
- WAV Packは選択時にpreload
- Pack変更を共通Settingsへ保存
- 残り10秒で現在または予約中PackのTensionへ移行

URL: https://kameusagiyahoo.github.io/game_music/games/rune-relay/

### Game 05 — Aether Shift

9つのノードを追いかける4ウェーブ制の反射ゲーム。

- `createMusicFacade()` だけで再生Facadeを生成
- Fantasy WAV / Neon WAV / Clockwork WAV / Pulse WAVを同じPack UIから選択
- Pack変更は次のウェーブ境界へ予約
- Pack変更は同一WAV Stem Engine内で次のウェーブ境界へ適用
- ゲーム側は `normal / build / tension / result` の共通Stateだけを送信
- WAV EngineではStateがFocus / Build / Overdrive / Result Stem Mixへ自動変換
- 勝敗演出もStinger対応EngineならAudio Stinger、それ以外はSEへ自動フォールバック
- 共通BGM / SE設定を利用

URL: https://kameusagiyahoo.github.io/game_music/games/aether-shift/

## Global Music Settings

全ゲーム共通の音楽設定画面。

- BGM ON / OFF
- SE ON / OFF
- BGM音量
- SE音量
- registered procedural Pack: 0
- WAV Stem engine: `ゲーム推奨 / Fantasy WAV / Neon WAV / Pulse WAV / Clockwork WAV`
- legacy settingsをselection version 4へmigration
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
│  └─ registered packs: 0
│
└─ wav-stem
   ├─ Fantasy Table WAV v2.0.0
   │  └─ M4A / OGG / WAV
   ├─ Neon Orbit WAV v2.0.0
   │  └─ M4A / OGG / WAV
   ├─ Pulse Forge WAV v1.4.1
   │  └─ M4A / OGG / WAV
   └─ Clockwork Grove WAV v2.0.0
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

- Fantasy / Neon / Pulse / Clockwork -> wav-stemを自動選択
- 4つのReal Audio PackでM4A / OGG / WAVの選択結果をFORMAT欄に表示
- procedural Engine実装はRegistry未登録でも単体fixtureで回帰検証
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
  version: "1.4.1",
  name: "Pulse Forge WAV",
  engine: "wav-stem",
  states: ["normal", "build", "overdrive", "result"],
  stems: ["drums", "bass", "chords", "melody", "sparkle"],
  stingers: ["victory", "gameover"],
  transitionCues: ["fill", "whoosh", "riser", "impact"],
  masteringProfile: "game-balanced-v1",
  formats: ["m4a", "ogg", "wav"],
  facadeApi: "1.5.0"
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

Facade API versionはv14で `1.1.0`、v16で `1.2.0`、v17で `1.3.0`、v20で `1.4.0`、v23の共通`build` State追加で現在は `1.5.0` です。

利用箇所:

- Mystic Match: Fantasy WAVの11 Assetをページ表示後にpreload
- Orbit Rush: Neon WAVの11 Assetをページ表示後にpreload
- Pulse Forge: Pulse WAVの11 Assetをページ表示後にpreload
- Rune Relay: WAV Pack選択時にpreload
- Aether Shift: 4つのReal Audio Packを選択 / 次Waveへ予約した時点でStem + Stinger + Transition Cueをpreload
- Resolver Lab / Audio QA: WAV Pack選択時にpreload

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

### v21 — QA Session Recorder / Report Export

v20のRealtime Meterを最大60秒記録し、Audio QA Dashboard上でセッションレポートを生成できます。

```text
music.meter() @ ~10 fps
        |
        v
QA Session Recorder
        |
        +-- Peak / RMS
        +-- Limiter Reduction
        +-- Mode / Layer Preset
        +-- Stinger / Transition Cue
        +-- AudioContext Sample Rate
        |
        v
60 sec
        |
        v
Summary + Events + Samples
        |
        +--> JSON
        +--> CSV
```

Recorderは `RECORD 60s` を押すだけで開始します。Audioがまだ開始されていない場合は、そのユーザー操作内でPulseを起動してから記録します。

記録する主な指標:

- 最大Pre-Limiter Peak
- 最大Final Output Peak
- Power基準の平均Output RMS
- 最大Limiter Gain Reduction
- Limiter Reductionが3 dB以上だった累積時間
- Limiter Reductionが6 dB以上だった累積時間
- Post-Limiterが -0.15 dBFSを超えた時間
- Mode別の滞在時間 / RMS / Peak / 最大Reduction
- Stinger / Transition Cueのpending / playingイベント
- 実AudioContext Sample Rate
- Stem Gain
- BAR / BEAT

平均RMSはdB値をそのまま算術平均せず、各サンプルを線形Powerへ戻して時間加重平均したあとdBFSへ戻します。

```text
dBFS
  |
  v
linear power
  |
  +-- time weighted average
  |
  v
dBFS
```

### Sampling Coverage

iPhone / Safariで画面ロックやタブ切替が発生すると、requestAnimationFrameが停止・間引きされることがあります。

v21では長い無観測区間を「同じMeter値が継続した」とみなしません。

```text
100 ms
100 ms
1000 ms gap  <- Safari background
100 ms
```

この場合、長いgapはLimiter累積時間やMode別RMSの観測時間から除外し、

```text
samplingCoveragePercent
samplingGapSeconds
maxSampleGapMs
```

としてレポートへ記録します。

Dashboardにも `COVERAGE` を表示するため、60秒のレポートがどれだけ実測できていたか確認できます。

### QA Verdict

セッション終了時に簡易判定を返します。

```text
PASS
  clip riskなし
  heavy limiterが継続していない

REVIEW
  Reduction >= 3 dB が観測時間の10%以上

FAIL
  Post-Limiter > -0.15 dBFS が0.1秒以上
  または Reduction >= 6 dB が1秒以上 / 観測時間の10%以上
```

判定は最終的な音質評価ではなく、Mastering QAで確認対象を絞るためのguardです。

### Report Export

JSONはSummary / Events / 全Meter Samplesを保持します。

```js
{
  schemaVersion: "1.0.0",
  metadata: {
    packId: "pulse",
    packVersion: "1.4.0",
    masteringProfile: "game-balanced-v1",
    audioFormat: "m4a",
    initialSampleRate: 48000
  },
  summary: {
    durationSeconds,
    observedDurationSeconds,
    samplingCoveragePercent,
    maxOutputPeakDbfs,
    averageOutputRmsDbfs,
    maxLimiterReductionMagnitudeDb,
    limiterOver3Seconds,
    limiterOver6Seconds,
    modes,
    verdict
  },
  events: [],
  samples: []
}
```

CSVは時系列解析用で、Peak / RMS / Limiter / Mode / Cue / Stem Gainを1 sample 1 rowで出力します。

iPhone / SafariでFile共有に対応している場合は `navigator.share()` で共有シートを開きます。非対応ブラウザではBlob downloadへfallbackします。

集計ロジックは `src/music-qa-report.js` に分離しています。

CIの `tools/check_music_qa_report.mjs` では以下を検証します。

- Power平均RMS
- Limiter >= 3 dB / >= 6 dB累積時間
- Clip Risk時間
- Mode別集計
- Stinger / Transition Cueイベント
- Sampling Coverage
- Safari background相当のlong gap除外
- CSV列
- Report filename

v21は既存Facadeへ新しい音声APIを追加しないため、Facade API versionは引き続き `1.4.0` です。

### v22 — QA Baseline / Regression Compare

v21で保存したQA Report JSONをBaselineとして読み込み、最新Sessionと自動比較できます。

```text
BEFORE
  QA Report JSON
       |
       v
LOAD BASELINE
       |
       +------------------+
                          |
AFTER                     |
  RECORD 60s              |
       |                  |
       v                  v
Current QA Report --> Regression Compare
                          |
                          +--> PASS / CHANGED
                          +--> REVIEW
                          +--> FAIL
                          +--> IMPROVED
```

Audio QA Dashboardには以下を追加しています。

- `LOAD BASELINE JSON`
- `USE CURRENT AS BASELINE`
- `SHARE DIFF JSON`
- `SHARE DIFF CSV`

Baselineを読み込んだ状態で新しいSessionが完成すると自動比較します。

### 比較指標

```text
Max Output Peak Δ
Average Output RMS Δ
Max Limiter Reduction Δ
Limiter >= 3 dB rate Δ
Limiter >= 6 dB rate Δ
Clip Risk rate Δ
Sampling Coverage
Mode別 Peak / RMS / Reduction
```

Limiter時間は単純な秒数差だけでは判定しません。

例:

```text
Baseline
60 sec observed
Limiter >=3 dB = 6 sec
=> 10%

Current
30 sec observed
Limiter >=3 dB = 3 sec
=> 10%

Regression
=> 0 percentage points
```

このため、Session長が違ってもLimiter依存率を比較できます。

Raw secondsもDiff reportには残すため、

```text
seconds delta
rate delta
```

の両方を確認できます。

### RMSの扱い

RMSが増えただけでは即Regressionとはしません。

```text
RMS +0.8 dB
=> LOUDER

RMS -0.8 dB
=> QUIETER
```

主なRegression判定はPeak / Limiter / Clip Riskです。

Peakの目安:

```text
+0.75 dB  CHANGED
+1.5 dB   REVIEW
+3.0 dB   FAIL

-1.5 dB以下
=> IMPROVED候補
```

Limiter Reduction最大値:

```text
+1.5 dB   REVIEW
+3.0 dB   FAIL
```

Limiter使用率:

```text
+5 percentage points   REVIEW
+10 percentage points  FAIL
```

Clip Riskが新たに発生した場合はFAIL方向で扱います。

### Mode別Regression

共通Modeについて個別比較します。

```text
NORMAL
  Peak      +0.2 dB
  RMS       +0.3 dB
  Reduction +0.1 dB
  => PASS

OVERDRIVE
  Peak      +2.0 dB
  RMS       +0.8 dB
  Reduction +2.5 dB
  => REVIEW

RESULT
  new mode
  => CHANGED
```

これにより、全体平均だけではなく「Overdriveだけ悪化」のような変化を検出できます。

### Compatibility Warning

比較条件に差がある場合はwarningを表示します。

- Report schemaが異なる
- Pack IDが異なる
- Mastering Profileが異なる
- AudioContext Sample Rateが異なる
- Sampling Coverageが80%未満

Pack versionの違いはRegression比較の主目的になり得るため、versionが変わっただけではwarningにしません。

### Diff Export

比較結果もJSON / CSVで共有できます。

JSON:

```js
{
  baseline: {
    packVersion: "1.4.0",
    verdict: "pass"
  },
  current: {
    packVersion: "1.5.0",
    verdict: "review"
  },
  status: "review",
  metrics: {
    maxOutputPeakDb: {
      baseline: -2.1,
      current: -0.3,
      delta: 1.8
    },
    limiterOver3: {
      baselineRate: 0.04,
      currentRate: 0.075,
      deltaRate: 0.035
    }
  },
  modes: {}
}
```

CSVでは全体指標に加えてMode別Peak / Limiter Reduction差も行として出力します。

iPhoneではv21と同様、対応環境なら共有シート、非対応環境ならBlob downloadへfallbackします。

比較EngineはUIから分離した `src/music-qa-compare.js` にあります。

CIの `tools/check_music_qa_compare.mjs` では以下を検証します。

- Regression FAIL判定
- Improvement判定
- Peak / RMS / Limiter delta
- 30秒 vs 60秒のLimiter rate正規化
- Mode別Regression
- 新規Mode検出
- Sampling Coverage warning
- AudioContext Sample Rate warning
- Invalid report拒否
- Diff CSV
- Diff filename

v22では音声Engine API自体は追加していないため、Facade API versionは引き続き `1.4.0` です。

### v23 — Automated QA Scenario Runner

v20〜v22でRealtime Meter / Recorder / Baseline Compareが揃ったため、v23ではQA操作そのものを固定します。

標準Scenario:

```text
00–10 sec   NORMAL
10–20 sec   BUILD
20–40 sec   OVERDRIVE
40–60 sec   RESULT + VICTORY
```

Audio QA Dashboardの `RUN STANDARD 60s` を押すと、

```text
Pulse transport reset
        |
        v
NORMAL start
        |
        +--> Recorder start
        |
        v
Automated Scenario
        |
        +-- 10s BUILD
        +-- 20s OVERDRIVE
        +-- 40s RESULT + VICTORY
        |
        v
60s complete
        |
        +--> QA Report
        +--> Baseline Compare
```

まで自動実行します。

Scenario Runnerはゲーム内部Managerへ直接アクセスせず、通常ゲームと同じMusic Facade APIだけを使います。

```js
music.state("normal", {
  quantize: "immediate",
  transitionCue: false
});

const buildCue = await music.transitionCue("riser", {
  quantize: "bar",
  position: "before"
});

await music.layer("build", {
  quantize: "bar",
  scheduledAt: buildCue.transitionAt
});

music.state("tension", {
  quantize: "bar"
});

music.state("result", {
  quantize: "bar"
});

music.outcome(true, {
  quantize: "bar"
});
```

### 共通BUILD State

Pulse Manifestは以前から `build` Modeを持っていましたが、共通State Resolverには `build` がありませんでした。

v23で正式に追加しています。

```text
Facade state("build")

WAV Stem
  -> mode: build
  -> layer preset: build
  -> Riser transition cue

procedural
  -> tension相当へfallback
```

このAPI追加によりFacade API versionは `1.5.0` です。

Pulse Packの音源自体は変更していないためPack versionは引き続き `1.4.0` です。

### Timing Drift Guard

Scenarioは約10fpsのDashboard tickから進行しますが、各Stepには予定時刻があります。

```text
BUILD scheduled = 10,000 ms
actual          = 10,120 ms
drift           = 120 ms
=> OK
```

最大許容遅延は750 msです。

```text
BUILD scheduled = 10,000 ms
actual          = 11,000 ms
drift           = 1,000 ms
=> ABORT
```

Safariがbackgroundへ入りtimerが大きく遅れた場合、復帰後にBUILD / OVERDRIVE / RESULTを一気に実行しません。

そのRunは、

```text
status: aborted
abortReason: timing-drift:build:1000ms
```

としてRecorder metadataへ保存します。

### Scenario metadata

自動Runで作られたQA Reportには以下が追加されます。

```js
metadata: {
  qaScenarioId: "pulse-standard-v1",
  qaScenarioVersion: "1.0.0",
  qaScenarioStatus: "completed",
  qaScenarioExecution: {
    durationMs: 60000,
    maxDriftMs: 120,
    completedSteps: 4,
    totalSteps: 4,
    executions: []
  }
}
```

### Scenario Stage集計

自動Scenario中は、実際のAudio modeとは別にQA上のStageを各Meter sampleへ保存します。

```text
scenarioStage:
normal
build
overdrive
result
```

BUILDではRiserのpre-roll中やLayer切替境界があるため、単純に `meter.mode` だけを見るとQA区間と一致しない場合があります。

そこでv23では、

```js
sample.scenarioStage

report.summary.scenarioStages
```

を持たせています。

各Stageについて、

```text
duration
average RMS
max Peak
max Limiter Reduction
```

を集計します。

Regression Compareも `scenarioStages` をBaseline / Currentで比較するため、

```text
BUILDだけPeak上昇
OVERDRIVEは改善
RESULTは変化なし
```

のように、固定Scenarioの同じ区間同士を比較できます。

CSVにも `scenario_stage` 列を追加しています。

v22 Regression CompareではScenario条件も比較します。

以下はREVIEW warningです。

- Baselineがmanual、Currentがautomated
- Scenario IDが異なる
- 片方のScenarioがABORT
- max step driftが500 msを超える

これにより音量差だけでなく、比較条件そのものが揃っているか確認できます。

Scenario Engineは `src/music-qa-scenario.js` にUIから分離しています。

CIの `tools/check_music_qa_scenario.mjs` では仮想時間を使い、実際に60秒待たず以下を検証します。

- NORMAL @ 0 sec
- RISER + BUILD Layer @ 10 sec
- OVERDRIVE @ 20 sec
- RESULT + VICTORY @ 40 sec
- COMPLETE @ 60 sec
- bar quantization指定
- RESULT → VICTORYの順序
- 1,000 ms driftでABORT
- manual cancel
- action failureでABORT
- shared `build` State Resolver
- BUILD Riser / Layerの同一境界予約
- scheduler gapでABORT
- Scenario Stage別Report集計
- Scenario Stage別Regression Compare
- Facade API 1.5.0

`tools/check_music_qa_compare.mjs` でもScenario mismatch / aborted / drift warningを検証します。

Scenario中にページを非表示へするとRunを中断するため、iPhoneでは60秒間Audio QA Dashboardを前面にしたまま計測します。

### v24 — Golden QA Baseline / CI Regression Gate

v21〜v23の実機QAに加えて、Repository内の実WAVをGitHub Actions上で直接再構成するGolden QA Gateを追加しています。

```text
Pulse WAV assets
+ current layer presets
+ current mastering headroom
+ pulse-standard-v1 scenario
        |
        v
deterministic offline render
        |
        v
Pre-Limiter Peak / RMS
        |
        v
qa/baselines/pulse-standard-v1.json
        |
        v
CI Regression Gate
```

ブラウザの `DynamicsCompressorNode` は実装依存のためCIでは模倣しません。v24はv19/v20のMastering graphでいう **Limiter直前** を固定します。

Post-Limiter / 実AudioContext / iPhone固有挙動は従来どおりAudio QA Dashboardで確認します。

Golden renderer:

```text
tools/music_qa_golden.mjs
```

現在のGolden Baseline:

```text
qa/baselines/pulse-standard-v1.json
```

現在値:

```text
OVERALL
Peak  -3.96 dBFS
RMS  -21.49 dBFS

NORMAL
Peak -11.95
RMS  -25.46

BUILD
Peak  -6.99
RMS  -21.62

OVERDRIVE
Peak  -4.06
RMS  -19.16

RESULT
Peak  -3.96
RMS  -23.69
```

Offline Stage renderは以下を含みます。

```text
NORMAL
  Focus stems

BUILD
  Build stems
  + Riser

OVERDRIVE
  Overdrive stems
  + Fill

RESULT
  Result stems
  + Impact
  + Victory

ALL
  -3 dB Headroom Trim
```

### Golden Policy

現在のhard gate:

```text
Overall Peak increase > +0.75 dB  => FAIL
Stage Peak increase   > +0.75 dB  => FAIL

Overall RMS increase  > +1.50 dB  => FAIL
Stage RMS increase    > +1.50 dB  => FAIL

Absolute Pre-Limiter Peak > +3 dBFS => FAIL
```

さらに以下の構造差もFAILです。

- Scenario ID / version mismatch
- Sample Rate mismatch
- Mastering Profile mismatch
- canonical Stageの欠落 / 追加
- Golden schema / render profile mismatch

音源やPresetが変わると `sourceFingerprint` も変わります。ただしFingerprint変更だけではFAILにしません。

たとえば音源を安全な方向へ改善した場合、

```text
source changed
Peak -1.0 dB improved
RMS unchanged
=> PASS + fingerprint warning
```

とできます。

### Baseline更新

CIはGolden Baselineを自動更新しません。

意図的に音源 / Mix / Masteringを変更して新しい結果を承認するときだけ、

```sh
node tools/music_qa_golden.mjs --write
```

で更新します。

通常CI:

```sh
node tools/music_qa_golden.mjs --check
node tools/check_music_qa_golden.mjs
```

Baseline JSON差分をレビューしたうえでcommitするため、Regressionを自動で新基準へ吸収しません。

Gateの自己テストでは、

- 現在値がPASS
- Overall Peak +1 dBをBLOCK
- OVERDRIVE Peak +1 dBをBLOCK
- BUILD RMS +2 dBをBLOCK
- saferな変更はPASS
- Scenario mismatchをBLOCK
- Sample Rate mismatchをBLOCK

まで検証します。

Golden QAは「実機QAの代わり」ではなく、

```text
CI Golden Gate
  = deterministic / every commit

iPhone Audio QA
  = real browser / real limiter / final listening
```

という二段構成です。

### v25 — CI QA Report / GitHub Actions Summary

v24のGolden QA Gateを、Actionsログを読まなくても原因を把握できるQA Reportへ拡張しています。

Golden Gate実行時にGitHub Actionsの `GITHUB_STEP_SUMMARY` へ自動でMarkdownを書き込みます。

表示例:

```text
Music Golden QA
Result: FAIL

Scope       Metric   Baseline   Current   Delta      Allowed   Result
OVERALL     Peak      -3.96      -3.20    +0.76 dB   +0.75     FAIL
OVERDRIVE   Peak      -4.06      -2.90    +1.16 dB   +0.75     FAIL
BUILD       RMS      -21.62     -21.40    +0.22 dB   +1.50     PASS
RESULT      Peak      -3.96      -4.40    -0.44 dB   +0.75     IMPROVED
```

実際のSummaryには、

- OVERALL Peak / RMS
- NORMAL Peak / RMS
- BUILD Peak / RMS
- OVERDRIVE Peak / RMS
- RESULT Peak / RMS
- Baseline
- Current
- Delta
- Golden許容値
- PASS / IMPROVED / FAIL
- Pack version
- Facade API
- Scenario ID / version
- Sample rate
- Mastering profile
- source fingerprint

を表示します。

### FAIL時もSummaryを残す

Golden GateはRegression時に終了コード1を返しますが、その前にSummaryを書き込みます。

```text
Golden comparison
      |
      +--> write Actions Summary
      |
      +--> write JSON Report
      |
      v
FAIL detected
      |
      v
process exit 1
```

そのため失敗したActions runでも、Summaryから直接「どのStageの何が悪化したか」を確認できます。

GitHub Actions環境ではBlocking regressionをworkflow commandのError annotationとしても出力します。

### PRでの確認

`.github/workflows/music-architecture-check.yml` は `pull_request` でも実行されます。

PRでは、

```text
Checks
  -> Music Architecture Check
      -> Summary
```

からGolden QA比較表を確認できます。

PR本文へBotコメントを書き込む方式ではないため、追加のwrite権限は不要です。

### Machine-readable QA Report

Actions Summaryとは別に、同じ比較結果をJSONでも生成します。

CI内の生成先:

```text
qa/out/pulse-standard-v1-golden-report.json
```

GitHub Actionsでは14日保持のArtifactとして、

```text
music-golden-qa-report
```

をアップロードします。

JSON概略:

```js
{
  schemaVersion: "1.0.0",
  type: "music-golden-qa",
  passed: false,
  baseline: {
    pack: {},
    scenario: {},
    overall: {},
    stages: {}
  },
  current: {
    pack: {},
    scenario: {},
    overall: {},
    stages: {}
  },
  policy: {},
  metrics: [
    {
      scope: "OVERDRIVE",
      metric: "Peak",
      baselineDb: -4.06,
      currentDb: -2.90,
      deltaDb: 1.16,
      limitDb: 0.75,
      status: "FAIL"
    }
  ],
  failures: [],
  warnings: []
}
```

これにより後工程で、

- QA履歴集計
- Release判定
- PR差分解析
- 将来のDashboard取り込み

へそのまま利用できます。

### v25 self-check

`tools/check_music_qa_golden.mjs` はGate semanticsに加えてSummary / Report生成も検証します。

- 10 metric rows生成
- OVERALL / NORMAL / BUILD / OVERDRIVE / RESULT存在確認
- PASS heading
- FAIL heading
- IMPROVED表示
- Blocking regressions節
- fingerprint change表示
- `GITHUB_STEP_SUMMARY`相当ファイルへの追記
- JSON Report schema
- JSON ReportのFAIL metric
- JSON file書き出し

通常CIの中心部分:

```yaml
- name: Check Golden QA + Publish Summary
  env:
    GOLDEN_QA_REPORT_PATH: qa/out/pulse-standard-v1-golden-report.json
  run: node tools/music_qa_golden.mjs --check

- name: Upload Golden QA Report
  if: always()
  uses: actions/upload-artifact@v4
```

Artifact uploadは `if: always()` のため、Golden GateがFAILしたrunでもReportを回収できます。

v25は音声Engine / Facade API自体を変更しないため、Facade API versionは引き続き `1.5.0` です。

### v26 — Cross-Format Audio Parity Gate

v12〜v15でM4A / OGG / WAVの選択・fallback・cacheは完成していましたが、v24 Golden QAはWAVを基準にしています。

そのためv26では、実際にiPhoneで優先再生されるM4Aと、fallbackのOGGがWAVと同じ内容を保持していることをdecode後に検証します。

```text
11 Pulse assets
  |
  +-- 5 Stems
  +-- 2 Stingers
  +-- 4 Transition Cues
  |
  v
WAV reference
  |
  +--> M4A decode
  |
  +--> OGG decode
  |
  v
22 cross-format comparisons
```

単に拡張子・Sample Rate・Channel数を見るだけではありません。

`ffmpeg` で各形式を44.1 kHz / stereo float PCMへdecodeし、以下を比較します。

- Duration
- RMS
- Peak
- 時間方向RMS Envelope
- Envelope correlation
- Envelope mean absolute error
- codec delayを考慮した短いlag search

現在のGate:

```text
Duration delta       <= 0.080 sec
RMS delta            <= ±2.75 dB
Peak delta           <= ±3.50 dB
Envelope correlation >= 0.90
Envelope MAE         <= 2.25 dB
Envelope lag search  ±4 windows
```

Envelope windowは2048 framesです。

44.1 kHzでは約46 msなので、lag searchは約±186 msの範囲です。

AAC / Vorbisでは完全無音部分にcodec noiseやringingが生じるため、無音床そのものを比較すると実質聞こえない差が大きなdB差として現れます。

v26ではWAV reference側が `-55 dBFS` より大きいActive Windowを中心にEnvelopeを比較します。

```text
WAV active content
       |
       +--> shape preserved?
       +--> level preserved?
       +--> timing preserved?
       |
       v
M4A / OGG PASS
```

これにより、lossy codecとして正常な微小noiseは無視しつつ、

```text
drums.wav
vs
bass.m4a
```

のような誤った音源差し替えはEnvelope形状の違いでrejectできます。

### 現在の実測

現在の22比較はすべてPASSしています。

代表値:

```text
drums.m4a
RMS   -0.038 dB
Peak  -0.203 dB
Env r  0.99866

bass.m4a
RMS   -0.076 dB
Peak  +2.961 dB
Env r  0.99997

whoosh.m4a
RMS   -2.165 dB
Peak  -0.471 dB
Env r  0.99776
MAE    1.991 dB

riser.m4a
RMS   -1.417 dB
Peak  -0.914 dB
Env r  0.99098
```

最大Duration差は現在約23 msです。

### Dedicated CI

Cross-Format decodeにはffmpegが必要なため、通常のMusic Architecture Checkから分離しています。

```text
.github/workflows/pulse-format-parity.yml
```

このWorkflowは主に以下が変わった場合だけ実行します。

- `assets/stems/pulse/**`
- `assets/stingers/pulse/**`
- `assets/transitions/pulse/**`
- Parity checker自体

通常のMusic Architecture Checkへ毎回ffmpegを導入しないため、一般的なコード変更時のCIを重くしません。

専用Workflowでは、

```text
Install ffmpeg
      |
      v
22 decoded parity checks
      |
      v
Gate semantics check
      |
      v
JSON Artifact
```

を実行します。

Report:

```text
qa/out/pulse-format-parity.json
```

Artifact:

```text
pulse-format-parity-report
retention: 14 days
```

### Audio Generation Gate

Encoding設定は `tools/encode_pulse_audio.sh` に分離しています。自動再生成は `tools/generate_pulse_stems.py` または `tools/encode_pulse_audio.sh` が変わった場合だけ起動します。Pack metadataやWorkflow説明だけの変更では再encodeしません。


`.github/workflows/generate-pulse-stems.yml` でも、M4A / OGG encode後、GitHubへcommitする前に同じParity Gateを実行します。

```text
Generate WAV
   |
   v
Mastering / Stereo checks
   |
   v
Encode M4A / OGG
   |
   v
ffprobe profile check
   |
   v
Cross-Format Parity
   |
   v
Parity semantics
   |
   v
Commit generated audio
```

したがって、壊れたcompressed variantはRepositoryへ自動commitされません。

### Gate Semantics

`tools/check_pulse_format_parity_semantics.py` はGate自体の検出力を確認します。

- drums WAV vs drums M4A -> PASS
- victory WAV vs victory OGG -> PASS
- drums WAV vs bass M4A -> FAIL
- victory WAV vs gameover OGG -> FAIL

v26は音声Engine / Facade APIを変更しないため、Facade API versionは引き続き `1.5.0` です。OGG再生成のcache invalidationのためPulse Packのみ `1.4.1` へpatch bumpしています。

### v27 — Multi-Pack Real Audio / Fantasy WAV v2

Pulseで確立したReal Audio基盤をFantasyへ展開し、`fantasy` Packをproceduralから正式な `wav-stem` Engineへ昇格しました。

```text
Fantasy Table
procedural
    |
    v
Fantasy Table WAV v2.0.0
    |
    +-- 5 synchronized Stems
    +-- 2 Stingers
    +-- 4 Transition Cues
    +-- M4A / OGG / WAV
    +-- Mastering
    +-- Golden QA
    +-- Cross-Format Parity
```

Pack IDは従来どおり `fantasy` のため、ゲーム側は新しい専用IDを知る必要がありません。

### Fantasy sound design

FantasyはPulseの電子的なMixをコピーせず、よりアコースティック寄りの構成にしています。

```text
drums    frame drum / shaker
bass     warm drone
chords   harp-like broken chords
melody   airy flute-like lead
sparkle  bells / chimes
```

Audio profile:

```text
108 BPM
4 bars
44,100 Hz
stereo
16-bit PCM source WAV
392,000 frames per synchronized Stem
```

Asset数:

```text
5 Stems
2 Stingers
4 Transition Cues
-----------------
11 musical assets

× WAV / M4A / OGG
-----------------
33 files
```

Transition Cues:

- Fill
- Whoosh
- Riser
- Impact

Stingers:

- Victory
- Game Over

### Fantasy Mastering

Fantasy専用profile:

```text
fantasy-gentle-v1
```

Runtime:

```text
Stem / Stinger / Cue buses
        |
        v
Master
        |
        v
-4.0 dB Headroom
        |
        v
Limiter
threshold -2.0 dB
ratio     20:1
attack     4 ms
release  160 ms
```

Pulseの `game-balanced-v1` より意図的に静かで、Memory / Table Game向けの余裕を持たせています。

CIの `tools/check_music_fantasy_mastering.mjs` でMastering metadataとAudio Graphを固定しています。

### Fantasy Golden QA

FantasyはPulseとは別のGolden契約を持ちます。

```text
qa/baselines/fantasy-standard-v1.json
```

Canonical 60 sec:

```text
OVERALL
Peak  -6.84 dBFS
RMS  -24.66 dBFS

NORMAL
Peak -12.52
RMS  -27.26

BUILD
Peak -10.62
RMS  -24.80

OVERDRIVE
Peak  -8.04
RMS  -23.20

RESULT
Peak  -6.84
RMS  -25.40
```

Source fingerprint:

```text
c081835d8df9da9e...
```

`tools/music_qa_golden_fantasy.mjs` がRepository内の実WAVから再計算し、GitHub Actions SummaryとJSON Artifactを生成します。

Gate policyはPulseと同じです。

- Overall / Stage Peak +0.75 dB超でFAIL
- Overall / Stage RMS +1.5 dB超でFAIL
- Scenario / Sample Rate / Mastering Profile差をFAIL
- source changeでも安全方向ならPASS + warning

### Fantasy Cross-Format Parity

FantasyでもWAVをreferenceとしてM4A / OGGをdecode比較します。

```text
11 assets × 2 compressed formats
= 22 comparisons
```

初回生成結果は22/22 PASSです。

専用Workflow:

```text
.github/workflows/fantasy-format-parity.yml
```

検証:

- Duration
- RMS
- Peak
- active-content RMS Envelope
- Envelope correlation / MAE
- wrong Stem / Stinger substitution rejection

Generation Workflow:

```text
.github/workflows/generate-fantasy-stems.yml
```

自動再生成triggerは、

- `tools/generate_fantasy_stems.py`
- `tools/encode_fantasy_audio.sh`

だけに限定しています。Checkerやmetadataだけの変更でlossy audioを不要再encodeしません。

### Multi-WAV AUTO selection

WAV Stem Packが2つになったため、WAV設定にも `ゲーム推奨 / AUTO` を追加しました。

```text
Mystic Match
AUTO -> Fantasy WAV

Rune Relay
AUTO -> Fantasy WAV

Pulse Forge
AUTO -> Pulse WAV
```

v26以前のlocalStorageには、WAV PackがPulseしかなかったため `wavStemPackId:"pulse"` が既定値として保存されている場合があります。

v27ではその旧値を一度だけAUTOへmigrationします。

v27以降にユーザーが明示的にPulseを選択した場合はselection version 2として保持されます。

CI:

```text
tools/check_music_multi_wav_packs.mjs
```

でAUTO resolution / explicit override / legacy migrationを検証します。

### Rune Relay cross-engine switch

Rune Relayは以前procedural Packだけを対象にしていました。

v27では全Registry Packを表示します。

```text
Fantasy WAV
Neon procedural
Clockwork procedural
Pulse WAV
```

同一Engine:

```text
current bar
    |
    v
next bar
    |
    v
Pack switch
```

Engineを跨ぐ場合:

```text
current sequence
    |
    v
sequence boundary
    |
    v
old Facade stop
    |
    v
new Facade / Runtime
    |
    v
normal or tension state restore
```

WAV Packは選択時点でpreloadします。

### Audio QA Multi-Pack

Audio QA DashboardもPulse固定を解除しました。

```text
QA PACK
├─ Pulse WAV v1.4.1
└─ Fantasy WAV v2.0.0
```

Packを変更するとRuntime / Meter / Mastering表示 / Scenario ID / Recorderをまとめて切り替えます。

```text
Pulse
  pulse-standard-v1

Fantasy
  fantasy-standard-v1
```

Scenario / Recording中はPack selectorをlockするため、1つのReportへ2種類のPackが混ざりません。

URL:

https://kameusagiyahoo.github.io/game_music/debug/audio-qa/

### Format Resolver

`tools/check_music_formats.mjs` は現在PulseとFantasyの両方について、

```text
M4A -> OGG -> WAV
```

の選択 / fallback URLを検証します。

v27は既存Facade操作を増やしていないため、Facade API versionは引き続き `1.5.0` です。

### v28 — Neon Real Audio Pack v2

v27のFantasyに続き、`neon` Packをproceduralから正式な `wav-stem` Engineへ昇格しました。

```text
Neon Orbit
procedural
    |
    v
Neon Orbit WAV v2.0.0
    |
    +-- 5 synchronized Stems
    +-- 2 Stingers
    +-- 4 Transition Cues
    +-- M4A / OGG / WAV
    +-- neon-drive-v1 Mastering
    +-- Golden QA
    +-- Cross-Format Parity
```

Pack IDは `neon` のままなので、Orbit Rush側は新しい専用APIを必要としません。

### Neon sound design

元のprocedural NeonのSquare / Saw /高速Pulseという性格を、同期Stemへ展開しました。

```text
drums    gated electronic kick / clap / hats
bass     saw + sub hybrid pulses
chords   wide syncopated synth stabs
melody   short square/pluck lead
sparkle  sixteenth arpeggio + digital texture
```

Audio profile:

```text
132 BPM
4 bars
44,100 Hz
stereo
16-bit PCM source WAV
320,727 frames per synchronized Stem
7.2727 sec loop
```

Asset数:

```text
5 Stems
2 Stingers
4 Transition Cues
-----------------
11 musical assets

× WAV / M4A / OGG
-----------------
33 files
```

Transition Cues:

- Fill
- Whoosh
- Riser
- Impact

Stingers:

- Victory
- Game Over

### Neon Mastering

Neon専用profile:

```text
neon-drive-v1
```

Runtime contract:

```text
Master
  |
  v
Headroom -3.0 dB
  |
  v
Limiter
threshold -1.25 dB
ratio      20:1
attack      2.5 ms
release   100 ms
```

Fantasyより前へ出るMixですが、GoldenのOVERDRIVE pre-limiter Peakは `-1.60 dBFS` で、Limiter threshold直前へ収めています。

`tools/check_music_neon_mastering.mjs` がMastering metadataとAudio GraphをCIで固定します。

### Neon Golden QA

Neon専用Baseline:

```text
qa/baselines/neon-standard-v1.json
```

Canonical 60 sec:

```text
OVERALL   Peak  -1.60 / RMS -23.48 dBFS
NORMAL    Peak  -9.40 / RMS -27.04
BUILD     Peak  -4.26 / RMS -23.88
OVERDRIVE Peak  -1.60 / RMS -21.28
RESULT    Peak  -3.20 / RMS -25.25
```

Source fingerprint:

```text
0df7d30b100b2d5b...
```

`tools/music_qa_golden_neon.mjs` がRepository内WAVから毎回再計算します。

Gate:

- Overall / Stage Peak +0.75 dB超でFAIL
- Overall / Stage RMS +1.5 dB超でFAIL
- Scenario / Sample Rate / Mastering Profile差でFAIL
- source fingerprint変更はmetricsが安全ならwarning
- JSON Artifactを14日保持

### Neon Cross-Format Parity

WAV referenceに対してM4A / OGGをdecode後比較します。

```text
11 assets × 2 compressed formats
= 22 comparisons
```

生成時の初回結果は22/22 PASSです。

代表値:

```text
drums.m4a   env r 0.99894
bass.m4a    env r 0.99998
melody.m4a  env r 0.99977
whoosh.m4a  env r 0.98446
impact.m4a  peak delta +2.756 dB / PASS
```

専用Workflow:

```text
.github/workflows/neon-format-parity.yml
```

Generator:

```text
tools/generate_neon_stems.py
tools/encode_neon_audio.sh
.github/workflows/generate-neon-stems.yml
```

Generator / Encoder変更時だけ自動再生成するため、metadata変更でlossy audioを再encodeしません。

### Orbit Rush integration

Game 02はv28からNeon WAVを既定使用します。

```text
page load
   |
   v
preload 11 assets

START
   |
   v
Normal / focus mix

remaining 8 sec
   |
   v
NEXT BAR
   |
   +-- Fill
   +-- Overdrive mode
   +-- Overdrive layer preset

Result
   |
   v
NEXT BAR
   |
   +-- Impact
   +-- Result mix
   +-- Victory / Game Over Stinger
```

iOS Autoplay Policyは変更せず、ページ表示時はbytesのpreloadだけを行い、AudioContext再生はユーザーのSTART操作後です。

### Settings migration v3

v27ではNeonがprocedural Packだったため、`proceduralPackId:"neon"` を明示保存しているユーザーが存在できます。

v28では、

```text
proceduralPackId = neon
wavStemPackId    = auto
selectionVersion < 3
        |
        v
proceduralPackId = auto
wavStemPackId    = neon
selectionVersion = 3
```

へ移行します。

一方、v27でFantasy / Pulse WAVを明示選択済みなら、そのWAV設定を優先してNeonで上書きしません。

v26以前のPulse-only既定値をAUTOへ移すmigrationも維持しています。

CI:

```text
tools/check_music_multi_wav_packs.mjs
```

### Audio QA / Resolver

Audio QA Dashboard:

```text
Pulse WAV v1.4.1
Fantasy WAV v2.0.0
Neon WAV v2.0.0
```

Neonを選ぶとScenario IDも、

```text
neon-standard-v1
```

へ切り替わります。

Resolver LabではFantasy / Neon / PulseをWAV Stem、Clockworkをproceduralとして自動判定します。

Format Resolver CIも3 Packすべてについて、

```text
M4A -> OGG -> WAV
```

の選択とfallback URLを検証します。

v28でも共通Facade API自体は変更していないため、Facade API versionは `1.5.0` のままです。

### v29 — Clockwork Real Audio Pack v2 / All-Real-Audio Registry

最後に残っていた `clockwork` Packをproceduralから `wav-stem` へ昇格しました。

```text
Clockwork Grove
procedural
    |
    v
Clockwork Grove WAV v2.0.0
    |
    +-- 5 synchronized Stems
    +-- 2 Stingers
    +-- 4 Transition Cues
    +-- M4A / OGG / WAV
    +-- clockwork-balanced-v1
    +-- Golden QA
    +-- Cross-Format Parity
```

これにより現在のRegistryは4 PackすべてReal Audioです。

```text
Fantasy   -> wav-stem
Neon      -> wav-stem
Pulse     -> wav-stem
Clockwork -> wav-stem

registered procedural packs = 0
```

procedural `MusicManager` 実装そのものは削除していません。将来の軽量Packや互換性検証のため残し、`tools/check_music_quantization.mjs` ではRegistryから独立したfixtureでbeat/bar quantizationを回帰テストします。

### Clockwork sound design

ClockworkはFantasyの柔らかさ、Neonの電子速度感、Pulseのリズム感とは別に、木・金属・歯車・オルゴールを中心にしています。

```text
drums    wooden thump + metal click + ratchet
bass     warm triangle / sub drone
chords   kalimba-like mechanical plucks
melody   music-box / celesta lead
sparkle  gear ticks + tiny bells
```

Audio profile:

```text
108 BPM
4 bars
44,100 Hz
stereo
16-bit PCM source WAV
392,000 frames per synchronized Stem
8.8889 sec loop
```

Asset数:

```text
5 Stems
2 Stingers
4 Transition Cues
-----------------
11 musical assets

× WAV / M4A / OGG
-----------------
33 files
```

Transition Cues:

- Fill: accelerating ratchet roll
- Whoosh: wind-up metallic sweep
- Riser: accelerating gear ticks + music-box ascent
- Impact: gear slam + low wooden body

### Clockwork Mastering

専用profile:

```text
clockwork-balanced-v1
```

Runtime:

```text
Master
  |
  v
Headroom -3.5 dB
  |
  v
Limiter
threshold -1.75 dB
ratio      20:1
attack      3.5 ms
release   140 ms
```

`tools/check_music_clockwork_mastering.mjs` がmetadataとAudio GraphをCIで固定します。

### Clockwork Golden QA

Baseline:

```text
qa/baselines/clockwork-standard-v1.json
```

Canonical 60 sec:

```text
OVERALL   Peak  -3.23 / RMS -25.66 dBFS
NORMAL    Peak  -9.74 / RMS -28.76
BUILD     Peak  -7.33 / RMS -26.01
OVERDRIVE Peak  -5.03 / RMS -23.88
RESULT    Peak  -3.23 / RMS -26.68
```

Source fingerprint:

```text
0eeb4850cda24fb2...
```

`tools/music_qa_golden_clockwork.mjs` がRepository内WAVから毎回再計算し、Blocking Golden Gateとして動作します。

Gate policy:

- Overall / Stage Peak +0.75 dB超でFAIL
- Overall / Stage RMS +1.5 dB超でFAIL
- Scenario / Sample Rate / Mastering Profile差でFAIL
- JSON Report artifactを14日保持

### Clockwork Cross-Format Parity

WAV referenceに対してM4A / OGGをdecode比較します。

```text
11 assets × 2 compressed formats
= 22 comparisons
```

初回生成結果は22/22 PASSです。

検証:

- Duration
- RMS
- Peak
- active-content RMS Envelope
- Envelope correlation / MAE
- wrong Stem / Stinger substitution rejection

Generator / Workflow:

```text
tools/generate_clockwork_stems.py
tools/encode_clockwork_audio.sh
.github/workflows/generate-clockwork-stems.yml
.github/workflows/clockwork-format-parity.yml
```

### Aether Shift integration

Game 05の既定Packは引き続き `clockwork` ですが、v29から自動的にClockwork WAV Runtimeになります。

```text
Aether Shift
    |
    v
GAME_DEFAULT_PACKS
clockwork
    |
    v
Music Asset Resolver
    |
    v
Clockwork WAV v2.0.0
```

Pack選択 / 次Wave予約時には11 Assetをpreloadします。

```text
5 Stems
2 Stingers
4 Transition Cues
```

Wave終盤のTension、Result、Victory / Game Overは既存の共通State APIからWAV StemのOverdrive / Result Mixへ変換されます。

### Settings migration v4

v28ではClockworkが最後のprocedural Packでした。

旧設定:

```text
proceduralPackId = clockwork
wavStemPackId    = auto
selectionVersion = 3
```

v29:

```text
proceduralPackId = auto
wavStemPackId    = clockwork
selectionVersion = 4
```

へ移行します。

ただしFantasy / Neon / Pulseなど具体的なWAV Packをすでに明示選択している場合、その選択をClockworkで上書きしません。

過去のPulse-only / Neon procedural migrationも維持しています。

### Zero registered procedural packs

Music Settingsでは空のprocedural欄へ偽のAUTO選択肢を表示しません。

```text
PROCEDURAL ENGINE
registered packs: 0
Engine implementation retained for compatibility tests
```

WAV Stem側には4 Packすべてを表示します。

### Audio QA / Resolver

Audio QA Dashboard:

```text
Pulse WAV v1.4.1
Fantasy WAV v2.0.0
Neon WAV v2.0.0
Clockwork WAV v2.0.0
```

Scenario ID:

```text
pulse-standard-v1
fantasy-standard-v1
neon-standard-v1
clockwork-standard-v1
```

Resolver Labでは4 PackすべてをWAV Stemとして解決し、Format / Mastering / Stem / Stinger / Transition capabilityを同じUIから確認できます。

Format Resolver CIも4 Packすべてについて、

```text
M4A -> OGG -> WAV
```

を検証します。

v29でもFacade API surfaceは変更していないため、Facade API versionは `1.5.0` のままです。

## Music Debug / Mixer

ゲームロジックを介さずWAV Stem Music Engineだけを直接操作する検証画面。

URL: https://kameusagiyahoo.github.io/game_music/debug/mixer/

## Audio generation pipeline

```text
tools/generate_pulse_stems.py
tools/generate_fantasy_stems.py
tools/generate_neon_stems.py
tools/generate_clockwork_stems.py
        |
        v
WAV sources
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
├── stems/
│   ├── pulse/
│   ├── fantasy/
│   ├── neon/
│   └── clockwork/
├── stingers/
│   ├── pulse/
│   ├── fantasy/
│   └── neon/
└── transitions/
    ├── pulse/
    ├── fantasy/
    ├── neon/
    └── clockwork/

各Real Audio Pack:
5 stems + 2 stingers + 4 transitions
× M4A / OGG / WAV
```

Workflows:
- `.github/workflows/generate-pulse-stems.yml`
- `.github/workflows/generate-fantasy-stems.yml`
- `.github/workflows/generate-neon-stems.yml`
- `.github/workflows/generate-clockwork-stems.yml`

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
- `tools/check_music_qa_report.mjs`
- `tools/check_music_qa_compare.mjs`
- `tools/check_music_qa_scenario.mjs`
- `tools/music_qa_golden.mjs`
- `tools/check_music_qa_golden.mjs`
- `tools/music_qa_golden_fantasy.mjs`
- `tools/check_music_qa_golden_fantasy.mjs`
- `tools/check_music_multi_wav_packs.mjs`
- `tools/check_music_fantasy_mastering.mjs`
- `tools/check_music_neon_mastering.mjs`
- `tools/music_qa_golden_neon.mjs`
- `tools/check_music_qa_golden_neon.mjs`
- `tools/music_qa_golden_clockwork.mjs`
- `tools/check_music_qa_golden_clockwork.mjs`
- `tools/check_music_clockwork_mastering.mjs`
- `qa/baselines/pulse-standard-v1.json`
- `qa/baselines/fantasy-standard-v1.json`
- `qa/baselines/neon-standard-v1.json`
- `qa/baselines/clockwork-standard-v1.json`
- `tools/check_pulse_audio_profile.py`
- `tools/check_pulse_mastering.py`
- `tools/check_pulse_format_parity.py`
- `tools/check_pulse_format_parity_semantics.py`
- `tools/encode_pulse_audio.sh`
- `.github/workflows/pulse-format-parity.yml`
- `tools/check_fantasy_audio_profile.py`
- `tools/check_fantasy_format_parity.py`
- `tools/check_fantasy_format_parity_semantics.py`
- `tools/encode_fantasy_audio.sh`
- `.github/workflows/fantasy-format-parity.yml`
- `tools/check_neon_audio_profile.py`
- `tools/check_neon_format_parity.py`
- `tools/check_neon_format_parity_semantics.py`
- `tools/encode_neon_audio.sh`
- `.github/workflows/neon-format-parity.yml`
- `tools/check_clockwork_audio_profile.py`
- `tools/check_clockwork_format_parity.py`
- `tools/check_clockwork_format_parity_semantics.py`
- `tools/encode_clockwork_audio.sh`
- `.github/workflows/clockwork-format-parity.yml`
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
├── music-qa-report.js
├── music-qa-compare.js
├── music-qa-scenario.js
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
qa/
└── baselines/
    ├── pulse-standard-v1.json
    ├── fantasy-standard-v1.json
    ├── neon-standard-v1.json
    └── clockwork-standard-v1.json
games/
├── orbit-rush/
├── pulse-forge/
├── rune-relay/
└── aether-shift/
assets/
├── stems/
│   ├── pulse/
│   ├── fantasy/
│   └── neon/
├── stingers/
│   ├── pulse/
│   └── fantasy/
└── transitions/
    ├── pulse/
    ├── fantasy/
    ├── neon/
    └── clockwork/
```

## Next candidates

- Real Audio Pack間のクロスフェードHot Swap改善
- Packごとの実機QA Baseline取り込み
- Game 06追加
