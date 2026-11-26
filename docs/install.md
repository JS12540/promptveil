# Install PromptVeil

Use a tagged GitHub Release after publication, or build locally for prerelease testing. The [compatibility matrix](compatibility.md) distinguishes verified behavior from outstanding checks.

## Build from source

For the website and PWA, use Node.js 22.18 or later and run `npm run dev` from the repository root. Open `http://127.0.0.1:8000/`. Restart the command after editing source files. Use `npm run build:web` to produce just the deployable website in `dist/web/`.

In the PWA, scan `Password: never-valid-fixture` and confirm the protected copy contains `Password: [PV_REDACTED]`. For JSON or line-based configuration, select **Mask all config values, including unknown fields** to redact values whose key names offer no privacy clues.

For the full extension and CLI release build, use Python 3 for packaging. The pnpm commands below also use the version pinned in the root package.

```sh
pnpm install --frozen-lockfile
pnpm build
```

With npm, use `npm run build`. See the [testing guide](testing.md) for verification commands.

## Laptop

1. Extract the release's `extension.zip` or use the local `dist/extension/` directory.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge. Turn on developer mode and select **Load unpacked**, then choose the directory containing `manifest.json`.
3. Refresh your AI chat tab, then click **Write with PromptVeil**. See the [compatibility matrix](compatibility.md) for the listed launchers. You can also click the PromptVeil toolbar icon.
4. Type `Customer ID: 12345678. Invest ₹25,000.` in the PromptVeil composer. Click **Protect and insert**. The protected text should appear in the chat editor as a draft. Review it before sending.
5. Try `Password: never-valid-fixture` and confirm PromptVeil blocks it.

If a transfer is declined, check that the chat tab is still active and its editor is empty. Reopen the panel after navigating to another chat. On other HTTPS sites, focus an empty message field, open the toolbar popup, and select **Protect and insert**. If the editor declines direct insertion, use **Copy protected text** instead. To uninstall, select **Remove** on the browser extensions page.

### Direct paste in Chrome

After reloading the extension and refreshing a supported chat tab, hover over **Write with PromptVeil**. The updated launcher shows **PromptVeil Paste and Send guard is active**. Then paste `Customer ID: 12345678. Invest ₹25,000.` into the native message field. PromptVeil should insert the masked result at the current selection. Separately paste `Password: never-valid-fixture` and confirm the chat stays unchanged. If a paste needs review, open the private composer. To check the Send safeguard with synthetic data, type a labeled numeric customer ID into an empty native chat and press Enter. The first action should mask the draft and pause submission. Also try clicking the Send arrow after typing a raw synthetic draft. The first click should mask it and leave it unsent. The reviewed draft can then be sent with a second action.

### Debug native paste or Send

1. Build with `npm run build`, reload PromptVeil in `chrome://extensions`, and refresh ChatGPT. The page button shows **Write with PromptVeil · G7**.
2. Type `Cusotmer id : 1234455` manually into a fresh ChatGPT draft. When you pause, a local notice should flag it while it is still editable.
3. Press Enter once. The ID should become a `[PV_CUSTOMER_ID_…]` placeholder and the draft should remain in the composer. Repeat from a fresh raw draft with the Send arrow. Try pressing Enter immediately after typing to check the synchronous guard as well.
4. From the chat tab, click the PromptVeil toolbar icon and select **Open guard diagnostics in a new tab**. Check **Chat editor**, **Typing scans flagged**, and the **Canceled** column for Enter or Send. **Copy report** copies only build information and event metadata. Keep the chat tab open and click **Refresh report** after another test.

For a missing response, check PromptVeil’s site access for ChatGPT and look for extension errors on `chrome://extensions`. [Chrome extension debugging](https://developer.chrome.com/docs/extensions/get-started/tutorial/debug)

## Mobile

1. Open the release website over HTTPS and choose **Open PromptVeil**.
2. On Android Chrome, use the install action when it appears or look in the browser menu. On iPhone Safari, use **Share → Add to Home Screen** and enable **Open as Web App** when available.
3. Launch the app, wait for **Ready to scan offline**, enable airplane mode, and scan the synthetic example above. Copy the result and paste it in the destination when ready.

If the offline message is missing, open the app once online and allow the offline setup to complete. Remove the app through your device's home-screen or app management controls. To clear cached web assets too, remove the site's data through browser settings.

## Terminal

Install the release tarball or its local equivalent.

```sh
npm install -g ./dist/cli/promptveil-0.1.0.tgz
promptveil --help
printf '%s\n' 'Customer ID: 12345678. Invest ₹25,000.' | promptveil protect
promptveil scan --file ./sample.txt --json
```

On PowerShell, pipe a quoted synthetic prompt directly into `promptveil protect`. If the shell cannot find the command, check that npm's global executable directory is on `PATH`. To uninstall, first remove any installed hooks, then run `npm uninstall -g promptveil`.

## Coding agents

### Native prompt guards

Run these commands with `claude-code`, `codex`, `cursor`, or `gemini` in place of the agent name. The native installer requires a POSIX shell. The CLI and relay can be tested separately on Windows.

```sh
promptveil install claude-code
promptveil install claude-code --apply
promptveil doctor claude-code
```

Restart the agent as needed. For Codex, review and trust the PromptVeil entry through `/hooks`. For Cursor, verify the local Agent Chat hook using the [README instructions](../README.md#cursor-agent-chat). Try an ordinary synthetic prompt, then submit `Customer ID: 12345678.` and check that the guard blocks it. To continue, protect that input with the CLI and resubmit the protected result. The guard is effective only on a host and configuration where the hook runs.

Run `promptveil uninstall <agent> --apply` to remove the corresponding PromptVeil hook. Backups, when created, are beside the original configuration and may contain private settings. Keep them local.

### Codex relay

The relay is a separate prerelease route for supported text-based Responses requests. Use synthetic data until your configuration passes the smoke checks. Keep the provider's API key and a separate generated local token in your shell's environment. On a POSIX shell, generate the local relay token before starting the process.

```sh
export PROMPTVEIL_GATEWAY_TOKEN="$(node -p 'require("node:crypto").randomBytes(32).toString("hex")')"
# Set OPENAI_API_KEY privately in this terminal before launching.
promptveil gateway
```

Use an isolated Codex configuration for relay testing so the direct-session guard does not preempt masking. Generate the configuration with `promptveil profile codex`. The command uses port `8787` unless `PROMPTVEIL_PORT` is set. In a separate terminal, use the same local token and leave the upstream API key in the relay terminal.

```sh
relay_home="$(mktemp -d)"
promptveil profile codex > "$relay_home/config.toml"
CODEX_HOME="$relay_home" codex
```

For direct Codex guards, open `/hooks` to review and trust the installed hook. The native host may echo or retain submitted input under its own settings. For sensitive input, protect it before opening the agent.

Verify that an ordinary synthetic request completes and that a synthetic credential is rejected. Stop the relay and retry the ordinary test to confirm the isolated session depends on it. To revert, close the routed session, stop the relay, and start Codex with your usual configuration. See the [compatibility matrix](compatibility.md) for confirmation status. [Codex provider settings](https://learn.chatgpt.com/docs/config-file/config-reference)

To exercise file-read redaction, create a synthetic .env fixture with `CUSTOM_SETTING=fixture-value` and ask the routed session to read it and report the variable names without editing the file. Supported tool results sent through the relay retain the assignment name and replace the value. A session’s local tool logs may still show the original value.
