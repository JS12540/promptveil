# Synthetic detection evaluation

Run `pnpm eval` from the repository root. The command emits a JSON report and
returns nonzero if a detector gate fails.

The deterministic corpus contains 650 synthetic prompts from 24 template
families, including 250 hard negatives. The generator varies context, format, and
synthetic values. Unit tests use separate inputs. These fixtures cover supported
patterns and regressions. They cannot establish accuracy for real-world prompts
or unsupported languages. The mixed-language group retains English field labels.

Recall measures expected spans whose policy action was enforced. Mask precision
measures successful expected masks among predicted masks. Synthetic marker leaks
count labeled values still present in approved output. Timing measures local
engine execution per prompt and excludes UI, startup, and transport. Run browser
and coding-agent integration separately to verify the transfer boundary.
