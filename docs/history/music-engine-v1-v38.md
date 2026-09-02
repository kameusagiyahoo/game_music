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

### v30 — Real Audio Pack Hot Swap / Quantized Crossfade

v29で登録済み4 Packがすべて `wav-stem` になったため、Pack変更を「Runtime停止 → 再生成」ではなく、**同じAudioContext / 同じMaster Graph内のHot Swap**へ統一しました。

```text
OLD Pack
5 Stem Sources
      |
      v
oldPackGain -----\
                  +--> musicRoot --> Master --> Limiter
newPackGain -----/
      ^
      |
NEW Pack
5 Stem Sources
```

Pack切替時は次Packの5 Stemを先にdecodeします。

```text
Pack request
    |
    v
versioned asset URLs
?gmv=<pack-version>
    |
    v
M4A -> OGG -> WAV fallback
    |
    v
decode all 5 stems
    |
    v
next beat / next bar boundary
    |
    +-- oldPackGain 1.0 -> 0.0001
    +-- newPackGain 0.0001 -> 1.0
    |
    v
old source cleanup
```

decode完了後に境界時刻を決めるため、iPhone上でdecodeが長引いても「すでに過ぎた小節頭」へ予約しません。

### Same AudioContext

Hot Swap中もAudioContextは作り直しません。

```text
Fantasy 108 BPM
       |
       | NEXT BAR
       v
same AudioContext
       |
       +-- Fantasy fade out
       +-- Neon fade in
       |
       v
Neon 132 BPM
```

新Packの5 Stemはすべて**同一のAudioContext時刻**で開始します。

新Packが有効になる境界を、

```text
new transportStart
```

として再設定するため、PackごとにBPMが異なっても、新しいbeat / bar gridは切替境界から正しく始まります。

### Crossfade

Facade APIは従来の `music.pack()` のままです。

```js
await music.pack("neon", {
  quantize: "bar",
  crossfadeBeats: 2,
  mode: "normal",
});
```

対応quantize:

```text
immediate
beat
bar
```

既定crossfade:

```text
2 beats
```

fade時間は切替前PackのBPMから計算します。

### State-aware Hot Swap

予約中PackへState変更が入った場合、同じ音源を二重decodeしません。

例:

```text
Clockwork NORMALを次小節へ予約
        |
        | 残り10秒へ到達
        v
同じClockwork予約をTENSIONへ更新
        |
        v
mode   -> overdrive
preset -> overdrive
```

予約済み5 Stemはそのまま使い、target Mode / Layer Presetだけ更新します。

これによりRune Relayで、

```text
Pack switch予約
+
Tension開始
```

が同じ小節へ重なっても余分なSourceを生成しません。

### Mastering transition

PackごとにMastering Profileが違うため、Hot Swap時にはStemだけでなくMasteringも切り替えます。

```text
old headroom
      |
      | crossfade
      v
new headroom

Limiter threshold / ratio / attack / release
      |
      v
new Pack boundary
```

4 Packの例:

```text
Fantasy   fantasy-gentle-v1
Neon      neon-drive-v1
Pulse     game-balanced-v1
Clockwork clockwork-balanced-v1
```

Master / Limiter自体は共通Nodeを維持するため、AudioContextの再構築はありません。

### Cancel

境界前なら、

```js
music.cancel("pack");
```

で予約を取り消せます。

```text
scheduled new 5 stems
        |
        v
STOP / DISCONNECT

old Pack
        |
        v
continue playing
```

Masteringの未来予約も解除し、現在Packの設定へ戻します。

クロスフェードが開始済みの場合は巻き戻さず、そのHot Swapを完了させます。

### Runtime / Facade consistency

Hot Swap境界でManagerが `onPackChange()` を発火し、その時点でResolverの `runtime.entry` も新Packへ更新します。

したがって、

```text
表示 = Fantasy
内部Manifest = Pulse
```

のような不整合を作りません。

Facade:

```js
music.info().pendingId
music.info().pendingName
music.info().hotSwap
```

Hot Swap状態:

```text
scheduled
crossfading
complete
```

Capabilities:

```text
quantizedPackSwitch    = true
hotSwapPackCrossfade   = true
```

### Rune Relay

再生中のPackボタンは現在、

```text
Pack select
    |
    v
decode / cache
    |
    v
NEXT BAR
    |
    v
2 beat Hot Swap
```

です。

以前のcross-engine Runtime再生成経路は通常利用しません。v29以降、登録PackはすべてReal Audioです。

残り10秒でPack Hot Swapがまだ予約中の場合は、その予約済みPackのtarget StateをTension / Overdriveへ更新します。

URL: https://kameusagiyahoo.github.io/game_music/games/rune-relay/

### Aether Shift

Aether ShiftではPack変更を次Wave境界まで保持します。

```text
WAVE N
  |
  | user selects next Pack
  v
preload
  |
  v
WAVE boundary
  |
  +-- same AudioContext
  +-- immediate Hot Swap start
  +-- 2 beat crossfade
  |
  v
WAVE N+1
```

旧実装の、

```text
music.stop()
new MusicFacade()
new AudioContext / Runtime
```

はPack変更時には使いません。

URL: https://kameusagiyahoo.github.io/game_music/games/aether-shift/

### Resolver Lab

Resolver LabはHot Swapを直接試せます。

1. PLAY
2. 再生中に別Packを選択
3. 次小節頭で5 Stem同時開始
4. 2 beatクロスフェード
5. 新Pack BPMへTransport移行

SYNC欄には `SCHEDULED / CROSSFADING` 状態も表示します。

URL: https://kameusagiyahoo.github.io/game_music/debug/resolver/

### Hot Swap CI

専用Integration Check:

```text
tools/check_music_pack_hot_swap.mjs
```

検証内容:

