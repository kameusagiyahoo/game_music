# Music Pack Specification

## Versions

- Manifest schema: **1.3.0**
- Required Facade API: **1.5.0**
- Production engine: **wav-stem**

Definitions live in `src/music-pack-manifest.js`.

## Current Registry

| id | Name | Version | BPM | Mastering profile |
| --- | --- | --- | ---: | --- |
| `fantasy` | Fantasy Table WAV | 2.0.0 | 108 | fantasy-gentle-v1 |
| `neon` | Neon Orbit WAV | 2.0.0 | 132 | neon-drive-v1 |
| `pulse` | Pulse Forge WAV | 1.4.1 | 112 | game-balanced-v1 |
| `clockwork` | Clockwork Grove WAV | 2.0.0 | 108 | clockwork-balanced-v1 |

Registry source: `src/music-registry.js`.

## Manifest contract

A Manifest is created with `defineMusicPackManifest()`.

Required non-empty string fields:

- `id`
- `name`
- `shortName`
- `description`
- `engine`
- `version`
- `schemaVersion`

Other important fields:

- `facadeApi`
- `states`
- `stems`
- `stingers`
- `transitionCues`
- `formats`
- `masteringProfile`
- `tags`

`version` and `schemaVersion` must be SemVer.

When a Pack object is supplied to validation, declared states, stems, stingers, transition cues, formats and mastering profile must match the Pack implementation.

## Standard asset model

Each current Pack uses:

```text
5 stems
├── drums
├── bass
├── chords
├── melody
└── sparkle

2 stingers
├── victory
└── gameover

4 transition cues
├── fill
├── whoosh
├── riser
└── impact
```

Each asset family is available in:

- M4A / AAC
- OGG / Vorbis
- WAV

Current source profile is 44.1 kHz stereo.

## Directory layout

```text
assets/
├── stems/<pack>/
├── stingers/<pack>/
└── transitions/<pack>/
```

A complete current Pack contains 11 logical audio assets x 3 formats = 33 files.

## Pack module

A Pack module is placed under:

```text
src/music-packs/<pack>.js
```

It defines the runtime Pack object and exports its Manifest.

Typical Pack-level sections:

- `id`, `name`
- `defaultLayerPreset`
- `mastering`
- `audioStems`
- `stingers`
- `transitionCues`
- `layerPresets`
- `modes`
- Manifest metadata

## States and layer presets

The common Facade expects Pack support for the current common state model:

```text
normal
build
overdrive
result
```

Layer presets are normally:

```text
focus
build
overdrive
result
```

Game intent `tension` maps to Pack mode/preset `overdrive`.

## Format maps

Each audio family may declare per-format file maps:

```js
formats: {
  m4a: { mime: "...", files: {...} },
  ogg: { mime: "...", files: {...} },
  wav: { mime: "audio/wav", files: {...} },
}
```

The runtime versions these URLs with:

```text
?gmv=<manifest version>
```

The Format Resolver then selects candidates and runtime decode fallback can try the next format.

## Global and game-local Pack selection

Global Settings key:

```text
game-music-global-settings-v1
```

Current settings include:

- `wavStemPackId`
- `wavStemSelectionVersion`
- `bgmEnabled`
- `sfxEnabled`
- `bgmVolume`
- `sfxVolume`

`wavStemPackId: "auto"` resolves to the game's default Pack.

Historical `proceduralPackId` values are accepted only as migration input for old Neon/Clockwork preferences. They are not part of normalized current settings.

## Adding a new Pack

Recommended sequence:

1. create `src/music-packs/<pack>.js`
2. create 5 stem sources
3. create victory/gameover Stingers
4. create four transition cues
5. generate M4A / OGG / WAV variants
6. define mastering targets
7. define Manifest
8. register the Pack in `src/music-registry.js`
9. add/update game default only if needed
10. add Pack-specific audio profile / mastering / parity / Golden QA data
11. run Music Architecture Check
12. run Audio Format Parity
13. verify Browser Smoke WebKit
14. verify on a physical target device before treating a Device Baseline as authoritative

## Generation workflow

Pack-specific Python and shell scripts remain independent because musical generation logic differs by Pack.

CI orchestration is shared:

```text
.github/workflows/generate-audio.yml
```

The workflow detects affected Packs and runs a matrix. Generation jobs use `max-parallel: 1` because successful jobs may commit generated assets back to `main`.

## Format parity workflow

```text
.github/workflows/audio-format-parity.yml
```

The workflow detects affected Packs and runs each Pack's existing parity and parity-semantics scripts in a matrix.
