# Coding-agent setup

Use the local prompt hook on a supported host. Native hook installation needs a POSIX shell. Check the [compatibility matrix](compatibility.md) before depending on a particular client, OS, or authentication mode.

## Install a native guard

[Install the CLI](cli.md#install-the-cli-package) first. Preview and inspect the proposed change before applying it. Use the agent name from the following table in each command.

| Agent | Name | Where to verify |
| --- | --- | --- |
| Claude Code | claude-code | Restart and review the UserPromptSubmit guard under /hooks. |
| Codex | codex | Restart and review and trust the PromptVeil entry under /hooks. |
| Cursor Agent Chat | cursor | Check the local Agent Chat configuration and run a synthetic prompt. |
| Gemini CLI | gemini | Restart and verify the BeforeAgent hook with a synthetic prompt. |

```sh
promptveil install claude-code
promptveil install claude-code --apply
promptveil doctor claude-code
```

## Verify and remove the guard

Send an ordinary synthetic prompt first, then use the fictional [customer-support example](quick-start.md#scan-your-first-prompt). The native guard should pause the flagged submission. Run the prompt through the CLI and resubmit the protected text. To remove the hook, run `promptveil uninstall claude-code --apply` with your actual agent name.

## Optional Codex relay

The relay handles supported text-based Responses requests through a dedicated local provider configuration. See the [relay installation and verification steps](install.md#codex-relay) and the [privacy boundary](threat-model.md).
