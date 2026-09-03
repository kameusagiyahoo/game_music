# QA and CI

## Strategy

Audio behavior has two different verification classes:

1. deterministic repository/CI checks
2. browser/device-dependent runtime checks

The project keeps both. Golden QA and Device Baselines are not replaced by ordinary unit tests because Web Audio behavior can differ by browser and hardware.

## Music Architecture Check

Workflow:

```text
.github/workflows/music-architecture-check.yml
```

This is the main deterministic regression gate.

Major coverage:

- Facade boundary
- JavaScript syntax discovery
- Manifest validation
- Format Resolver
- WAV-only Production runtime
- runtime decode fallback
- preload memory cache
- persistent Cache API
- cache ownership
- volume clamp behavior
- Result / Stinger synchronization
- global vs game-local Pack policy
- shared game audio controls
- Beat / Bar quantization
- Pack Hot Swap
- equal-power crossfade
- Hot Swap realtime QA
- transition cue engine
- mastering graph
- Pack-specific mastering
- realtime audio meter
- QA report / baseline compare
- automated QA scenario
- Route Matrix
- Device Baseline registries
- Golden QA
- source audio profiles

## Auto-discovery

`tools/check_music_boundary.py` discovers Game entry files automatically.

`tools/check_js_syntax.py` discovers JS/MJS files under the major runtime, game, debug, settings and tools directories.

This prevents Game 06+ or new check scripts from silently missing CI coverage.

## Browser Smoke WebKit

Workflow:

```text
.github/workflows/browser-smoke-webkit.yml
```

Runner:

- Playwright 1.62.1
- WebKit
- iPhone 15 device profile

Coverage includes:

- all five game pages load
- no page-level JavaScript exception
- shared BGM / SE controls render
- volume input works
- every game resolves to `wav-stem`
- Mystic Match can START and reach Result
- Rune Relay game-local Pack selection
- Aether Shift game-local Pack selection

On failure CI retains Playwright report, trace, screenshot and video.

This is a WebKit integration gate, not a claim of bit-for-bit equivalence with physical iPhone Safari.

## Audio Format Parity

Workflow:

```text
.github/workflows/audio-format-parity.yml
```

The workflow detects which Pack changed and runs a matrix over the affected Packs.

Per Pack:

1. decode/measure M4A, OGG and WAV
2. compare cross-format characteristics
3. run parity gate semantics
4. upload the Pack parity JSON report

The four old Pack-specific workflow files were consolidated into this single workflow.

## Audio generation

Workflow:

```text
.github/workflows/generate-audio.yml
```

It detects the affected Pack from generator/encoder changes and runs:

1. WAV generation
2. source profile validation
3. Pulse mastering check when applicable
4. OGG / M4A encoding
5. generated profile validation
6. cross-format parity
7. parity semantics
8. commit generated audio when changed

Multiple Pack generation is serialized to avoid simultaneous pushes to `main`.

## Golden QA

Repository Golden baselines live under:

```text
qa/baselines/
├── pulse-standard-v1.json
├── fantasy-standard-v1.json
├── neon-standard-v1.json
└── clockwork-standard-v1.json
```

Golden QA is intended for repository-controlled regression gates. Do not replace a Golden baseline merely because a run fails; first determine whether the audio behavior change is intentional.

## Device Baseline

Device Baselines represent measurements captured on a specific browser/device environment.

Standard Pack Device Baseline history:

- stored client-side
- up to six entries per Pack
- exact baseline selection supported
- delete single entry or Pack history
- compatibility checks prevent misleading comparisons

Standard Pack history and Route Matrix history are separate stores.

## Route Matrix QA

Route Matrix exercises Pack-to-Pack Hot Swap routes rather than only isolated Pack playback.

The current system covers the 12 directed routes among the four Packs.

It records route-specific metrics and supports Device Baseline regression history.

## Hot Swap QA

Hot Swap QA measures transition windows around Pack switching, including:

- before/after level behavior
- crossfade timing
- realtime meter samples
- transition event metadata
- regression comparisons

Equal-power crossfade has its own deterministic CI check.

## Persistent cache QA

Application cache ownership is intentional:

```text
src/audio-asset-cache.js
  -> memory Map
  -> Cache API
  -> gmv pruning

music-sw.js
  -> no fetch interception
  -> compatibility upgrade only
```

`tools/check_music_cache_ownership.mjs` prevents Service Worker audio caching from being reintroduced accidentally.

## Useful local commands

Run the architecture checks individually with Node/Python, or invoke the workflows in GitHub Actions.

Browser smoke locally:

```bash
npm install
npx playwright install webkit
npm run test:browser
```

Static server:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

## Real-device release check

Before treating an audio change as fully validated for iPhone:

1. pass Music Architecture Check
2. pass Audio Format Parity if audio assets changed
3. pass Browser Smoke WebKit
4. open the GitHub Pages build on the target iPhone
5. verify START after user gesture
6. verify normal/build/tension/result transitions
7. verify Stinger timing
8. verify Pack Hot Swap
9. inspect Audio QA metrics
10. save/update Device Baseline only when the change is understood and accepted
