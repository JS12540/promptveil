# PWA and terminal output redaction

The PWA now returns protected output for detected credentials. Its .env option also masks assignment values with unfamiliar names. Credentials and .env values use irreversible markers. Ordinary supported PII can still be restored locally in the PWA session.

The CLI exposes irreversible redaction for stdin, with an explicit .env mode. The Codex relay masks supported file or shell results before forwarding, preserving assignment names and the tool call identifiers. The relay does not change the local files. Native prompt hooks cover their submitted prompt event. Other terminal products require a separate integration to replace tool results.

Typecheck, 40 tests, the 650-prompt evaluation, build, and checksum verification passed. One loopback test was skipped. The packaged PWA worker and CLI produced identical redacted output in a synthetic smoke test. An in-process relay fixture confirmed a mock upstream received redacted tool text. The Playwright fixture includes offline .env redaction. Playwright and a live routed agent were unavailable locally.

[PWA and relay installation](../../docs/install.md) · [Threat model](../../docs/threat-model.md)