- Pulse → Fantasyを次小節へ予約
- 新5 Stemが完全に同じAudioContext時刻でstart
- 境界前は旧Packを維持
- AudioContext objectを交換しない
- 境界でFacade entryも新Packへ更新
- 新Pack BPMのtransportStartを境界へ設定
- 2 beat後に旧5 Stemをcleanup
- pending Pack cancel
- 同一pending PackのState更新でduplicate Sourceを生成しない
- tension → overdrive preset mapping
- Hot Swap callback phaseを検証

v30でもFacadeの公開メソッド自体は増やしていないため、Facade API versionは `1.5.0` のままです。

### v31 — Equal-Power Hot Swap Crossfade / A-B Comparison

v30のReal Audio Hot Swapは、旧Packと新PackのPack Gainを `exponentialRampToValueAtTime()` で交差させていました。

v31ではProduction既定を **Equal-Power Crossfade** へ変更しています。

```text
progress = 0 .. 1

old gain = cos(π/2 × progress)
new gain = sin(π/2 × progress)
```

したがって曲線上では、

```text
old² + new² = 1
```

を維持します。

中央点:

```text
old = 0.7071
new = 0.7071

power sum = 1.0000
```

ここでいうpowerは2つのGain係数の二乗和です。実際の瞬間的な音圧は2 Pack間の相関や各Stem内容にも依存し、最終Peakは既存Master / Limiterで保護します。

### Why v30 changed

v30の旧方式は、

```text
old  1.0    -> 0.0001
new  0.0001 -> 1.0
```

のexponential rampでした。

指数補間の中央点は概算で、

```text
old ≈ 0.01
new ≈ 0.01

old² + new² ≈ 0.0002
```

となります。

つまりHot Swapの途中だけPack Busが大きく痩せる可能性がありました。

v31:

```text
OLD Pack
gain = cos(...)
       \
        +--> musicRoot --> Master --> Limiter
       /
NEW Pack
gain = sin(...)
```

に変更することで、異なるReal Audio Pack間をより自然に接続します。

### AudioContext scheduling

Equal-Power CurveはJS timerで細かくGainを書き換えません。

Web Audioの、

```js
AudioParam.setValueCurveAtTime()
```

を使い、129 pointのFloat32 curveをAudioContext時刻へ一括予約します。

```text
decode next 5 stems
      |
      v
resolve next beat / bar
      |
      v
same startTime
same duration
      |
      +-- outgoing Equal-Power curve
      +-- incoming Equal-Power curve
      |
      v
cleanup old sources
```

Hot Swapの量子化精度はv30と同じで、Gain Curveだけを改善しています。

### Compatibility fallback

環境が `setValueCurveAtTime()` を提供しない場合は、従来互換のexponential rampへfallbackします。

```text
supported
  -> equal-power-v1

unsupported
  -> exponential-fallback
```

通常のProduction Hot Swapは自動判定なので、ゲーム側で分岐する必要はありません。

### Runtime metadata

`music.info().hotSwap` にはCrossfade方式も出ます。

```text
phase        scheduled / crossfading
curve        equal-power-v1
curvePoints  129
scheduledAt
fadeEnd
crossfadeBeats
```

Capability:

```text
hotSwapPackCrossfade   = true
equalPowerPackCrossfade = true
```

Facadeの公開メソッドは増やしていないため、Facade API versionは引き続き `1.5.0` です。

### Resolver Lab A/B

Resolver Labでは実際に耳で比較できます。

```text
CROSSFADE CURVE

Equal-Power v1
  Production default

Legacy v30 Exponential
  Debug A/B only
```

手順:

1. PLAY
2. `Equal-Power v1` を選ぶ
3. 別Packを押して次小節Hot Swapを聴く
4. 元のPackへ戻る
5. `Legacy v30 Exponential` を選ぶ
6. 同じようにHot Swapして比較する

URL: https://kameusagiyahoo.github.io/game_music/debug/resolver/

ProductionゲームではEqual-Powerが既定で、Legacy optionはResolver比較用です。

### Equal-Power CI

専用check:

```text
tools/check_music_equal_power_crossfade.mjs
```

検証内容:

- curve point count = 129
- start = old 1 / new 0
- midpoint = old/new 約0.7071
- end = old 0 / new 1
- 全129点で `old² + new² ≈ 1`
- old/new AudioParam curveが同じstartTime / duration
- v30 exponential midpointとのpower比較
- `setValueCurveAtTime` 非対応fallback
- Hot Swap integrationで実curve予約
- Resolver Legacy optionが `exponential-v30` を選択
- Facade capability `equalPowerPackCrossfade`

現在の理論比較:

```text
MIDPOINT POWER COEFFICIENT SUM

Equal-Power v1        1.0000
Linear reference      0.5000
v30 Exponential       0.0002
```

これは実音源の最終LUFS/Peak値ではなく、Crossfade Gain Curve自体の比較です。

### v32 — Hot Swap Realtime Meter / QA Report Integration

v31のEqual-Power Hot Swapを、Realtime MeterとQA Recorderの正式な計測対象へ追加しました。

これまでは、

```text
music.info().hotSwap
```

で予約状態やCrossfade方式は確認できましたが、QA Reportの各Meter sampleにはHot Swap区間が残っていませんでした。

v32では `music.meter()` にHot Swap Snapshotを追加しています。

```js
meter.hotSwap = {
  phase: "scheduled" | "crossfading" | "complete",
  fromId: "pulse",
  toId: "fantasy",
  curve: "equal-power-v1",
  quantize: "bar",
  scheduledAt,
  fadeEnd,
  crossfadeBeats,
  fadeSeconds,
  progress,
  outgoingGain,
  incomingGain,
  powerCoefficientSum
}
```

同時に現在のPackも、

```text
meter.packId
meter.packName
```

として取得できます。

### Realtime crossfade point

Equal-Power v1:

```text
progress = 0 .. 1

old = cos(π/2 × progress)
new = sin(π/2 × progress)

powerCoefficientSum
= old² + new²
≈ 1
```

