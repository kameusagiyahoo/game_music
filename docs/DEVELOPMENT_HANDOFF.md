# Development Handoff

このファイルは、別のChatGPT/Codexチャットからでも `kameusagiyahoo/game_music` の開発を即座に継続できるようにするための引き継ぎ情報です。

## 最初に読むもの

1. `docs/DEVELOPMENT_HANDOFF.md`
2. `README.md`
3. `docs/architecture.md`
4. `docs/qa.md`
5. 現在openなPull Request

GitHubをSource of Truthとして扱い、過去チャットの記憶だけで状態を推測しないでください。

## Repository

- Full name: `kameusagiyahoo/game_music`
- Default branch: `main`
- Hosting: GitHub Pages
- Production engine: `wav-stem`
- Music Facade API: `1.5.0`
- Music Pack schema: `1.3.0`
- Real Audio Packs: 4
- Production game count: 7
- Development game count: 8 (`Vector Pact` is on PR #14)

## Development cadence

ユーザーが「次お願いします」「お願いします」「続けて」と言った場合は、原則として1つの実装・安定化タスクを完了してください。

1. branch / PR / head SHAをGitHubから確認
2. 実装
3. 必要な自動テスト追加
4. Music Architecture Check確認
5. Browser Smoke WebKit確認
6. PR説明とこのhandoffを更新
7. mainへはユーザーの明示または文脈上の承認までmergeしない

## Production baseline

Game 07 `Sync Circuit` はPR #13からmainへmerge済みです。

- Merge commit: `f0da189db631a39cb004bb02469c1b28330d9e00`
- URL: https://kameusagiyahoo.github.io/game_music/games/sync-circuit/
- Main Architecture / WebKit / Pages: SUCCESS

Production games:

1. Mystic Match — `/`
2. Orbit Rush — `/games/orbit-rush/`
3. Pulse Forge — `/games/pulse-forge/`
4. Rune Relay — `/games/rune-relay/`
5. Aether Shift — `/games/aether-shift/`
6. Beat Claim — `/games/beat-claim/`
7. Sync Circuit — `/games/sync-circuit/`

Default Packs:

- Mystic Match -> fantasy
- Orbit Rush -> neon
- Pulse Forge -> pulse
- Rune Relay -> fantasy
- Aether Shift -> clockwork
- Beat Claim -> pulse
- Sync Circuit -> clockwork

## Current open work — PR #14

### Game 08: Vector Pact

- PR: https://github.com/kameusagiyahoo/game_music/pull/14
- Branch: `feature/game-08-vector-pact`
- Base: `main`
- Status: OPEN / mergeable
- Do not merge until user authorizes it.

Core playable loop is implemented.

Rules:

- 2–4 local players on one shared device
- 8 rounds
- each player secretly chooses `LEFT / CENTER / RIGHT`
- choices remain `LOCKED` until every active player selected
- odd rounds: `MATCH` — any direction shared by at least two players scores +2 for those players
- even rounds: `SPLIT` — a player alone on a direction scores +3
- highest total after round 8 wins; draws supported

Music integration:

- default Pack: Neon Orbit WAV
- MATCH -> `build` + `fill`
- SPLIT -> `tension` + `whoosh`
- end -> `result` + outcome stinger
- all access through `MusicFacade`
- shared audio controls through `bindGameAudioControls`

Main files:

- `games/vector-pact/index.html`
- `games/vector-pact/styles.css`
- `games/vector-pact/game.js`
- `games/vector-pact/vector-engine.js`
- `tests/browser/vector-pact.spec.mjs`

Registry/test integration:

- `GAME_IDS.VECTOR_PACT = "vector-pact"`
- default Pack -> `neon`
- global WebKit smoke suite updated from 7 to 8 registered games
- shared audio-controls check includes Vector Pact

Validation on the core implementation head before this handoff update:

- Music Architecture Check: SUCCESS
- Browser Smoke WebKit: SUCCESS
- PR #14: mergeable

Because this handoff edit changes the PR head, re-check the latest PR-head CI before reporting final green status.

## Current next task

**Vector Pact integration / discoverability.**

Do this next:

1. confirm PR #14 latest head and CI
2. add `08 Pact` navigation from the existing seven game pages/root
3. update README from 7 games to 8 games and add Vector Pact row/URL
4. update `docs/architecture.md` default Pack mapping with Vector Pact -> neon if not already present
5. ensure navigation remains usable on iPhone width
6. update WebKit coverage if navigation assertions are appropriate
7. run Architecture + WebKit to green
8. update PR #14 body and this handoff

After that, the next likely step is user-authorized merge of PR #14 and GitHub Pages verification.

## Production architecture

```text
Game
 ↓
MusicFacade
 ↓
Music Asset Resolver
 ↓
Music Registry / Manifest
 ↓
Music Format Resolver
 ↓
WavStemMusicManager
 ↓
Web Audio API
```

Important constraints:

- iPhone Safari/WebKit is a primary target
- shared-device multiplayer must remain touch-friendly
- volume 0 must work
- persistent audio cache ownership stays app-side
- Service Worker remains pass-through compatibility only
- do not restore procedural music engine to production
- avoid duplicate Pack-specific audio workflows
- static GitHub Pages; normal build step is unnecessary

## New-chat prompt

```text
GitHubの `kameusagiyahoo/game_music` を確認してください。
まず `docs/DEVELOPMENT_HANDOFF.md` を読んでください。
その後、現在openなPRと最新CI状態をGitHubから再確認し、Current next taskをそのまま実行してください。
mainへのmergeは私が指示するまでしないでください。
```
