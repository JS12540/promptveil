# Testing and evaluation

Use Node.js 22.18 or later and Python 3 for packaging. Shared tests and evaluation inputs must be synthetic.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm test:security
pnpm build
pnpm eval
pnpm release:check
```

For npm, use `npm test`, `npm run test:security`, `npm run build`, `npm run eval`, and `npm run release:check`. Read actual results and status codes before making claims.

## Fixture and integration checks

- Assert that protection preserves ordinary amounts and source identifiers. Cover Unicode spans, overlapping findings, unsupported inputs, excessive sizes, credential blocks, CLI exit codes, and value-free JSON.
- Use mock provider traffic for relay tests. Check denial with zero upstream calls, valid streaming, cancellation, and request fields that contain supported identifiers. Use isolated settings for native installer checks.
- The security suite checks relay origin and host validation, token validation, invalid UTF-8, restricted routes, and zero upstream calls for rejected requests. The release check validates browser network policies and the extension permission set. CI also scans Git history and the dependency lockfile and runs CodeQL.
- Test the built extension and PWA in a browser. Verify that raw markers do not reach the provider page or its network, copy works, and changing destinations prevents insertion. Reload the PWA offline after initialization.
- Keep evaluation scenarios separate from rule design examples. Record corpus size, benign examples, classification and masking metrics, and limits in the [benchmark records](../evidence/benchmarks/README.md).

Run both installed agent clients against isolated synthetic settings with `node tests/e2e/native.mjs claude-code codex`. Use `node tests/e2e/codex.mjs` to verify the pinned Codex client against the local mock in an environment that permits loopback sockets. CI also runs the packaged Playwright browser checks.

## Release checks

Test the unpacked extension on Chrome and Edge and record insertion versus copy separately for ChatGPT, Claude, Gemini, Grok, DeepSeek, and Perplexity. Install the web app on Android and iPhone and verify airplane-mode reload, protection, and clipboard use. Run both native guard smoke tests and a configured live Codex relay smoke test with synthetic inputs. Record observed versions, auth modes, results, and limitations in the [compatibility run log](../evidence/compatibility.md).