中央点:

```text
progress      0.5000
old gain      0.7071
new gain      0.7071
power Σ       1.0000
```

Resolver A/B用のLegacy v30 Exponentialも同じSnapshot APIで計測できます。

その中央点では理論power coefficient sumが大きく低下するため、Realtime Meter / QA Report上でEqual-Powerとの差を確認できます。

計算関数:

```text
samplePackCrossfadePoint()
```

### QA sample

Recorderの各sampleへ以下を追加しています。

```json
{
  "packId": "fantasy",
  "hotSwap": {
    "phase": "crossfading",
    "fromId": "pulse",
    "toId": "fantasy",
    "curve": "equal-power-v1",
    "progress": 0.52,
    "outgoingGain": 0.684,
    "incomingGain": 0.729,
    "powerCoefficientSum": 1.0
  }
}
```

したがって同じ100 ms sampleに、

```text
Hot Swap progress
+
Output Peak
+
Output RMS
+
Limiter Reduction
```

が紐付きます。

### Hot Swap QA Summary

`finalizeQaSession()` はHot SwapごとにCrossfade区間だけを集計します。

```text
from / to
curve
quantize
crossfade beats
observed crossfade duration
sample count
max output peak
min output RMS
max output RMS
average output RMS
max limiter reduction
min / max power coefficient sum
```

Report全体にも、

```text
hotSwapCount
hotSwapCrossfadeSeconds
hotSwapMaxOutputPeakDbfs
hotSwapMinOutputRmsDbfs
hotSwapMaxLimiterReductionMagnitudeDb
hotSwapMinPowerCoefficientSum
hotSwaps[]
```

を追加しています。

特に、

```text
hotSwapMinOutputRmsDbfs
```

でCrossfade中だけ音量が痩せるRegressionを確認できます。

```text
hotSwapMaxOutputPeakDbfs
hotSwapMaxLimiterReductionMagnitudeDb
```

では逆にPackの重なりで音圧が跳ねるケースを確認できます。

### Hot Swap events

QA Reportの `events[]` に、

```text
type: hot-swap

scheduled
crossfading
complete
```

を追加しています。

例:

```text
PULSE -> FANTASY
SCHEDULED
    |
    v
CROSSFADING
    |
    v
COMPLETE
```

Hot Swapが完了した直後にManager側のpending stateがcleanupされても、Recorderは直前のSwap情報からCOMPLETE eventを生成します。

### CSV

CSVへ以下を追加しています。

```text
pack_id
hot_swap_phase
hot_swap_from
hot_swap_to
hot_swap_curve
hot_swap_progress
hot_swap_outgoing_gain
hot_swap_incoming_gain
hot_swap_power_coefficient_sum
```

そのためJSONを使わなくてもSpreadsheet等でCrossfade部分だけfilterできます。

### Audio QA Dashboard

Audio QA Dashboardに専用Hot Swap Monitorを追加しました。

```text
TARGET PACK
CROSSFADE CURVE
QUEUE NEXT BAR
CANCEL QUEUE
```

Realtime表示:

```text
PULSE -> FANTASY
CROSSFADING
54%

CURVE       EQUAL-POWER-V1
OLD GAIN    0.661
NEW GAIN    0.750
POWER Σ     1.0000
```

手順:

1. START AUDIO
2. 必要なら RECORD 60s
3. TARGET PACKを選択
4. Equal-Power / Legacyを選択
5. QUEUE NEXT BAR
6. CrossfadeをRealtime監視
7. STOP & ANALYZE
8. JSON / CSVを保存

Standard 60s Scenario中はPack条件を固定するためHot Swap操作を無効化します。

手動Recorder中はHot Swap可能です。

Hot Swap完了後は、Dashboardの現在Pack / Mastering / Scenario IDも新Packへ追従します。

URL: https://kameusagiyahoo.github.io/game_music/debug/audio-qa/

### v32 CI

専用check:

```text
tools/check_music_hot_swap_qa.mjs
```

検証内容:

- Equal-Power midpoint old/new ≈ 0.7071
- Equal-Power power sum ≈ 1.0
- Legacy midpointのpower dipを検出
- Manager Realtime MeterにHot Swap metadata
- progress = 0.5 のSnapshot
- QA Hot Swap window集計
- Hot Swap Peak / min RMS / Limiter Reduction
- scheduled / crossfading / complete event
- CSV Hot Swap columns

既存の、

```text
tools/check_music_pack_hot_swap.mjs
tools/check_music_equal_power_crossfade.mjs
```

と合わせて、

```text
Scheduling correctness
        +
Gain curve correctness
        +
Realtime QA observability
```

の3層でHot Swapを検証します。

Facadeの公開メソッドは増えていないため、Facade API versionは引き続き `1.5.0` です。

### v32 — Hot Swap QA Regression Gate

v30でReal Audio Pack Hot Swap、v31でEqual-Power Crossfadeを導入し、v32ではそのCrossfade区間をRealtime Meter / QA Reportから自動判定するGateへ昇格しました。

```text
Hot Swap
  |
  v
Realtime Meter @ ~10 fps
  |
  +-- Output Peak
  +-- Output RMS
  +-- Limiter Reduction
  +-- outgoing gain
  +-- incoming gain
  +-- power coefficient sum
  +-- crossfade progress
  |
  v
QA Report
  |
  v
Hot Swap QA Gate
```

### Hot Swap Report Window

Crossfade中のsampleだけを同じ `fromId -> toId + scheduledAt` 単位へまとめます。

各Hot Swapについて保存する値:

```text
from / to
curve
quantize
scheduledAt / fadeEnd
crossfadeBeats / fadeSeconds

max Output Peak
min / max / average Output RMS
max Limiter Reduction
min / max Power Σ

edge average RMS
midpoint average RMS
midpoint RMS delta
```

