# Contributing to PromptVeil

1. Open an issue describing the problem, expected behavior, and relevant versions. Use a synthetic example.
2. Fork the repository and create a branch. Use Node.js 22.18 or later and the pinned pnpm version in `package.json`.
3. Install with `pnpm install --frozen-lockfile`. Run `pnpm test`, `pnpm build`, `pnpm eval`, and `pnpm release:check` before opening a pull request. See the [testing guide](docs/testing.md) for the npm equivalents and manual checks.
4. Add tests for behavior changes. Keep unit tests near the implementation, shared synthetic samples in the fixture area, and integration tests in the test suite. Update the relevant user and compatibility docs.
5. In the PR, summarize the change, paste actual check results, and link a sanitized evidence record for substantive Codex work.

Use the [private vulnerability reporting route](SECURITY.md) for security concerns.
