# Chrome extension transfer audit

Recorded 2026-11-25 UTC. Installed Chrome version 158.0.8127.89 was read from application metadata. The browser launch exited before opening a test session.

## Observed checks

| Check | Result |
| --- | --- |
| Serialized transfer into a focused textarea | Passed with a synthetic fixture. The editor received protected text and a bubbling input event. |
| Rich-text transfer | Passed with a synthetic editing-host fixture. It called insertText with the protected payload. |
| Destination changed or field read-only | Passed. Transfer returned false. |
| Detector evaluation and release package | 500-prompt evaluation and checksums passed. The automated suite passed 21 tests with one sandbox-blocked loopback skip. |
| Packaged browser harness | Syntax checked. The Chromium editor fixture requires Playwright and loopback access. |
| Live ChatGPT or Claude | Pending. A fresh Chrome launch exited with code 134 before testing the extension on a live site. |

## Earlier toolbar workflow

Use the [current one-step audit](chrome-one-step.md) for the updated extension.

### Historical manual run on ChatGPT or Claude

1. Load or reload the unpacked extension from `dist/extension/` in `chrome://extensions`. Pin PromptVeil to the toolbar.
2. Open [ChatGPT](https://chatgpt.com/) or [Claude](https://claude.ai/) and click its empty message field so it has focus.
3. Open PromptVeil from the toolbar and enter `Customer ID: 12345678. Invest ₹25,000.` in the **extension composer**. Click **Scan prompt**.
4. Confirm the ID becomes a placeholder and the amount stays intact. Click **Insert into tab**. The provider editor should receive the protected text and stay unsubmitted. If insertion is unavailable, record that and verify **Copy protected text** with manual paste.
5. In the extension, scan `Password: never-valid-fixture`. Confirm both transfer buttons remain disabled and the provider field receives no new text.
6. Record the browser version, provider, whether direct insert or copy worked, and whether the credential case was blocked. Use synthetic-only screenshots if needed.

[Compatibility matrix](../../docs/compatibility.md) · [Session record](../sessions/PS-006.md) · [Chrome activeTab reference](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab/)