RMS dipはPackごとの絶対音量ではなく、同一Crossfadeの両端と中央を比較します。

```text
edge RMS
   \
    +--> reference RMS
   /
edge RMS

midpoint RMS - reference RMS
        |
        v
midpointRmsDeltaDb
```

これによりFantasy / NeonのようにMastering Profileが異なるPack間でも、Crossfade途中だけ不自然に痩せていないかを見られます。

### Gate Policy

初期v32 policy:

```text
POWER Σ
< 0.80          FAIL
< 0.95          REVIEW

OUTPUT PEAK
> -0.15 dBFS    FAIL
> -0.50 dBFS    REVIEW

LIMITER REDUCTION
> 6.0 dB        FAIL
> 3.0 dB        REVIEW

MIDPOINT RMS DELTA
< -9.0 dB       FAIL
< -5.0 dB       REVIEW

CROSSFADE SAMPLES
< 3             REVIEW
```

Production既定のEqual-Power v1では理論上、

```text
old² + new² ≈ 1.0
```

なので `Power Σ` が大きく落ちればCrossfade scheduling / gain curveのRegressionとして即検出できます。

旧v30 exponential A/Bでは中央付近のPower Σが約 `0.0002` まで落ちるため、Gate上はFAILになります。これはResolverでLegacy挙動を比較するための意図した結果です。

### Overall QA Verdict

Hot Swap Gateは独立表示だけではなく、Session全体のVerdictにも伝播します。

```text
Hot Swap PASS
  -> 通常QA判定を維持

Hot Swap REVIEW
  -> overall REVIEW以上

Hot Swap FAIL
  -> overall FAIL
```

Hot Swapが存在しないReportでは、

```text
hotSwapQa.status = not-applicable
```

となり、通常のPeak / RMS / Limiter QAへ影響しません。

### Audio QA Dashboard

Audio QA DashboardのHot Swapパネルを実際に操作可能にしました。

```text
START AUDIO
   |
   v
TARGET PACK
   |
   +-- Fantasy
   +-- Neon
   +-- Pulse
   +-- Clockwork
   |
   v
CROSSFADE CURVE
   |
   +-- Equal-Power v1
   +-- Legacy v30 Exponential
   |
   v
QUEUE NEXT BAR
```

Target PackはHot Swap前に11 Assetをpreloadします。

Realtime表示:

```text
SCHEDULED
CROSSFADING
IDLE

route
progress
curve
old gain
new gain
Power Σ
```

Recorder終了後はSession Summaryに、

```text
HOT SWAPS
XFADE TIME
XFADE MAX PEAK
XFADE MIN RMS
XFADE MAX GR
MIN POWER Σ
HOT SWAP QA
```

を表示します。

さらにSwap単位で、

```text
PULSE -> FANTASY
PASS
ΔRMS -0.6 dB
PK -2.0
Σ 1.000
GR 1.2
```

のように判定行を表示します。

URL:

https://kameusagiyahoo.github.io/game_music/debug/audio-qa/

### Hot Swap QA CI

既存Integration Check:

```text
tools/check_music_hot_swap_qa.mjs
```

をv32 Gate semanticsまで拡張しました。

検証:

- Equal-Power safe swap -> PASS
- Legacy v30 Power collapse -> FAIL
- midpoint RMS -10 dB級dip -> FAIL
- Limiter Reduction 7 dB -> FAIL
- Output Peak -0.05 dBFS -> FAIL
- crossfade sample不足 -> REVIEW
- Hot Swapなし -> N/A
- Hot Swap FAILがoverall QA Verdictへ伝播
- Realtime metadata / Report summary / CSV event列も従来どおり検証

v32はFacade公開メソッドを増やしていないため、Facade API versionは引き続き `1.5.0` です。

### v33 — Hot Swap QA Baseline / Regression Compare

v32では各Hot Swapを絶対Gateで判定していました。

```text
Current Hot Swap
      |
      v
Power Σ / Peak / Limiter / Midpoint RMS
      |
      v
PASS / REVIEW / FAIL
```

v33ではこれに加えて、過去のQA SessionをBaselineとしてHot Swap品質そのものをRegression比較します。

```text
Baseline QA Report
        |
        | same route / occurrence
        v
Current QA Report
        |
        v
Hot Swap Regression Compare
```

比較単位:

```text
fromId -> toId
+
同一路線のn回目
```

例:

```text
PULSE -> FANTASY #1
PULSE -> FANTASY #2
FANTASY -> NEON #1
```

Curveは同一路線内の属性として比較します。

```text
equal-power-v1
        ↓
exponential-v30

=> REVIEW
```

### Regression metrics

各Hot Swapについて比較する値:

- Max Output Peak
- Max Limiter Reduction
- Midpoint RMS Delta
- Minimum Power Coefficient Sum
- Crossfade Duration
- Curve
- Quantize mode
- Route presence

Policy:

```text
PEAK INCREASE
>= +1.0 dB    REVIEW
>= +2.0 dB    FAIL

LIMITER INCREASE
>= +1.0 dB    REVIEW
>= +2.5 dB    FAIL

MIDPOINT RMS REGRESSION
<= -2.0 dB    REVIEW
<= -4.0 dB    FAIL

MIN POWER Σ REGRESSION
<= -0.03      REVIEW
<= -0.08      FAIL

CROSSFADE DURATION CHANGE
>= 20%        REVIEW
>= 40%        FAIL
```

これはv32のAbsolute Gateとは別です。

```text
Absolute Hot Swap Gate
「今のSwap自体が安全か」
        +
Baseline Regression Gate
「前回より悪化していないか」
```

したがってBaselineもCurrentも同じ危険値ならRegression差分だけではPASSになり得ますが、v32 Absolute Gate側ではFAILのままです。

### Matching behavior

BaselineとCurrentで同一路線をoccurrence順に対応付けます。

Routeが増減した場合:

