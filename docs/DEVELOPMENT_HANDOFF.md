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

## Current open work — PR #14

### Game 08: Vector Pact

- PR: https://github.com/kameusagiyahoo/game_music/pull/14
- Branch: `feature/game-08-vector-pact`
- Base: `main`
- Status: OPEN / mergeable
- Do not merge until user authorizes it.

Rules:

- 2–4 local players on one shared device
- 8 rounds
- each player secretly chooses `LEFT / CENTER / RIGHT`
- choices remain `LOCKED` until every active player selected
- odd rounds: `MATCH` — any direction shared by at least two players scores +2
- even rounds: `SPLIT` — a unique direction scores +3
- highest total after round 8 wins; draws supported

Music integration:

- default Pack: Neon Orbit WAV
- MATCH -> `build` + `fill`
- SPLIT -> `tension` + `whoosh`
- result -> `result` + outcome stinger
- all access through `MusicFacade`
- shared controls through `bindGameAudioControls`

Integration/discoverability is complete on the feature branch:

- all seven existing game pages/root link to `08 Pact`
- Vector Pact has current `08 Vector` navigation state
- README documents 8 games and Vector Pact URL
- `docs/architecture.md` maps Vector Pact -> neon and documents its MATCH/SPLIT audio intent
- shared `.game-nav` now wraps on narrow screens instead of overflowing horizontally
- WebKit test checks all eight pages at the iPhone profile, verifies the Pact entry is visible, and asserts nav/document width does not exceed the viewport

Main files:

- `games/vector-pact/index.html`
- `games/vector-pact/styles.css`
- `games/vector-pact/game.js`
- `games/vector-pact/vector-engine.js`
- `tests/browser/vector-pact.spec.mjs`

## Current validation state

The core Game 08 implementation was previously green on both:

- Music Architecture Check: SUCCESS
- Browser Smoke WebKit: SUCCESS

The integration/navigation task changes the branch head, so always re-check the latest PR-head Architecture and WebKit runs before reporting final merge readiness.

## Current next task

1. fetch PR #14 latest head
2. confirm latest Music Architecture Check SUCCESS
3. confirm latest Browser Smoke WebKit SUCCESS, including the new iPhone navigation-width assertion
4. update PR #14 body with integration/navigation validation
5. report merge readiness
6. do not merge until the user authorizes it

After user authorization, squash-merge PR #14, then verify `main` Architecture / WebKit / GitHub Pages and the production URL:

`https://kameusagiyahoo.github.io/game_music/games/vector-pact/`

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
