# Troubleshooting

## The local preview does not start

Run `node --version` and verify Node.js 22.18 or later is available. Start in the directory containing `package.json`. On Windows PowerShell, use `npm.cmd run dev` if the npm script shim is blocked. If port 8000 is in use, open the address shown by your server or configure a free port. See [local setup](quick-start.md#run-on-your-computer).

## The extension does not insert the draft

Reload PromptVeil from the browser extensions page, refresh the chat tab, and open the composer again. Check that the chat is on a supported origin and the editor is empty before the first transfer. Use **Copy protected text** if the editor declines direct insertion. See [browser diagnostics](install.md#debug-native-paste-or-send).

## Paste or Send is paused

Check the composer for review findings or detected credentials. If PromptVeil masked a typed draft, review the new text and send again. If a private composer scan is running, wait for it to finish and review the inserted text before sending.

## Offline readiness never appears

Open the app once online from a secure address or local loopback. Wait for **Ready to scan offline** before disconnecting. Reopen the same app address in the same browser profile, or reinstall using the [mobile guide](install.md#mobile).

## The terminal cannot find promptveil

Run the [CLI directly from source](cli.md#run-from-source), or verify that npm installed its global executables on your PATH. For packaging failures on Windows, check that `python --version` runs Python 3 in the same terminal.

## An agent guard does not trigger

Run `promptveil doctor` with your agent name, restart the host, and verify it loaded and trusted the hook. Use only fictional data for testing. See [agent setup](agents.md) and [verified combinations](compatibility.md).