```text
Baseline
PULSE -> FANTASY

Current
PULSE -> NEON

=> route changed
=> REVIEW
```

これにより異なるHot Swap条件を誤って同一Regressionとして扱いません。

### Compare output

`compareQaReports()` のschemaは `1.1.0` へ更新しました。

追加:

```js
comparison.hotSwaps = {
  status,
  baselineCount,
  currentCount,
  comparedCount,
  regressionCount,
  improvementCount,
  routeChangeCount,
  policy,
  items
}
```

各item:

```text
route / occurrence
presence
status
baseline
current
delta
failures
warnings
```

Overall ComparisonへもHot Swap結果を伝播します。

```text
Hot Swap FAIL
  -> overall comparison FAIL

Hot Swap REVIEW
  -> overall comparison REVIEW以上

Hot Swap IMPROVED
  -> 他metricも安全ならoverall IMPROVEDへ寄与
```

### CSV

Comparison CSVへHot Swap差分行も追加しました。

例:

```text
hot-swap:pulse->fantasy#1:peak_db
hot-swap:pulse->fantasy#1:midpoint_rms_delta_db
hot-swap:pulse->fantasy#1:limiter_reduction_db
hot-swap:pulse->fantasy#1:min_power_sum
hot-swap:pulse->fantasy#1:duration_relative
```

### Audio QA Dashboard

QA Compareパネルへ `HOT SWAP REGRESSION` セクションを追加しました。

表示例:

```text
PULSE -> FANTASY #1
PASS

PK   +0.2 dB
MID  -0.4 dB
GR   +0.3 dB
Σ    -0.004
DUR  +3%
EQUAL-POWER-V1
```

Curve変更時:

```text
EQUAL-POWER-V1 -> EXPONENTIAL-V30
REVIEW
```

操作:

1. RecorderでBaseline Sessionを作成
2. `USE CURRENT AS BASELINE` またはBaseline JSONを読み込む
3. 同じHot Swap routeを再実行
4. Recorder終了
5. QA Compareで差分確認
6. JSON / CSV Diffを共有

URL:

https://kameusagiyahoo.github.io/game_music/debug/audio-qa/

### v33 implementation

新規module:

```text
src/music-qa-hot-swap-compare.js
```

通常のQA Compareとは分離しているため、Hot Swap policyを独立して調整できます。

既存:

```text
src/music-qa-compare.js
```

から呼び出します。

CI:

```text
tools/check_music_qa_compare.mjs
```

で以下を検証します。

- identical Hot Swap -> PASS
- Peak +2.1 dB -> FAIL
- Limiter +2.6 dB -> FAIL
- Midpoint RMS regression -> FAIL
- Power Σ regression -> FAIL
- duration +25% -> REVIEW
- Route change -> REVIEW
- Curve change -> REVIEW
- safer swap -> IMPROVED
- Hot Swap RegressionがOverall Comparisonへ伝播
- CSV Hot Swap rows

Facade APIは変更していないため、引き続き `1.5.0` です。

### v34 — Pack Device QA Baseline Registry

v21〜v33では実機QA ReportをBaselineとして比較できましたが、Baselineはページ内の一時状態でした。

v34では、iPhoneで承認したStandard 60s ReportをPack単位で永続保存できます。

```text
iPhone / Safari
     |
     v
RUN STANDARD 60s
     |
     v
QA Report
     |
     +--> eligibility check
     |
     v
SAVE PACK BASELINE
     |
     v
localStorage
game-music-qa-pack-baselines-v1
```

保存対象:

```text
Fantasy
Neon
Pulse
Clockwork
```

各Packは1つの承認済みDevice Baselineを持ちます。

### Baseline eligibility

実測値を自動的にBaseline化しません。

以下をすべて満たすReportだけ保存できます。

```text
QA report schema valid
Pack ID一致
qaScenarioId = <pack>-standard-v1
qaScenarioStatus = completed
Sampling Coverage >= 90%
overall verdict != FAIL
```

したがって、

- 途中でSafariをbackgroundへ移してABORTした測定
- Coverage不足の測定
- 手動60秒Recorder
- 別PackのReport
- FAIL判定のReport

を誤って「正常基準」として登録しません。

REVIEW Reportは人間が内容を確認して明示的に保存できます。

### Compact storage

通常QA Reportには約10 fpsのRaw Meter Samplesが入ります。

Pack Baseline保存時はRegression Compareに必要な、

- metadata
- summary
- Mode summary
- Scenario Stage summary
- Hot Swap summary
- QA verdict

を残し、Raw `samples[]` と `events[]` は空配列へ縮小します。

```text
Full device QA report
  metadata
  summary
  events
  ~600 raw samples
        |
        v
Compact baseline
  metadata
  summary
  events  []
  samples []
```

元の完全Reportは従来どおりJSONとして共有できます。

これにより4 Pack分のBaselineをiPhone localStorageへ保持しても容量を使いすぎません。

### Automatic Pack restore

Audio QAでPackを切り替えると対応Baselineを自動ロードします。

```text
QA PACK = Fantasy
      |
      v
Fantasy saved baseline
      |
      v
QA Compare

QA PACK = Neon
      |
      v
Neon saved baseline
      |
      v
QA Compare
```

Pack間でBaselineを使い回しません。

手動Hot SwapをRecorder中に実行している場合は、Recording途中でBaselineを勝手に交換しません。

### Audio QA controls

QA Compareへ以下を追加しました。

```text
LOAD BASELINE JSON
USE CURRENT AS BASELINE
SAVE PACK BASELINE
DELETE SAVED
SHARE SAVED
SHARE DIFF JSON
SHARE DIFF CSV
```

基本手順:

1. QA PACKを選択
2. `RUN STANDARD 60s`
3. Reportを確認
4. `USE CURRENT AS BASELINE`
5. `SAVE PACK BASELINE`
6. 次回以降は同Pack選択時に自動ロード

既存Reportを取り込む場合:

