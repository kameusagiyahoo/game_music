# Development Handoff

このファイルは、別のChatGPT/Codexチャットからでも `kameusagiyahoo/game_music` の開発を即座に継続できるようにするための引き継ぎ情報です。

## 最初に読むもの

新しいチャットでは、まず以下を確認してください。

1. `docs/DEVELOPMENT_HANDOFF.md`
2. `README.md`
3. `docs/architecture.md`
4. `docs/qa.md`
5. 現在openなPull Request

GitHubをSource of Truthとして扱います。過去チャットの記憶だけで実装状況を推測しないでください。

## Repository

- Full name: `kameusagiyahoo/game_music`
- Default branch: `main`
- Hosting: GitHub Pages
- Production engine: `wav-stem`
- Music Facade API: `1.5.0`
- Music Pack schema: `1.3.0`
- Real Audio Packs: 4
- Current game count: 7

## Development cadence

ユーザーが「次お願いします」「お願いします」「続けて」と言った場合は、原則として1つの実装・安定化タスクを完了してください。

各タスクでは以下を行います。

1. 現在のbranch/PR/head SHAを確認
2. 実装
3. 必要な自動テスト追加
4. Music Architecture Check確認
5. Browser Smoke WebKit確認
6. PR説明を最新状態へ更新
7. mainへは明示または文脈上の承認があるまでマージしない

## Current open work

### PR #13 — Add Game 07 Sync Circuit

- URL: https://github.com/kameusagiyahoo/game_music/pull/13
- Branch: `feature/game-07-sync-circuit`
- Base: `main`
- Status: OPEN
- Merge policy: CI greenを確認後も、ユーザーの明示/文脈上の承認までmergeしない

### Game 07: Sync Circuit

2〜4人・同一端末で遊ぶ協力型ゲーム。

基本ルール:

- 42秒
- TEAM STABILITYは72から開始
- 0になると即敗北
- 42秒耐えると全員勝利
- 通常SYNC成功: +5 + combo bonus
- CHORD成功: +8 + combo bonus
- MISS: unresolved target 1人につき -12
- WRONG TAP: -6 + combo reset
- 最後10秒はOVERLOAD

協力要素:

- `RESCUE`: 見逃し後260ms、別プレイヤーが救援可能
- `LINK ROLE`: 4パルスごとに交代。LINK RESCUEは追加 +3 STABILITY
- `ALL SYNC`: 6パルスごと。参加中全プレイヤー必須。base gain +12

Adaptive Difficulty:

- `ASSIST`: timing window ×1.18
- `BALANCED`: ×1.00
- `INTENSE`: ×0.84
- 直近6パルス、STABILITY、成功率、RESCUE依存を使って判定
- 新規試合のevent 1でAdaptive履歴をreset

Adaptive UI:

- 画面上に現在の `ASSIST / BALANCED / INTENSE` を常時表示
- window scaleも表示
- profile切替時に `DIFFICULTY SHIFT` フラッシュを表示
- `body[data-adaptive-difficulty]` で状態別スタイル

主要ファイル:

- `games/sync-circuit/index.html`
- `games/sync-circuit/styles.css`
- `games/sync-circuit/game.js`
- `games/sync-circuit/sync-engine.js`
- `games/sync-circuit/coop-mechanics.js`
- `games/sync-circuit/coop.css`
- `games/sync-circuit/adaptive-ui.js`
- `tests/browser/sync-circuit-coop.spec.mjs`
- `tests/browser/sync-circuit-adaptive.spec.mjs`
- `tests/browser/sync-circuit-adaptive-ui.spec.mjs`

## Current validation state

Adaptive UI追加前の最新安定状態では:

- Music Architecture Check: SUCCESS
- Browser Smoke WebKit: SUCCESS

Adaptive UI追加後の最新headでは、ArchitectureはSUCCESS済み。WebKitは最新runの完了状態を必ずGitHub Actionsで再確認してください。

最新headはこのファイルを書いた後に変わる可能性があるため、SHAを固定値として信用せずPR #13から取得してください。

## Existing games

1. Mystic Match — root `/`
2. Orbit Rush — `/games/orbit-rush/`
3. Pulse Forge — `/games/pulse-forge/`
4. Rune Relay — `/games/rune-relay/`
5. Aether Shift — `/games/aether-shift/`
6. Beat Claim — `/games/beat-claim/`
7. Sync Circuit — `/games/sync-circuit/` (PR #13, not yet on main)

Default Pack mapping:

- Mystic Match -> fantasy
- Orbit Rush -> neon
- Pulse Forge -> pulse
- Rune Relay -> fantasy
- Aether Shift -> clockwork
- Beat Claim -> pulse
- Sync Circuit -> clockwork

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

ゲームコードからMusic Managerを直接操作しないでください。`MusicFacade` を境界にします。

## Important constraints

- iPhone Safari/WebKitを主要ターゲットとして扱う
- shared-device multiplayerではmulti-touch公平性を考慮する
- volume 0を正しく許可する
- persistent audio cache ownershipはapp側
- Service Workerはpass-through compatibility用途
- procedural music engineをproduction runtimeへ戻さない
- audio workflowをPack別に重複させない
- static GitHub Pages前提。通常build不要

## Main CI

- `.github/workflows/music-architecture-check.yml`
- `.github/workflows/browser-smoke-webkit.yml`
- `.github/workflows/audio-format-parity.yml`
- GitHub Pages deployment

WebKitはPlaywrightのiPhone 15 profileを使用します。

## Current next task

直前の作業はSync CircuitのAdaptive Difficulty UI追加です。

次に行うこと:

1. PR #13の最新headを取得
2. Music Architecture CheckがSUCCESSか確認
3. Browser Smoke WebKitの最新runを確認
4. Adaptive UI専用テスト `sync-circuit-adaptive-ui.spec.mjs` が通っていることを確認
5. PR #13 bodyへAdaptive UIのValidationを追記
6. CI greenならユーザーへ報告

その次の候補:

- Adaptive profile変更にMusicFacadeのlayer/state変化を連動
- Sync Circuitの結果画面に難易度推移統計を追加
- PR #13をmainへmergeしてPages公開確認

ユーザーが「次お願いします」と言った場合は、上記のCurrent next taskから再開してください。

## New-chat prompt

新しいチャットでユーザーが最短で継続したい場合は、以下だけでも開始できます。

```text
GitHubの `kameusagiyahoo/game_music` を確認してください。
まず `docs/DEVELOPMENT_HANDOFF.md` を読んで、現在openなPRとCI状態をGitHubから再確認し、Current next taskをそのまま実行してください。
mainへのmergeは私が指示するまでしないでください。
```
