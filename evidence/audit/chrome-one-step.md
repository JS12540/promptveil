# Chrome one-step composer audit

## Design and implementation

1. Provide a launcher on ChatGPT and Claude with Chrome access scoped to those two sites. A trusted click opens Chrome's extension side panel.
2. Scan the text inside the private panel using the existing local worker. The **Protect and insert** action transfers the scan result only when it is approved.
3. Verify the original tab and URL before writing. Preserve drafts entered directly in the provider. Leave successful transfers as unsent drafts for the user to review.

[Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) · [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)

## Observed verification

| Check | Result |
| --- | --- |
| One-step composer | Passed fixture tests. One action scanned and inserted protected output, preserved the amount, and blocked a credential without inserting it. |
| Editor selection and draft preservation | Passed fixture tests. The expected ChatGPT editor received protected text. An unrelated draft and changed destination were preserved. |
| Repository and release | Typecheck, 23 automated tests, the 500-prompt synthetic evaluation, build, and release checksums passed. One loopback test was skipped. |
| Live provider interaction | Pending. The isolated Chrome process exited before opening a usable browser session. |

## Live Chrome check

Reload PromptVeil in `chrome://extensions` and refresh [ChatGPT](https://chatgpt.com/) or [Claude](https://claude.ai/). Click **Write with PromptVeil**. With an empty chat editor, type `Customer ID: 12345678. Invest ₹25,000.` in the side panel and click **Protect and insert**. The chat should show masked text and the intact amount as an unsent draft. Try `Password: never-valid-fixture` and verify the chat draft did not change. Record the browser version, provider, and outcome after running the check.

[Implementation session](../sessions/PS-007.md) · [Compatibility matrix](../../docs/compatibility.md)
