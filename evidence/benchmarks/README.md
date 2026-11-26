# Benchmark records

Add the commit, runtime, OS, corpus version, documented reproduction command, measured results, and limitations for each run. Record review rate separately and include fixture counts. Preserve machine-readable artifacts alongside concise human-readable comparisons. Keep inputs synthetic.

## Local synthetic regression run

Reproduce the [recorded JSON run](local-2026-11-24.json) with `npm run --silent eval`. The macOS Node.js v26.0.0 run covered 500 prompts across 20 families, including 250 benign prompts. It recorded 100% structured recall, 100% supported strong-secret recall, 100% mask precision, zero benign modifications or blocks, and zero raw markers in approved evaluation output. These results apply to this synthetic corpus. The account identifier rule was adjusted after the corpus surfaced a false positive, so this report measures regression coverage rather than an untouched holdout.

[Evaluation method](../../eval/README.md) · [Session PS-002](../sessions/PS-002.md)
