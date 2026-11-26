# Use PromptVeil

In Chrome on a supported AI chat site, choose **Write with PromptVeil** and type in the browser side panel. **Protect and insert** checks the prompt locally and places the protected text into the provider editor as a draft. Review findings inside PromptVeil if the policy asks for a decision. Review the draft in chat before sending.

When pasting a complete plain-text prompt directly into a recognized chat editor, PromptVeil scans the pasted text before insertion. It preserves ordinary values, masks supported matches, and blocks or pauses unresolved findings. The editor receives plain text and keeps its existing draft outside the paste selection. The extension also checks recognized Enter and Send actions. If it masks an existing draft, review the result and send it again. Detected credentials and unresolved findings pause Send. If you press Enter or click Send in that chat during a private composer scan or transfer, PromptVeil cancels that action. Afterward, send the reviewed draft with a fresh action. Use the private composer for direct typing or to review an ambiguous paste.

1. Paste or type your prompt into the private composer or send it to `promptveil protect` through stdin.
2. Scan before transfer. The rules can preserve text, replace a supported identifier with a placeholder, request a review decision, or block a detected credential.
3. In the composer, choose a decision for each review finding and scan again. Check the protected output before copying or inserting it.
4. To restore session placeholders in a provider response, paste the response into the local restore viewer and select **Restore placeholders**. Clear the session when you are finished.

The browser composer keeps its restoration map in memory. Closing or clearing the composer removes that map. The CLI has no persistent restore map. The PWA scans and copies locally after offline setup. Opening it already installed does not intercept another app.

Balanced mode allows the composer to collect review decisions. Strict mode blocks unresolved review cases. A strong credential match blocks transfer in either mode. The CLI uses status codes `0` for success, `2` for block or required review, and `3` for errors. Inspect matches through `promptveil scan --json` for finding offsets and types without the matched values.

PromptVeil's detection covers its implemented rule formats. Check protected text yourself before sharing. See the [threat model](threat-model.md) and [installation guide](install.md).
