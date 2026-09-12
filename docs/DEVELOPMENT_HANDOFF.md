# Development Handoff

このファイルは、別のChatGPT/Codexチャットや新しいセッションからでも `kameusagiyahoo/game_music` の開発を即座に継続できるようにするための引き継ぎ情報です。

## Resume protocol — 最初に必ず実行

1. `docs/DEVELOPMENT_HANDOFF.md` を読む
2. `README.md` / `docs/architecture.md` / `docs/qa.md` を必要に応じて確認
3. GitHubから `main` の最新SHAを取得する
4. openなPull RequestをGitHubから再確認する
5. 最新のArchitecture / WebKit / Pages状態を再確認する
6. このファイルの記載よりGitHubの現在状態を優先する
7. `Current next task` から開発を再開する

GitHubをSource of Truthとして扱い、過去チャットの記憶だけで状態を推測しないこと。

## Repository

- Full name: `kameusagiyahoo/game_music`
- Default branch: `main`
- Hosting: GitHub Pages
- Production engine: `wav-stem`
- Music Facade API: `1.5.0`
- Music Pack schema: `1.3.0`
- Real Audio Packs: 4
- Production game count: 8
- Last known main SHA after Game 08 merge: `b2aca6ad7d85551e325e285aa90eecd9d329891e`

The SHA above is a checkpoint, not an assumption. A new session must fetch current `main` before editing.

## Development cadence

ユーザーが「次お願いします」「お願いします」「続けて」と言った場合は、原則として1つの実装・安定化タスクを完了する。

1. branch / PR / head SHAをGitHubから確認
2. 実装
3. 必要な自動テスト追加
4. Music Architecture Check確認
5. Browser Smoke WebKit確認
6. PR説明とこのhandoffを更新
7. mainへはユーザーの明示または文脈上の承認までmergeしない
8. merge後はmain CI / Pagesを確認し、このhandoffをmain基準へ更新する

## Production baseline

Game 08 `Vector Pact` はPR #14からmainへsquash merge済み。

- Merge commit: `b2aca6ad7d85551e325e285aa90eecd9d329891e`
- Production URL: https://kameusagiyahoo.github.io/game_music/games/vector-pact/
- PR #14: merged
- Main Music Architecture Check: SUCCESS
- Main GitHub Pages build/deploy: SUCCESS
- Main Browser Smoke WebKit was still running at the last observation immediately after merge; a new session must query GitHub for its final/current state rather than assume it.

Production games:

1. Mystic Match — `/`
2. Orbit Rush — `/games/orbit-rush/`
3. Pulse Forge — `/games/pulse-forge/`
4. Rune Relay — `/games/rune-relay/`
5. Aether Shift — `/games/aether-shift/`
6. Beat Claim — `/games/beat-claim/`
7. Sync Circuit — `/games/sync-circuit/`
8. Vector Pact — `/games/vector-pact/`

## Game 08 — Vector Pact

Status: production / main.

Core rules:

- 2–4 local players on one shared device
- 8 rounds
- each player secretly chooses `LEFT / CENTER / RIGHT`
- choices remain `LOCKED` until every active player selected
- odd rounds: `MATCH` — any direction shared by at least two players scores +2
- even rounds: `SPLIT` — a unique direction scores +3
- highest total after round 8 wins; draws supported

Music:

- default Pack: Neon Orbit WAV
- MATCH -> `build` + `fill`
- SPLIT -> `tension` + `whoosh`
- result -> `result` + outcome stinger
- access through `MusicFacade`
- controls through `bindGameAudioControls`

Integration:

- all eight game pages are represented in navigation
- existing pages/root link to `08 Pact`
- shared `.game-nav` wraps on narrow screens
- README documents 8 games
- architecture maps Vector Pact -> neon
- iPhone 15 WebKit coverage checks navigation/document width

Main files:

- `games/vector-pact/index.html`
- `games/vector-pact/styles.css`
- `games/vector-pact/game.js`
- `games/vector-pact/vector-engine.js`
- `tests/browser/vector-pact.spec.mjs`

## Current open work

At this checkpoint there is no intended Game 08 feature branch work remaining. PR #14 is merged.

A new session MUST query GitHub for open PRs before deciding that there is no active work.

## Current next task

1. fetch current `main` SHA
2. query open PRs and current CI
3. confirm the final/current main Browser Smoke WebKit state after Game 08
4. if main is green, start Game 09 planning
5. create a dedicated `feature/game-09-...` branch only after selecting the Game 09 concept
6. implement one coherent task, add tests, and update this handoff
7. do not merge a future PR until user authorization

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
- preserve existing game behavior while adding new games
- keep game-specific pure logic separable/testable where practical

## New-chat prompt

```text
GitHubの `kameusagiyahoo/game_music` を確認してください。

最初に `docs/DEVELOPMENT_HANDOFF.md` を読んでください。
ただし、そこに書かれたSHA・PR・CI状態をそのまま信じず、
GitHubから現在のmain SHA、open PR、最新CIを再確認してください。

その後、Current next taskからそのまま開発を継続してください。
実装後は必要なテスト、Music Architecture Check、Browser Smoke WebKitを確認し、
PR説明とdocs/DEVELOPMENT_HANDOFF.mdも更新してください。

mainへのmergeは私が指示するまでしないでください。
```

## Handoff maintenance rule

状態が変わるたびにこのファイルも更新する。

特に以下は必須:

- PR作成時
- 大きな機能追加時
- PR merge時
- production game count変更時
- 次タスク変更時
- architecture / deployment方針変更時

これにより、会話履歴やChatGPTのセッション状態に依存せず、GitHubだけから開発を再開できる状態を維持する。
