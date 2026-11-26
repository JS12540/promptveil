# Threat model

## Protected workflows

PromptVeil reduces accidental disclosure of supported identifiers and credentials. The protected input enters the extension or PWA composer, the CLI, a configured native hook, or the dedicated Codex relay. The provider page receives only the approved output when transfer uses PromptVeil. The relay can send model content upstream after inspection.

## Boundaries

| Boundary | Behavior |
| --- | --- |
| Composer → provider | Keep the raw draft in the extension-owned side panel or toolbar popup. The host page launcher handles opening the panel. Only the protected result goes to the provider editor. Keep restoration in memory in the local viewer. |
| Relay → provider | Use the fixed upstream API and a separate upstream API key. Reject unsupported request shapes and scan failures before forwarding. |
| Host → native hook | Coverage depends on the host invoking the configured hook, trust settings, and host handling of hook failures. |
| Website → app | Serve first-party static assets. Offline support covers local scanning after assets are cached. |

The PWA and CLI redaction modes replace detected credentials with irreversible markers. Config mode also masks values under unfamiliar names in JSON and common line-based configuration. Source matching covers common textual assignments and environment writes. It does not evaluate programs, resolve environment variables, or follow references into a vault. Encoded or computed secrets and unsupported syntax can escape detection. Treat the masked text as a copy for sharing. Redaction can change value types or remove parts of expressions. The Codex relay applies redaction to supported tool results it receives and leaves local file execution untouched. Native prompt hooks alone do not cover file reads. Agent logs and provider requests outside the relay remain separate paths.

On configured Chrome chat sites, the paste guard cancels a recognized editor’s native text paste and inserts approved plain text. Coverage depends on the browser running the guard and recognizing the editor. It scans the clipboard text in that paste, so separately entered context, direct typing, file or image-only pastes, and independent clipboard permissions are outside the paste boundary. The native Enter and Send safeguard checks recognized UI actions. The private composer pauses those actions in its configured chat tab while scanning and transferring through a tab-local extension connection. Text typed in the provider can already be visible to its page before that check. The private composer protects prompts typed there before transfer. Shell tools, browser tools, and MCP services may send data independently. The scanner can miss unknown formats, paraphrases of sensitive facts, and data that needs more context. Browser extensions, compromised devices, clipboard utilities, and users with privileged local access may observe raw input. Providers can still see unmasked content and infer details from context. Keep sensitive payloads out of reproduced bug reports, logs, and evidence.
