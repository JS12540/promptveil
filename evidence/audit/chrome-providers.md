# Chrome chat provider audit

## Configured launchers

| Provider | Scoped hosts | Live signed-in transfer |
| --- | --- | --- |
| ChatGPT | chatgpt.com | Pending |
| Claude | claude.ai | Pending |
| Gemini | gemini.google.com | Pending |
| Grok | grok.com | Pending |
| DeepSeek | chat.deepseek.com | Pending |
| Perplexity | www.perplexity.ai, perplexity.ai | Pending |
| Microsoft Copilot | copilot.com, copilot.microsoft.com | Pending |
| Mistral Vibe | chat.mistral.ai | Pending |
| Poe | poe.com | Pending |
| Qwen | chat.qwen.ai | Pending |

Verified public provider entry points and documentation. Those sources establish domains and products. The editor selection rules still need live signed-in smoke checks. [Gemini](https://gemini.google.com/app) · [Grok](https://docs.x.ai/grok/overview) · [DeepSeek](https://deepseek.com/en/news/v4-preview/) · [Perplexity](https://www.perplexity.ai/) · [Copilot](https://copilot.com/) · [Mistral](https://docs.mistral.ai/vibe) · [Poe](https://poe.com/) · [Qwen](https://qwen.ai/cookies-notice)

The runtime and built Chrome manifest share the same origin registry. Additional HTTPS chats can use the toolbar with Chrome's user-initiated active-tab access. The fallback targets a focused compatible editor. [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab/)

## Observed verification

- The fixture suite verified all configured origins, blocked lookalike origins, declined ambiguous matches, preserved an unrelated draft, and exercised protected insertion into a focused editor.
- Typecheck, 25 automated tests, the 500-prompt synthetic evaluation, build and artifact checksums passed. The socket-based test was skipped.
- The isolated Chrome session exited before a live Gemini page loaded. Browser deployment and signed-in editor behavior remain pending.

## Live check for each provider

Reload the extension and refresh the provider tab. Open an empty chat, click **Write with PromptVeil**, enter `Customer ID: 12345678. Invest ₹25,000.`, and click **Protect and insert**. Confirm the ID is masked, the amount stays intact, and the chat contains an unsent draft. Repeat with a synthetic credential and verify the chat stays unchanged. If the provider editor is not recognized, test the focused-editor toolbar flow and record whether direct insertion or protected copy was needed.

[Implementation session](../sessions/PS-008.md) · [Compatibility matrix](../../docs/compatibility.md)