1. `LOAD BASELINE JSON`
2. eligibilityを確認
3. `SAVE PACK BASELINE`

保存済みBaselineは `SHARE SAVED` からJSONとして共有できます。

別端末ではそのJSONを `LOAD BASELINE JSON` → `SAVE PACK BASELINE` すれば移行できます。

URL:

https://kameusagiyahoo.github.io/game_music/debug/audio-qa/

### Repository Goldenとの違い

v24以降のGolden QAとDevice Baselineは役割が違います。

```text
Repository Golden
  actual WAV files
  deterministic offline render
  pre-limiter
  GitHub Actions
  every commit

Device QA Baseline
  iPhone / Safari
  real AudioContext
  real limiter
  selected compressed format
  user-approved measurement
  local per device
```

Device Baselineの数値をRepository側で推測・生成しません。

実機測定した値だけを保存します。

### v34 implementation

新規module:

```text
src/music-qa-baseline-registry.js
```

API:

```js
getQaBaselineEligibility(report)
saveQaPackBaseline(report)
loadQaPackBaseline(packId)
listQaPackBaselines()
deleteQaPackBaseline(packId)
clearQaPackBaselines()
compactQaBaselineReport(report)
```

CI:

```text
tools/check_music_qa_baseline_registry.mjs
```

検証:

- completed Standard 60s -> eligible
- wrong Scenario -> reject
- aborted Scenario -> reject
- Coverage 90%未満 -> reject
- FAIL Report -> reject
- Pack mismatch -> reject
- Pack別save / load
- 同一Pack overwrite
- delete / clear
- Raw Samples / Events compact化
- corrupted localStorageを安全に空Registryとして扱う

Facade / Audio Engine APIは変更していないため、Facade API versionは引き続き `1.5.0` です。

### v35 — Automated Hot Swap Route Matrix

v30〜v34でHot Swap / Equal-Power / Realtime QA / Baseline Compare / Device Baselineが揃ったため、v35では4 Pack間の全方向Hot Swapを固定Scenarioとして自動実行します。

```text
4 Real Audio Packs
Fantasy
Neon
Pulse
Clockwork

directed routes
4 × 3
= 12 routes
```

Routeは自己遷移を除く完全有向グラフをEulerian circuitとして並べます。

そのため、

- 12方向を重複なく1回ずつ通る
- 前Routeの到着Packが次Routeの出発Packになる
- 最後は開始Packへ戻る

という連続した1本の実機Scenarioになります。

既定設定:

```text
Scenario ID       hot-swap-route-matrix-v1
First swap        3 sec
Route interval    5 sec
Tail              6 sec
Total             64 sec

Quantize          bar
Crossfade         2 beats
Curve             equal-power-v1
Mode              normal
```

Audio QA Dashboardの `RUN ALL 12 ROUTES` で実行します。

実行中は、

- QA Pack selector
- 手動Hot Swap
- Standard 60s
- Device Baseline保存

をロックし、12 Routeを1つのQA Reportへ記録します。

### Route Matrix Gate

`src/music-qa-route-matrix.js` はScenario生成だけでなく、完了Report自体も判定します。

PASS条件の中心:

```text
Scenario completed
12 / 12 routes completed
12 Hot Swaps observed
12 Hot Swap QA evaluations
12 unique directed routes
overall QA != FAIL
Hot Swap QA != FAIL
Sampling Coverage >= 90%
```

判定:

```text
complete + safe
→ PASS

complete but low coverage / review metrics
→ REVIEW

missing route / incomplete / Hot Swap FAIL
→ FAIL
```

Route Matrix ReportはPack単体のStandard 60sとは目的が違うため、v34 Device Baselineへ誤保存できません。

CI:

```text
tools/check_music_qa_route_matrix.mjs
```

仮想schedulerで実時間64秒を待たず、

- 4 Pack / 12 directed routes
- route uniqueness / continuity
- start Packへreturn
- fixed timeline
- bar / 2 beat / equal-power options
- timing drift abort
- 12-route QA aggregation
- incomplete 11/12 FAIL
- low coverage REVIEW
- Pack Standard baseline reuse BLOCK

まで検証します。

### v36 — Device Baseline Compatibility Gate

v34のPack Device BaselineはPack単位で自動ロードできましたが、保存された実機条件とCurrent Runの条件が違っていても、従来はRegression Compare自体を実行できました。

v36ではSaved Device Baselineに**比較契約**を追加します。

```text
Saved Device Baseline
        |
        +-- Pack ID
        +-- Pack version
        +-- Audio Format
        +-- Mastering Profile
        +-- Scenario ID / version
        +-- AudioContext Sample Rate
        +-- Facade API
        |
        v
Current QA Report
        |
        v
Compatibility Gate
```

判定は3段階です。

```text
EXACT
  Pack version same
  Audio Format same
  Sample Rate same
  Mastering same
  Scenario same
  → normal regression compare

REVIEW
  Pack version only changed
  → regression compare allowed
  → version-change warning

INCOMPATIBLE
  Pack ID differs
  Audio Format differs
  AudioContext Sample Rate differs
  Mastering Profile differs
  Scenario ID/version differs
  → Saved Device Baseline automatic compare BLOCKED
```

Pack version差だけを完全ブロックしないのは、`v2.0.0 -> v2.1.0` のような意図的な新versionをBaselineと比較すること自体がRegression QAの主要用途だからです。

一方、

```text
M4A baseline
vs
OGG current
```

や、

```text
48 kHz baseline
vs
44.1 kHz current
```

を同一条件の数値差として扱いません。

### Baseline save contract v36

新しくDevice Baselineとして保存するReportは、v34の条件に加えて以下を必須にします。

- Pack version
- Audio Format
- Mastering Profile
- AudioContext Sample Rate
- Scenario version

したがって、比較条件を証明できないReportはDevice Baselineとして承認できません。

既存v34/v35 Baselineは後方互換です。

