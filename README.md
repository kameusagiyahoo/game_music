# game_music

GitHub Pagesだけでゲーム制作と、再利用可能なAdaptive Music基盤を検証するプロジェクトです。

現在のProduction Music Engineは **WAV Stemのみ**です。4つのReal Audio Packを6ゲームから共通の `MusicFacade` 経由で利用します。

- Music Pack schema: **1.3.0**
- Music Facade API: **1.5.0**
- Production engine: **wav-stem**
- Real Audio Packs: **4**
- Games: **6**
- Audio format: **M4A / OGG / WAV**
- Browser integration CI: **Playwright WebKit / iPhone 15 profile**

## Play

| Game | Type | Default Pack | URL |
| --- | --- | --- | --- |
| Mystic Match | 45秒メモリー | Fantasy Table WAV | https://kameusagiyahoo.github.io/game_music/ |
| Orbit Rush | 30秒リアクション | Neon Orbit WAV | https://kameusagiyahoo.github.io/game_music/games/orbit-rush/ |
| Pulse Forge | 40秒リズム / リアクション | Pulse Forge WAV | https://kameusagiyahoo.github.io/game_music/games/pulse-forge/ |
| Rune Relay | 45秒シーケンス記憶 | Fantasy Table WAV | https://kameusagiyahoo.github.io/game_music/games/rune-relay/ |
| Aether Shift | 4ウェーブ・リアクション | Clockwork Grove WAV | https://kameusagiyahoo.github.io/game_music/games/aether-shift/ |
| Beat Claim | 2〜4人ローカル早押し | Pulse Forge WAV | https://kameusagiyahoo.github.io/game_music/games/beat-claim/ |

Music Settings:

https://kameusagiyahoo.github.io/game_music/settings/music/

Debug:

- Resolver Lab: https://kameusagiyahoo.github.io/game_music/debug/resolver/
- Mixer: https://kameusagiyahoo.github.io/game_music/debug/mixer/
- Audio QA: https://kameusagiyahoo.github.io/game_music/debug/audio-qa/

## Current architecture

```text
Game
  |
  v
MusicFacade
  |
  v
Music Asset Resolver
  |
  +--> Music Registry / Manifest
  |
  +--> Music Format Resolver
  |       M4A -> OGG -> WAV fallback
  |
  v
WavStemMusicManager
  |
  +--> 5 synchronized stems
  +--> stingers
  +--> transition cues
  +--> mastering / limiter
  +--> realtime meter
  |
  v
Web Audio API
```

ゲーム側はManagerを直接操作しません。`createMusicFacade()` を境界として、共通State・Pack切替・音量・Stingerなどを扱います。

主要Facade API:

```text
start(state, options)
state(name, options)
cue(name)
outcome(value, options)
transitionCue(name, options)
preload(options)
audio(settings)
layer(preset, options)
pack(packId, options)
cancel(kind)
meter()
info()
stop()
```

詳細: [docs/architecture.md](docs/architecture.md)

## Music Packs

現在のRegistryは4 Packすべて `wav-stem` です。

| Pack | Version | BPM | Mastering |
| --- | --- | ---: | --- |
| Fantasy Table WAV | 2.0.0 | 108 | fantasy-gentle-v1 |
| Neon Orbit WAV | 2.0.0 | 132 | neon-drive-v1 |
| Pulse Forge WAV | 1.4.1 | 112 | game-balanced-v1 |
| Clockwork Grove WAV | 2.0.0 | 108 | clockwork-balanced-v1 |

各Packは原則として以下を持ちます。

```text
5 stems
  drums / bass / chords / melody / sparkle

2 stingers
  victory / gameover

4 transition cues
  fill / whoosh / riser / impact

x 3 formats
  m4a / ogg / wav
```

詳細: [docs/music-pack-spec.md](docs/music-pack-spec.md)

## Settings policy

Global Music Settingsは全ゲームの**既定値**です。

- BGM ON/OFF
- SE ON/OFF
- BGM volume
- SE volume
- default WAV Pack

Rune Relay / Aether Shiftでゲーム内Packを選んだ場合は、そのゲームだけのlocal overrideとして保存します。ゲーム内Pack変更からGlobal Pack設定を書き換えません。

共通のBGM/SE UI処理は `src/game-audio-controls.js` に集約されています。

## Audio cache

永続音声キャッシュの所有者は `src/audio-asset-cache.js` です。

```text
Memory Map
   |
Cache API (persistent)
   |
Network
```

`music-sw.js` は既存インストール済みService Workerを安全に更新するためのpass-through compatibility workerです。音声fetchのinterceptやCache APIへの二重writeは行いません。

## QA / CI

主な自動検証:

- Music Facade boundary
- JavaScript syntax auto-discovery
- Manifest / Format Resolver
- Runtime decode fallback
- preload / persistent cache
- cache ownership
- volume controls
- Result / Stinger scheduling sync
- game-local Pack policy
- shared game audio controls
- Beat / Bar quantization
- Pack Hot Swap / equal-power crossfade
- transition cues
- mastering / realtime meter
- Golden QA / Device Baseline / Route Matrix
- Playwright WebKit smoke test
- cross-format parity

Audio生成とFormat ParityはPack別workflowを重複させず、matrix workflowへ統合されています。

- `.github/workflows/generate-audio.yml`
- `.github/workflows/audio-format-parity.yml`
- `.github/workflows/music-architecture-check.yml`
- `.github/workflows/browser-smoke-webkit.yml`

詳細: [docs/qa.md](docs/qa.md)

## Local run

Static siteなのでbuildは不要です。

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

ブラウザ:

```text
http://127.0.0.1:4173/
```

WebKit smoke test:

```bash
npm install
npx playwright install webkit
npm run test:browser
```

## Repository structure

```text
index.html
src/
├── game.js
├── game-audio-controls.js
├── music-facade.js
├── music-asset-resolver.js
├── music-format-resolver.js
├── music-registry.js
├── music-pack-manifest.js
├── wav-stem-manager.js
├── audio-asset-cache.js
├── music-service-worker.js
├── music-qa-*.js
└── music-packs/
games/
├── orbit-rush/
├── pulse-forge/
├── rune-relay/
├── aether-shift/
└── beat-claim/
settings/music/
debug/
├── mixer/
├── resolver/
└── audio-qa/
assets/
├── stems/
├── stingers/
└── transitions/
qa/baselines/
tests/browser/
tools/
docs/
├── architecture.md
├── music-pack-spec.md
├── qa.md
└── history/
    └── music-engine-v1-v38.md
```

Legacy Procedural MusicManagerはProductionの `src/` には存在しません。互換回帰用fixtureのみ `tools/fixtures/` に隔離されています。

## Documentation

- [Architecture](docs/architecture.md)
- [Music Pack specification](docs/music-pack-spec.md)
- [QA / CI](docs/qa.md)
- [Music Engine v1-v38 history](docs/history/music-engine-v1-v38.md)
