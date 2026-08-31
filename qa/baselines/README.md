# Golden QA Baselines

This directory contains reviewed reference values for deterministic music QA.

## Pulse Standard

Baseline:

```text
qa/baselines/pulse-standard-v1.json
```

Renderer:

```text
tools/music_qa_golden.mjs
```

The renderer reads the actual repository WAV files and reconstructs the canonical
60-second Pulse QA scenario up to the pre-limiter point.

It includes:

- 5 synchronized stems
- Pulse layer presets
- Riser during BUILD
- Fill during OVERDRIVE
- Impact + Victory during RESULT
- Pack headroom trim

It intentionally does **not** emulate the browser's `DynamicsCompressorNode`.
Post-limiter behavior remains covered by the iPhone/Safari Audio QA Dashboard.

## CI policy

Normal CI always runs:

```sh
node tools/music_qa_golden.mjs --check
node tools/check_music_qa_golden.mjs
```

The Golden gate rejects, among other structural checks:

- overall peak increase greater than +0.75 dB
- stage peak increase greater than +0.75 dB
- overall RMS increase greater than +1.5 dB
- stage RMS increase greater than +1.5 dB
- pre-limiter peak above +3 dBFS
- scenario ID/version mismatch
- sample-rate mismatch
- mastering-profile mismatch
- missing or added canonical stages

A source fingerprint change by itself is a warning, not a failure. This allows
an intentional improvement to pass while still making the source change visible.

## Updating the baseline

Do not automatically rewrite the baseline in CI.

After an intentional music/mix/mastering change:

1. Run the normal Golden check and inspect the delta.
2. Verify the change on the Audio QA Dashboard, preferably with the standard
   60-second scenario and a saved v21/v22-style report.
3. If the new result is accepted, regenerate the baseline explicitly:

```sh
node tools/music_qa_golden.mjs --write
```

4. Review the JSON diff.
5. Commit the baseline update together with the intentional audio/mix change.

The baseline is therefore a reviewed contract, not a cache.