旧entryのtop-levelに `audioFormat` や `sampleRate` がなくても、compact report内のmetadataから復元します。

### Audio QA表示

Saved Baseline行は現在、

```text
SAVED · FANTASY v2.0.0 · M4A · 48.0 kHz · EXACT
```

のように表示します。

Pack versionだけ違う場合:

```text
... · REVIEW
```

Format / Sample Rateなどが違う場合:

```text
... · INCOMPATIBLE
```

INCOMPATIBLE時はPeak / RMS / Limiterなどの差分表を出さず、何の契約が違うかを表示します。

手動 `LOAD BASELINE JSON` は探索用途として従来どおり比較可能です。Strict Gateは自動ロードされるSaved Device Baselineに適用します。

実装:

```text
src/music-qa-baseline-registry.js
getQaBaselineCompatibility()
```

CI:

```text
tools/check_music_qa_baseline_registry.mjs
```

検証:

- exact same contract -> EXACT
- Pack version only -> REVIEW + comparable
- M4A -> OGG -> INCOMPATIBLE
- 48 kHz -> 44.1 kHz -> INCOMPATIBLE
- Mastering change -> INCOMPATIBLE
- Scenario change -> INCOMPATIBLE
- missing format/rate/version/mastering -> baseline save BLOCK
- legacy saved-entry metadata fallback -> EXACT

Facade / Audio Engine APIは変更していないため、Facade API versionは引き続き `1.5.0` です。

### v37 — Route Matrix Device Baseline / 12 Route Regression History

v35の12 Route自動Scenarioとv36のDevice Contract Gateを、Route Matrix専用Baselineへ拡張しました。

Pack単体のStandard 60s Baselineとは保存先を分離します。

```text
Pack Device Baseline
  <pack>-standard-v1
  1 Pack
  localStorage:
  game-music-qa-pack-baselines-v1

Route Matrix Device Baseline
  hot-swap-route-matrix-v1
  4 Packs / 12 directed routes
  localStorage:
  game-music-qa-route-matrix-baselines-v1
```

Route Matrix ReportをPack単体Baselineとして誤保存することは引き続きできません。

### Route Matrix baseline eligibility

保存可能なのは、以下を満たす実機Reportだけです。

```text
Scenario = hot-swap-route-matrix-v1
Scenario completed
12 / 12 routes completed
12 Hot Swaps observed
12 Hot Swap QA evaluations
12 unique directed routes
Sampling Coverage >= 90%
Route Matrix Gate != FAIL
```

さらに比較条件を再現できるよう、以下の契約情報を必須にしています。

```text
Route Matrix contract
├─ Scenario ID / version
├─ Route Matrix schema
├─ Start Pack
├─ Route Count
├─ Route Interval
├─ Duration
├─ Quantize
├─ Crossfade Beats
├─ Crossfade Curve
└─ AudioContext Sample Rate

Per-Pack contract × 4
├─ Pack ID
├─ Pack Version
├─ Mastering Profile
├─ Audio Format
└─ Facade API
```

4 Packのpreload時に実際に選択されたAudio Formatを記録するため、M4A / OGG / WAV fallback状態もBaseline契約へ入ります。

### Compatibility Gate

Route Matrix Device Baselineの比較判定も3段階です。

```text
EXACT
  Scenario / Matrix config same
  Start Pack same
  Sample Rate same
  Crossfade config same
  4 PackのFormat / Mastering same
  Pack version same
  → 12 route Regression Compare

REVIEW
  Pack versionのみ変更
  Facade APIのみ変更
  → 比較可能
  → warning付き

INCOMPATIBLE
  Start Pack違い
  M4A / OGGなどFormat違い
  Sample Rate違い
  Mastering違い
  Quantize違い
  Crossfade Beats違い
  Crossfade Curve違い
  Route Matrix schema / timeline違い
  → 自動比較BLOCK
```

条件がINCOMPATIBLEの場合は、12 RouteのPeak / Mid RMS / Limiter / Power Σ差を数値Regressionとして扱いません。

### 12 Route Regression

互換性を通過したBaselineは既存v33のHot Swap比較Engineへ渡します。

そのため12方向すべてについて、

```text
Fantasy -> Neon
Fantasy -> Pulse
Fantasy -> Clockwork
...
Clockwork -> Pulse

各Route:
Peak delta
Midpoint RMS delta
Limiter Reduction delta
Minimum Power Σ delta
Crossfade Duration delta
Curve
```

をBaseline / Currentで比較します。

Pack versionだけ変更されたRunでは比較結果自体に加えて、

```text
ROUTE BASELINE REVIEW
```

を表示します。

### Device history

Route Matrix Baselineは最新1件だけではなく、端末内に最大6件保存します。

```text
Route Matrix Device History
#1 latest
#2
#3
#4
#5
#6 oldest retained
```

7件目を保存すると最古の1件を落とします。

Raw Meter Samples / Eventsは保存せず、

- metadata
- summary
- 12 Hot Swap summary
- QA verdict
- Matrix contract

だけをcompact保存します。

### Audio QA workflow

Audio QA DashboardのRoute Matrix欄へ追加しました。

```text
RUN ALL 12 ROUTES
        |
        v
64 sec complete
        |
        +--> Route Matrix Gate
        +--> route-by-route QA
        |
        v
SAVE MATRIX BASELINE
        |
        v
Device History (max 6)
```

操作:

```text
SAVE MATRIX BASELINE
SHARE SELECTED
CLEAR HISTORY
```

履歴行をタップすると、その実機Baselineへ切り替わります。

新しいMatrixを開始すると、**同じStart Packの最新Baseline**を自動ロードします。

```text
PULSE start Matrix
   -> latest PULSE-start baseline

FANTASY start Matrix
   -> latest FANTASY-start baseline
```

一方、Standard 60sを開始するとPack単体Baselineへ自動的に戻ります。

