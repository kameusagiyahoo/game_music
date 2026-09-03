# Architecture

## Purpose

`game_music` は、複数ゲームで同じAdaptive Music基盤を共有するStatic Web Appです。Production runtimeはWAV Stem Engineへ一本化されており、ゲームコードからAudio Engine実装を直接触らないことを設計上の境界にしています。

## Runtime stack

```text
Game
 |
 | common intent
 | normal / build / tension / result
 v
MusicFacade
 |
 +--> Music Registry
 |      pack metadata / default selection
 |
 +--> Music Asset Resolver
 |      pack -> runtime
 |
 +--> Music Format Resolver
 |      browser support + runtime decode fallback
 |
 v
WavStemMusicManager
 |
 +--> Web Audio transport
 +--> synchronized stem buses
 +--> stinger bus
 +--> transition cue bus
 +--> SFX bus
 +--> mastering / limiter
 +--> analyser / realtime meter
 |
 v
AudioContext
```

## Production boundary

Game entry files are:

- `src/game.js`
- `games/**/game.js`

They must create music through `createMusicFacade()`. `tools/check_music_boundary.py` discovers these files automatically and rejects direct Manager usage.

The Production engine registry contains only:

```text
wav-stem
```

The former Procedural MusicManager is isolated at:

```text
tools/fixtures/legacy-procedural-music-manager.js
```

It is available only for compatibility regression checks.

## MusicFacade

Current Facade API version: **1.5.0**.

Primary methods:

| API | Role |
| --- | --- |
| `start(state, options)` | start playback |
| `state(name, options)` | apply common game state |
| `cue(name)` | fire SFX cue |
| `outcome(value, options)` | victory / gameover result |
| `transitionCue(name, options)` | explicit transition audio |
| `preload(options)` | preload Pack assets |
| `audio(settings)` | BGM/SE enable and volume |
| `layer(preset, options)` | explicit layer preset |
| `pack(packId, options)` | same-engine Pack switch |
| `cancel(kind)` | cancel pending transition / Pack |
| `meter()` | realtime meter snapshot |
| `info()` | runtime descriptor |
| `stop()` | stop runtime |

## Common state mapping

Games send common intent rather than engine-specific controls.

```text
normal  -> mode normal    + preset focus
build   -> mode build     + preset build
tension -> mode overdrive + preset overdrive
result  -> mode result    + preset result
```

This lets individual games remain independent of stem gain details.

## Result / Stinger synchronization

`MusicFacade` holds an in-flight `state("result")` promise. When `outcome()` follows immediately, it inherits the exact `scheduledAt` and quantize mode from Result state scheduling.

This prevents a Result layer transition and victory/gameover Stinger from landing on different bar boundaries when game code does not await the first call.

## Pack resolution

Default Pack mapping:

| Game | Pack |
| --- | --- |
| Mystic Match | fantasy |
| Orbit Rush | neon |
| Pulse Forge | pulse |
| Rune Relay | fantasy |
| Aether Shift | clockwork |
| Beat Claim | pulse |

Global Settings can override the default Pack. Rune Relay and Aether Shift additionally support game-local Pack selection. Local selection takes priority for that game without mutating the Global Pack preference.

## Pack Hot Swap

`WavStemMusicManager.switchPack()` performs same-`AudioContext` Pack switching.

Core behavior:

1. preload/decode next Pack
2. calculate Beat/Bar boundary
3. start next Pack sources at the scheduled AudioContext time
4. crossfade old/new Pack gains
5. preserve the active game state
6. stop old sources after transition

Equal-power crossfade is supported and covered by CI.

## Shared game audio controls

`src/game-audio-controls.js` owns common game UI behavior for:

- master sound button
- BGM toggle
- SE toggle
- BGM volume
- SE volume
- Global Settings persistence
- `MusicFacade.audio()` application

It accepts `getMusic: () => music`, so games that replace their current Facade reference can reuse the same binding.

## Audio format resolution

All current Packs contain:

```text
M4A / OGG / WAV
```

The Format Resolver chooses a browser-supported candidate. Runtime decode fallback can advance to the next candidate if decoding fails.

Pack asset URLs include `?gmv=<pack-version>`, allowing version-aware persistent cache behavior.

## Cache ownership

Application code owns all audio caching.

```text
getAudioBytes()
 |
 +--> in-memory Map
 |
 +--> Cache API
 |      game-music-audio-v15
 |      version pruning by gmv
 |
 +--> network fetch
```

`music-sw.js` intentionally has no fetch handler. It remains registered only as a compatibility worker so clients with older Service Worker versions can upgrade without retaining the old double-cache path.

## Audio transport

`WavStemMusicManager` schedules audio using `AudioContext.currentTime`.

Important timing features:

- synchronized 5-stem start
- Beat / Bar quantization
- scheduled state transitions
- scheduled Stingers
- transition cues
- quantized Pack switching
- ducking around Stingers

A lightweight clock is still used for transport/UI callbacks, while audio source starts and AudioParam scheduling use AudioContext time.

## Mastering

Each Pack declares its mastering profile and source targets. Runtime includes:

- master trim
- limiter
- independent music / SFX control
- Pack/stinger/transition buses
- realtime analyser

Pack-specific validation checks source audio profiles and mastering targets.

## Browser support strategy

The project remains a static GitHub Pages app. No framework or server runtime is required.

Automated browser integration uses Playwright WebKit with the iPhone 15 device profile. This is useful for WebKit regressions and mobile layout/runtime integration, but it does not replace final verification on physical iPhone Safari.

## CI auto-discovery

Music Architecture CI automatically discovers:

- `src/game.js`
- `games/**/game.js`
- JavaScript / MJS under `src`, `games`, `debug`, `settings`, `tools`
- root `music-sw.js`

New Game 06+ files therefore enter syntax and Facade-boundary checks without manually editing a hard-coded list.
