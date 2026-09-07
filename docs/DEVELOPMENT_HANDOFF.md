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
- Current production game count: 7

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

## Current production baseline

### Game 07: Sync Circuit — MERGED

PR #13 `Add Game 07 Sync Circuit` は `main` へsquash merge済みです。

- Merge commit: `f0da189db631a39cb004bb02469c1b28330d9e00`
- Production URL: https://kameusagiyahoo.github.io/game_music/games/sync-circuit/
- Main Music Architecture Check: SUCCESS
- Main Browser Smoke WebKit: SUCCESS
- GitHub Pages build and deployment: SUCCESS

Game 07は2〜4人・同一端末で遊ぶ協力型ゲームです。

主要要素:

- 42秒 / TEAM STABILITY 72開始
- 通常SYNC / CHORD
- `RESCUE`: 見逃し後260msに別プレイヤーが救援
- `LINK ROLE`: 4パルスごとに交代、LINK RESCUEは+3
- `ALL SYNC`: 6パルスごと、全員参加
- 最後10秒 `OVERLOAD`
- Adaptive Difficulty: `ASSIST / BALANCED / INTENSE`
- Adaptive UI: 現在profile・window scale・DIFFICULTY SHIFT表示

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

## Existing production games

1. Mystic Match — `/`
2. Orbit Rush — `/games/orbit-rush/`
3. Pulse Forge — `/games/pulse-forge/`
4. Rune Relay — `/games/rune-relay/`
5. Aether Shift — `/games/aether-shift/`
6. Beat Claim — `/games/beat-claim/`
7. Sync Circuit — `/games/sync-circuit/`

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

## Current next task — Game 08

Game 07はproductionへ到達したため、次はGame 08を新規開発します。

Game 08の方針:

- Game 06の競争型、Game 07の協力型と被らない
- 2〜4人で遊べる
- ルールは短時間で理解できる
- shared-device / iPhoneで操作しやすい
- MusicFacadeの別の使い方を実践できる
- 単純な早押しゲームにはしない

初期コンセプト: **Vector Pact**

- 2〜4人の同時選択・読み合いゲーム
- 各ラウンドで全員が `LEFT / CENTER / RIGHT` の3方向から選ぶ
- 同じ方向に集中するとCLASH、少数派または単独選択にボーナス
- 特殊ラウンドで `MATCH`（誰かと合わせる）と `SPLIT`（被らない）が切り替わる
- 反射神経より読み合い・相談・裏切りの軽いパーティー性を重視
- Music state / transition cueをラウンドルール切替と同期させる

最初の実装タスク:

1. `feature/game-08-vector-pact` を最新mainから作成
2. 基本ルールエンジンを純粋関数で実装
3. 2〜4人shared-device UIを追加
4. Music RegistryへGame 08を登録
5. 8ゲームnavigation / README更新
6. WebKitテスト追加
7. PRを作成
8. CI greenまで確認

ユーザーが「次お願いします」「お願いします」と言った場合は、上記Game 08の実装から継続してください。

## New-chat prompt

```text
GitHubの `kameusagiyahoo/game_music` を確認してください。
まず `docs/DEVELOPMENT_HANDOFF.md` を読んでください。
その後、現在openなPRと最新CI状態をGitHubから再確認し、Current next taskをそのまま実行してください。
mainへのmergeは私が指示するまでしないでください。
```