これにより、

```text
Pack Standard Baseline
Route Matrix Baseline
```

を同じQA Compare画面で使いながら、比較条件を混同しません。

URL:

https://kameusagiyahoo.github.io/game_music/debug/audio-qa/

### v37 implementation

新規module:

```text
src/music-qa-route-baseline-registry.js
```

主なAPI:

```js
getQaRouteMatrixBaselineEligibility()
getQaRouteMatrixBaselineCompatibility()
saveQaRouteMatrixBaseline()
listQaRouteMatrixBaselines()
loadQaRouteMatrixBaseline()
loadLatestQaRouteMatrixBaseline()
deleteQaRouteMatrixBaseline()
clearQaRouteMatrixBaselines()
```

CI:

```text
tools/check_music_qa_route_baseline_registry.mjs
```

仮想Device Reportで以下を検証します。

- safe 12/12 Matrix -> eligible
- incomplete 11/12 -> BLOCK
- Coverage 90%未満 -> BLOCK
- compact storageでSamples / Events除去
- same contract -> EXACT
- Pack version change -> REVIEW
- Audio Format mismatch -> INCOMPATIBLE
- Sample Rate mismatch -> INCOMPATIBLE
- Mastering mismatch -> INCOMPATIBLE
- Crossfade Curve mismatch -> INCOMPATIBLE
- Start Pack mismatch -> INCOMPATIBLE
- 6件履歴保持
- latest / start-Pack別latest
- load / delete / clear
- corrupted localStorage fail closed

Facade / Audio Engine API自体は変更していないため、Facade API versionは引き続き `1.5.0` です。

### v38 — Pack Device Baseline History / Version Switch

v34〜v36のPack単体Device Baselineを、最新1件だけではなくPackごとの履歴として保持するように拡張しました。

Route Matrix Baselineはv37ですでに最大6件の履歴を持っていました。v38でStandard 60sのPack Baselineも同じ運用へ揃えています。

```text
Pack Device Baseline
per Pack

Pulse
├─ #1 latest
├─ #2
├─ #3
├─ #4
├─ #5
└─ #6 oldest retained

Fantasy
└─ independent history

Neon
└─ independent history

Clockwork
└─ independent history
```

各Packの履歴上限は6件です。

7件目を保存すると、そのPackの最古1件だけを削除します。他Packの履歴には影響しません。

### Storage migration

localStorage keyは互換性のため変更していません。

```text
game-music-qa-pack-baselines-v1
```

内部schemaのみ、

```text
1.0.0
  baselines: {
    pulse: entry
  }

        ↓ automatic read migration

2.0.0
  histories: {
    pulse: [entry, entry, ...]
  }
```

へ更新しています。

旧v34〜v37で保存された1件Baselineは、v38で自動的に「履歴1件目」として読み込まれます。

旧データを明示的に削除したり、手動で再保存する必要はありません。次回保存時にv2 schemaで永続化されます。

### Backward-compatible API

既存API:

```js
loadQaPackBaseline("pulse")
```

は引き続き利用でき、履歴の最新1件を返します。

v38追加API:

```js
listQaPackBaselineHistory(packId)
loadQaPackBaseline(packId, { id })
loadQaPackBaselineEntry(id)
deleteQaPackBaselineEntry(id)
```

既存の、

```js
deleteQaPackBaseline(packId)
```

はPackの履歴全体を削除するAPIとして維持しています。

履歴管理module:

```text
src/music-qa-baseline-registry.js
```

### Audio QA workflow

Audio QA DashboardのPack Device Baseline欄は、

```text
SAVE PACK BASELINE
SHARE SELECTED
DELETE SELECTED
CLEAR PACK HISTORY

History
#1
#2
...
#6
```

になりました。

各履歴行には、

- Pack version
- 保存日時
- Mastering Profile
- Sampling Coverage
- Audio Format
- AudioContext Sample Rate

を表示します。

履歴行をタップすると、そのBaselineへ切り替えて既存のDevice Contract Gateを適用します。

```text
Select history
      |
      v
Device Contract Gate
      |
      +-- EXACT
      +-- REVIEW
      +-- INCOMPATIBLE
      |
      v
Regression Compare
```

Pack versionのみ異なる履歴はv36と同様にREVIEWとして比較可能です。

M4A / OGG、48 kHz / 44.1 kHz、Mastering Profile、Scenario条件が違う履歴はINCOMPATIBLEとして数値Regression比較をブロックします。

### Automatic latest selection

QA Packを切り替えると、そのPackの最新履歴を自動選択します。

```text
QA PACK = NEON
      |
      v
latest Neon Device Baseline

QA PACK = FANTASY
      |
      v
latest Fantasy Device Baseline
```

古い履歴を確認したい場合だけ、履歴カードから明示的に選びます。

選択1件を削除した場合、比較中BaselineがSaved Deviceだったときは次に新しい履歴へ自動的に移ります。

FILE / CURRENT SESSIONを比較中の場合は、履歴を削除しても現在の比較対象を勝手に変更しません。

### v38 CI

`tools/check_music_qa_baseline_registry.mjs` を履歴仕様へ拡張しました。

検証:

- Standard 60s eligibility
- Device Contract EXACT / REVIEW / INCOMPATIBLE
- legacy schema 1.0.0 -> history migration
- migration後のv2永続化
- 同一Packを7回保存 -> 6件保持
- 最古entry eviction
- latest自動load
- ID指定load
- global entry ID lookup
- Packごとの履歴分離
- selected-entry delete
- Pack history delete
- compact storage
- corrupted localStorage fail closed

Route Matrixのv37履歴とは保存領域とScenario contractを分離したままです。

```text
Pack Standard History
game-music-qa-pack-baselines-v1

Route Matrix History
game-music-qa-route-matrix-baselines-v1
```

Facade / Audio Engine API自体は変更していないため、Facade API versionは引き続き `1.5.0` です。
