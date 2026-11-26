# Instructions for PromptVeil contributors and coding agents

- Keep privacy processing local and test with synthetic inputs. Keep real prompts, credentials, and absolute personal paths out of logs, fixtures, and evidence.
- Keep recognizers and policy in the shared core. Preserve app boundaries for network, filesystem, browser transfer, and rendering.
- Treat unsupported inputs and failed scans as explicit outcomes. Preserve unrelated agent configuration on changes.
- Run focused tests first and the documented local CI checks before handing off. Update usage and compatibility docs for behavior changes.
- For substantive work, add a sanitized session record, stage links, and actual verification to the Evidence Pack. Mark unavailable information and link commits and CI runs when they exist.
