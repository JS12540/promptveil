# Compatibility matrix

The table lists capabilities in the prerelease and the checks used to establish support. Use synthetic data for verification.

| Surface | Scope | Verification |
| --- | --- | --- |
| CLI from source | stdin protection and value-free findings | Node.js v26.0.0 on macOS. The synthetic ID was masked, ₹25,000 was preserved, and a synthetic credential was blocked with exit code 2. |
| Packaged CLI | Clean installation and stdin protection | Installed the local tarball into a clean npm prefix on macOS using Node.js v26.0.0. The CLI masked the synthetic ID and preserved the currency amount. |
| Chrome and Edge | Private scan, approved copy or insertion | Focused editor transfer passed synthetic fixture checks. Branded browser checks pending. |
| ChatGPT, Claude, Gemini, Grok, DeepSeek, Perplexity, Microsoft Copilot, Mistral Vibe, Poe, and Qwen | In-page launcher, one-step draft insertion, and automatic paste and Send checks for recognized editors in Chrome | Origin, editor selection, paste recovery, Send gestures, and scan-pause fixture checks passed. Live signed-in provider checks are pending. See the [provider audit](../evidence/audit/chrome-providers.md). |
| Other HTTPS chats | Toolbar Protect and insert into a compatible focused editor | Focused editor and ambiguity fixtures passed. Results depend on the provider editor. |
| Android Chrome and iPhone Safari | Installation, offline app, clipboard | Physical-device checks pending. |
| Claude Code | Native `UserPromptSubmit` blocking | Client 2.1.331 blocked a synthetic ID in an isolated headless run and echoed the original prompt locally. Interactive and failure cases pending. |
| Codex | Native `UserPromptSubmit` blocking | Client 0.172.0 reported a blocked synthetic submission in an isolated headless run. Interactive hook trust and failure cases pending. |
| Cursor Agent Chat | Native `beforeSubmitPrompt` blocking | Synthetic hook outputs and isolated installer checks passed. Desktop client verification pending. |
| Gemini CLI | Native `BeforeAgent` blocking | The isolated installer and configured hook command passed synthetic checks against the documented protocol. Live Gemini CLI verification pending. |
| Codex HTTP Responses relay | Supported model-bound text through isolated API-key configuration | Socket-free fixtures verify masking in forwarded file-read text and structured environment maps. Live API-key smoke pending. |

Document browser and OS versions, provider URL, auth mode, and insertion versus copy on each run. Coverage applies to the tested workflow and configuration.

Live ChatGPT testing of G4 confirmed that standard customer ID labels were masked and two misspelled labels escaped. The G5 regression tests cover both spellings, and the diagnostics tab exposes typing scans and canceled gestures. Live G5 verification is pending. [G5 audit](../evidence/audit/chrome-typing-diagnostics.md)

The packaged PWA caches its scan worker and module dependencies within the composer service worker scope for offline reloads.
