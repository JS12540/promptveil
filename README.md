# PromptVeil

PromptVeil checks prompts locally before you submit them to an AI tool. It masks supported sensitive data and, depending on the surface, redacts detected credentials or stops submission.

```text
Before     Customer ID: 12345678. Invest ₹25,000.
Protected  Customer ID: [customer ID placeholder]. Invest ₹25,000.
```

**Status** · v0.1 prerelease. The [compatibility matrix](docs/compatibility.md) records the exact versions and checks completed.

- [Set up from a source ZIP](#set-up-from-a-source-zip)
- [Run the website and PWA](#run-the-website-and-pwa)
- [Install Chrome or Edge extension](#install-the-chrome-or-edge-extension)
- [Install from a browser store](#install-from-a-browser-store)
- [Publish the extension](#publish-the-extension)
- [Install the CLI](#install-the-cli)
- [Detection coverage](#detection-coverage)
- [Models and data flow](#models-and-data-flow)
- [Set up coding-agent guards](#set-up-coding-agent-guards)
- [CI and security](#ci-and-security)
- [Run local verification](#run-local-verification)
- [Deploy the website to Vercel](#deploy-the-website-to-vercel)
- [Repository layout and contributing](#repository-layout-and-contributing)

## What you can use

| Surface | Workflow |
| --- | --- |
| Landing page | Plain HTML and CSS with a fixed synthetic demo. [Source](apps/web/index.html) |
| Installable PWA | TypeScript compiled to browser JavaScript. Mask and copy locally, with session-only restoration for supported PII. [Source](apps/web/app/index.ts) |
| Chrome | Paste a complete prompt directly into a recognized AI chat editor for automatic local scanning, or type in the private side panel and use **Protect and insert**. |
| Chrome and Edge toolbar | The private composer can transfer approved text to a supported editor or clipboard. |
| CLI | Protect stdin or scan a file for findings that omit detected values. |
| Claude Code, Codex, Cursor Agent Chat, and Gemini CLI | Install a local prompt hook that stops a flagged submission. See the compatibility matrix for live client results. |
| Codex relay | Route supported text-based Responses API requests through a local scanner. Fixture checks passed. Live provider verification is pending. |

## Detection coverage

PromptVeil uses text patterns and context. It is independent of file extensions and has fixture coverage for specific constructs. Coverage varies with how a value is written and which path carries it.

| Area | Covered examples |
| --- | --- |
| Code and config | Credential assignments tested in JavaScript, TypeScript, Python, Go, Kotlin, PowerShell, and PHP-style syntax. Config masking covers JSON scalars, including nested arrays, and common line-based YAML, TOML, INI, properties, and shell assignments. Docker and Kubernetes environment declarations also have targeted cases. |
| Credentials | Supported private-key markers, selected OpenAI, GitHub and AWS token signatures, JWT-shaped tokens, credential assignments, authorization headers, and database credentials in supported URLs. Config mode also masks unfamiliar assignment values. |
| Personal information | Email, PAN, UPI, and supported labeled forms of customer and account IDs, phone numbers, card numbers, Aadhaar, names, addresses, dates of birth, US SSNs, and IFSC routing codes. Actions vary by surface. |
| Coding environments | Local CLI on supported Node platforms, native prompt hooks for Claude Code, Codex, Cursor Agent Chat and Gemini CLI, and supported tool-output masking in the dedicated Codex relay. Check the matrix for observed host and auth coverage. |

Unknown or computed secrets, arbitrary encodings, unsupported syntax, and data outside the configured guard can escape detection. The 650-prompt evaluation measures this synthetic corpus. [Compatibility](docs/compatibility.md) · [Threat model](docs/threat-model.md) · [Evaluation method](eval/README.md)

## Models and data flow

| Flow | Model used | What runs or leaves the device |
| --- | --- | --- |
| Landing page | None | Static assets and a fixed synthetic example. |
| PWA and browser extension | None for protection | The shared TypeScript scanner runs in the browser. The PWA can scan offline. When you submit in a third-party chat, that chat selects and runs its own model. |
| Standalone terminal CLI | None | Node.js scans text locally. The CLI has no inference step. |
| Claude Code, Codex, Cursor, and Gemini native hooks | None for the hook | A local command scans the submitted text. The host agent manages its own model and authentication for approved turns. |
| Codex relay | The model selected in the routed Codex client | The local gateway applies rules before forwarding supported requests to OpenAI. The relay profile does not set a model. A live relay session uses the maintainer or user’s configured upstream API key. |
| GitHub Actions and evaluation | None | Deterministic fixtures and security scanners. The Codex 0.172.0 smoke tests name `gpt-5.4` in their test config and use local hook or mock Responses checks. They do not call that model or require a provider key. |
| Project development | Codex session settings recorded when visible | The Evidence Pack records model and reasoning effort where available and marks missing values. Project development settings are separate from runtime protection. |

[Shared scanner](packages/core/index.ts) · [Codex smoke test](tests/e2e/codex.mjs) · [Evidence Pack](evidence/README.md)

## Set up from a source ZIP

1. Extract the ZIP and open the `promptveil` folder in VS Code. Open an integrated terminal in the folder containing `package.json`.
2. Install Node.js **22.18 or later** with npm. Install Python 3 if you plan to package the extension or CLI. The website and PWA preview needs Node and npm only.
3. To try the website and PWA immediately, run `npm run dev` and open the local URL printed in the terminal. The default is `http://127.0.0.1:8000/`. Use `Ctrl+C` to stop it. [Website and offline PWA checks](#run-the-website-and-pwa)
4. To install the pinned development dependencies and verify the source, run the following from the same folder. The first command downloads pnpm and the development dependencies.

```sh
npx --yes pnpm@10.11.0 install --frozen-lockfile
npm run typecheck
npm test
npm run test:security
npm run eval
```

5. With Python 3 installed, run `npm run build` and `npm run release:check` to create and verify the packages under `dist/`. For Chrome or Edge, load `dist/extension/` as an unpacked extension. To try the source CLI without installing it globally, run `node apps/cli/index.ts --help`. [Extension setup](#install-the-chrome-or-edge-extension) · [CLI setup](#install-the-cli)

The website, browser extension, local CLI, and synthetic tests can be tried without an API key or `.env` file. A live Codex relay is a separate optional setup. [Coding-agent setup](#set-up-coding-agent-guards)

## Run the website and PWA

From the repo root in the VS Code terminal, use Node.js **22.18+** and npm.

```bash
npm run dev
```

1. Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) for the landing page.
2. Select **Open PromptVeil** or open [the PWA](http://127.0.0.1:8000/app/).
3. Enter `Customer ID: 12345678. Invest ₹25,000.` and click **Scan prompt**. Verify that the customer ID is masked and the amount remains.
4. Try `Password: never-valid-fixture`. The output should read `Password: [PV_REDACTED]`. For pasted configuration, enable **Mask all config values, including unknown fields**.
5. Wait for **Ready to scan offline**. Stop the preview with `Ctrl+C`, reload the already-open PWA URL in the same browser profile, and scan the first example again.

These commands need Node and npm. Restart `npm run dev` after source edits. If port 8000 is in use, start with `PORT=8001 npm run dev` on macOS or Linux and open port 8001.

### Install on a phone

Use a deployed HTTPS address on the phone and open the **Open PromptVeil** link. In Android Chrome, use the app’s install button when available or the browser menu. In iPhone Safari, use **Share → Add to Home Screen** and enable **Open as Web App** if offered. Launch from the new icon, wait for offline readiness, enable airplane mode, and repeat the synthetic scan. Remove it through your home screen or app settings. [Chrome web app installability](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest/) · [Apple web app installation](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios/27)

## Install the Chrome or Edge extension

1. From source, run `npm run build` with Node.js 22.18+ and Python 3. The release build packages the extension and CLI. From a published release, extract `extension.zip`.
2. Open `chrome://extensions` or `edge://extensions`. Enable **Developer mode**, select **Load unpacked**, and choose `dist/extension/` or the extracted folder containing `manifest.json`.
3. Open a supported chat site and refresh the tab after installing or reloading the extension. Click **Write with PromptVeil** to open Chrome’s private side panel. The PromptVeil toolbar icon is another way to open the composer on these sites.
4. Type `Customer ID: 12345678. Invest ₹25,000.` **in PromptVeil**. Select **Protect and insert**, or press **⌘+Enter** on macOS or **Ctrl+Enter** on Windows/Linux. The masked ID and unchanged amount should appear as a chat draft. Review the draft and send it when ready.
5. Try `Password: never-valid-fixture`. PromptVeil should block the transfer. To uninstall, select **Remove** on the browser extensions page.

The in-page launcher is configured for ChatGPT, Claude, Gemini, Grok, DeepSeek, Perplexity, Microsoft Copilot, Mistral Vibe, Poe, and Qwen. The extension accesses those sites to place protected text into the chat editor. On other HTTPS chat sites, focus the empty message field before opening PromptVeil from the toolbar and choose **Protect and insert**. A protected copy option appears if direct insertion is unavailable. Keep the native chat editor empty for the first transfer. See the [compatibility matrix](docs/compatibility.md) for live verification status. [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

### Paste directly into a supported chat

After loading or reloading PromptVeil, refresh the chat page. Hover over **Write with PromptVeil** to confirm that the updated native guard is active. Copy the full synthetic text `Customer ID: 12345678. Invest ₹25,000.` and paste it into the native chat editor. PromptVeil cancels the original paste and inserts approved plain text at the current selection. The ID should be masked and the amount preserved. A detected credential blocks the paste. An ambiguous result stays out of the editor until you review it in the PromptVeil composer. On a recognized chat editor, Enter and Send also check the current draft. A clean draft proceeds immediately. If the guard masks an existing draft, review the result and send it again. Detected credentials and unresolved findings pause Send. During a scan started in the private composer, recognized Enter and Send actions in that chat tab are canceled until scanning and insertion finish. Press Send again after reviewing.

When you type directly, a brief pause triggers local feedback while leaving the draft editable. Enter and Send scan the latest text immediately, including inputs such as `Cusotmer id : 1234455`. The private composer is available when you want to scan before placing text on the provider page. Use **Open guard diagnostics in a new tab** from the extension popup to see the build and event counts. [Browser test steps](docs/install.md#debug-native-paste-or-send)

## Install from a browser store

Store listings are pending. The [local installation steps](#install-the-chrome-or-edge-extension) are available now. Once a listing is live, the maintainer will link it here and in the GitHub release notes.

### Chrome public installation

1. In a regular **desktop Chrome** window, open the official PromptVeil listing linked from this README. Check the publisher name, choose **Add to Chrome**, review the requested permissions, and choose **Add extension**.
2. Click the puzzle-piece **Extensions** icon beside the address bar. Pin PromptVeil if you want its icon always visible.
3. Open `chrome://extensions` or choose **Extensions → Manage extensions**. Make sure the PromptVeil toggle is on. Under **Details → Site access**, allow access to the supported chat sites you want guarded. Automatic paste and Send protection needs that site access. Refresh any chat tab already open.
4. Open a supported chat, click **Write with PromptVeil**, and try `Customer ID: 12345678. Invest ₹25,000.` The inserted draft should mask the synthetic ID and preserve the amount.
5. If you previously loaded an unpacked build, disable or remove that copy after the store version is installed so both copies do not handle the same chat. A managed work or school profile may restrict installation. On phones, see [the PWA installation guide](#install-on-a-phone). [Chrome installation and site access](https://support.google.com/chrome/answer/2664769)

### Other browsers after publication

| Browser | Install and enable |
| --- | --- |
| Brave desktop | Open the official Chrome Web Store listing in Brave and choose **Add to Brave**. Manage the toggle under **Menu → Extensions**. [Brave installation guide](https://brave.com/learn/using-chrome-extensions-in-brave/) |
| Microsoft Edge desktop | Open the official Edge Add-ons listing, choose **Get**, and confirm **Add extension**. Manage it in `edge://extensions`. Edge also allows installation from the Chrome Web Store when your browser permits extensions from other stores. [Microsoft installation guide](https://support.microsoft.com/en-us/edge/add-turn-off-or-remove-extensions-in-microsoft-edge) |
| Firefox | Open the official Mozilla Add-ons listing, choose **Add to Firefox**, and confirm the permission prompt. Manage the extension in `about:addons`. [Mozilla installation guide](https://support.mozilla.org/en-US/kb/find-and-install-add-ons-add-features-to-firefox) |
| Safari | Install the containing app from the App Store. On Mac, select PromptVeil in **Safari → Settings → Extensions**. On iPhone or iPad, open **Settings → Apps → Safari → Extensions** and enable it. Grant access to the supported sites when prompted. [Safari on Mac](https://support.apple.com/guide/safari/extensions-sfri32153/mac) · [Safari on iPhone](https://support.apple.com/en-ie/guide/iphone/iphab0432bf6/27/ios/27) |

## Publish the extension

A GitHub release distributes the source and build archives. Each store publishes and updates its own listing. The current repository builds a Chromium Manifest V3 ZIP. It depends on `chrome.sidePanel.open` and a Chromium background service worker. Firefox and Safari need browser-specific packages and verification before submission.

| Target | Publication route | Package status |
| --- | --- | --- |
| Google Chrome | Chrome Web Store | Use the tested Chromium ZIP. |
| Brave desktop | Same Chrome Web Store listing | Verify that the Chromium build opens the private composer and guards the chat in Brave. |
| Microsoft Edge | Microsoft Edge Add-ons | Start with the Chromium ZIP, test it in Edge, and make an Edge-specific package if its API or validation requires changes. |
| Firefox | Mozilla Add-ons | Port the background and composer UI and produce a Firefox-specific ZIP. |
| Safari | Apple App Store | Port the composer, then package the extension inside a signed macOS or iOS app. |

### Prepare a store build

1. Build from the intended release commit with Node.js 22.18+ and Python 3. Run `npm test`, `npm run test:security`, `npm run build`, and `npm run release:check`. The Chromium store upload is `dist/extension.zip` with `manifest.json` at the archive root. GitHub's automatically generated source archive and `site.zip` serve other purposes.
2. Test the candidate in a clean profile on each target browser. Check supported-site permissions, the private composer, direct paste, Enter and Send, secret blocking, and install/update behavior. For mobile ports, repeat on a physical device. Record results in the [compatibility matrix](docs/compatibility.md).
3. Prepare a public support link, an accurate privacy policy hosted at a public URL, a clear description, an icon, and synthetic screenshots. For Chrome, prepare at least one 1280 × 800 screenshot. Link the privacy policy from the product site and supply any required store-specific disclosures. [Chrome listing assets](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) · [Chrome Web Store user-data policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
4. Describe the single purpose as local protection for AI chat prompts. The current build scans on-device, has no extension analytics endpoint, and keeps restorable mappings in session memory. Explain that users can manually copy or insert protected text, and their chosen chat service receives what they submit there. Justify `activeTab` for user-initiated access, `scripting` for inserting approved text, `sidePanel` for the private composer, and the named host permissions for automatic guards on those chat sites. Make the declarations match the actual build submitted to each store. [Chrome privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) · [PromptVeil threat model](docs/threat-model.md)

### Google Chrome and Brave

1. Sign into the Chrome Web Store Developer Dashboard with your publishing account. Complete registration, the one-time fee, and account verification. [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Choose **Add new item**, upload `dist/extension.zip`, then complete **Store listing**, **Privacy practices**, and **Distribution**. Set visibility to **Public** and select the markets you intend to serve. Include reviewer instructions with the synthetic customer ID example and a supported chat site.
3. Submit for review. Once the approved listing is live, verify the link signed out and do a clean installation. Test the same listing from Brave before advertising Brave support. Record the official URL and store version in the release notes. [Chrome developer registration](https://developer.chrome.com/docs/webstore/register/) · [Chrome publishing](https://developer.chrome.com/docs/webstore/publish) · [Chrome visibility and regions](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution) · [Brave store route](https://brave.com/learn/using-chrome-extensions-in-brave/)

### Microsoft Edge

1. Register for the Microsoft Edge extension program in Partner Center. In the Edge workspace, select **Create new extension**, then upload the ZIP verified in Edge. [Partner Center](https://partner.microsoft.com/dashboard)
2. Set **Availability** to **Public**, select markets, and complete **Properties**, **Privacy**, and **Store listings**. Add the required assets and synthetic certification notes.
3. Select **Publish** to start certification. After it passes, install the listing with **Get** in a fresh Edge profile and record its official URL. [Edge publication and certification](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)

### Firefox

1. Replace the Chromium side panel with a Firefox sidebar or extension-owned page. Use a Firefox-supported background entry and test messaging, tab permissions, clipboard access, and insertion. Set a stable `browser_specific_settings.gecko.id` and the required data collection declaration for the submitted build.
2. Test the port in Firefox using a temporary installation. Package the Firefox build with the manifest at the root. Ship a separate source archive and exact build instructions for reviewers because PromptVeil generates its distributable JavaScript.
3. Sign into the Mozilla Add-ons Developer Hub, choose **Submit a New Add-on** and **On this site**, then upload the Firefox ZIP. Complete validation, platform selection, metadata, and source upload. After Mozilla signs and lists it, verify installation in a clean Firefox profile and record the listing URL. [Mozilla Developer Hub](https://addons.mozilla.org/developers/) · [Firefox manifest background support](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background) · [Firefox data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) · [Mozilla submission](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) · [Mozilla source requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/)

### Safari

1. Port the private composer to a Safari-supported popup or extension page. Review the manifest and API compatibility for each intended Mac, iPhone, and iPad target, then test the guard and website permission prompts on those targets.
2. Enroll in the Apple Developer Program and create an App Store Connect app record with a stable bundle ID. Package the Safari-ready extension with the Safari Web Extension Packager in App Store Connect, or on a Mac run `xcrun safari-web-extension-packager /path/to/safari-ready-extension` and configure the generated Xcode project's signing for your team.
3. Test the containing app and extension through TestFlight. Complete the listing, support URL, App Privacy answers, and reviewer instructions. Select the build and submit to App Review. Once it is available, verify a clean install and enable it in Safari on every platform you advertise. [Safari compatibility assessment](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility) · [App Store Connect packaging](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect) · [Xcode packaging](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)

For updates, increment the extension version, build from the matching release tag, and submit a new package to each existing store listing. Use the same listing or app identity so current users can receive updates. For Safari, also advance the containing app's build number. Verify fresh installation and upgrade before updating public links. [GitHub release procedure](docs/releasing.md) · [Chrome update procedure](https://developer.chrome.com/docs/webstore/update/)

## Install the CLI

Use the tarball from a tagged release or generate it with `npm run build`. Python 3 is used during release packaging. The installed CLI runs on Node.js.

```bash
npm install -g ./dist/cli/promptveil-0.1.0.tgz
promptveil --help
printf '%s\n' 'Customer ID: 12345678. Invest ₹25,000.' | promptveil protect
printf '%s\n' 'Customer ID: 12345678.' | promptveil scan --json
```

`protect` writes approved text to stdout. `scan --json` reports the status and findings without matched values. `scan --file PATH --json` reads a local file. Exit codes are `0` for success, `2` for a block or required review, and `3` for a processing failure. Run from source with `node apps/cli/index.ts protect`. On Windows, pipe synthetic text with PowerShell. Uninstall any configured hooks first, then run `npm uninstall -g promptveil`.

Use `promptveil protect --redact` for source code, logs, or mixed text. It recognizes common credential assignments and environment writes across languages without requiring a language setting. Use `promptveil protect --config < settings.yaml` to mask unknown configuration values as well. That mode handles JSON scalar values and common YAML, TOML, INI, properties, and shell assignment forms. The narrower `--dotenv` mode remains available. These commands write a masked copy to stdout. The Codex relay automatically redacts supported model-bound tool results, including structured environment maps. [Protection boundaries](docs/threat-model.md)

## Set up coding-agent guards

Install the CLI first. The hook installer currently targets macOS and Linux. The first install command previews the change. `--apply` writes the user config while preserving other hooks. `doctor` checks the installed command. Confirm behavior in the agent after installation.

### Claude Code

```bash
promptveil install claude-code
promptveil install claude-code --apply
promptveil doctor claude-code
```

PromptVeil installs `UserPromptSubmit` in `~/.claude/settings.json` or the configured `CLAUDE_CONFIG_DIR`. Restart Claude Code and review the hook under `/hooks`. Submit `Customer ID: 12345678.` using synthetic data. Expect a blocked submission. Protect the text with the CLI and submit the protected result. Remove with `promptveil uninstall claude-code --apply`. [Claude Code hook reference](https://code.claude.com/docs/en/hooks)

### Codex

```bash
promptveil install codex
promptveil install codex --apply
promptveil doctor codex
```

PromptVeil installs `UserPromptSubmit` in `~/.codex/hooks.json` or the configured `CODEX_HOME`. Open interactive Codex, run `/hooks`, review the PromptVeil entry, and trust that exact definition. Submit the synthetic ID and expect it to be blocked. Remove with `promptveil uninstall codex --apply`. [Codex hook configuration and trust](https://learn.chatgpt.com/docs/hooks)

For an isolated **Codex relay** smoke test, run `node tests/e2e/codex.mjs` with Codex CLI **0.172.0**. It uses a mock upstream and needs a working loopback listener. For a live synthetic check:

1. In terminal A, set `OPENAI_API_KEY` privately, generate the separate local token with `export PROMPTVEIL_GATEWAY_TOKEN="$(node -p 'require("node:crypto").randomBytes(32).toString("hex")')"`, and run `promptveil gateway`.
2. In terminal B, set the same local token. Run `relay_home="$(mktemp -d)"`, then `promptveil profile codex > "$relay_home/config.toml"` and `CODEX_HOME="$relay_home" codex`. Keep the upstream API key in terminal A.
3. Try a benign synthetic request and a synthetic password prompt. Confirm the benign request completes and the relay rejects the password. Stop the relay and reopen Codex normally to return to your original route.

See the [relay setup and rollback guide](docs/install.md#codex-relay). [Codex provider configuration](https://learn.chatgpt.com/docs/config-file/config-reference)

### Cursor Agent Chat

```bash
promptveil install cursor
promptveil install cursor --apply
promptveil doctor cursor
```

This configures Cursor’s native `beforeSubmitPrompt` event in `~/.cursor/hooks.json`. Restart Cursor if the change is not picked up. Open local **Agent Chat**, submit the synthetic customer ID, and confirm the block before relying on the integration. Check Cursor’s Hooks output for setup issues. Run `promptveil uninstall cursor --apply` to remove the entry. This installer targets the local user configuration. For other editors, use the CLI or PWA to protect text before pasting. [Cursor hook configuration and protocol](https://cursor.com/docs/hooks)

### Gemini CLI

```sh
promptveil install gemini
promptveil install gemini --apply
promptveil doctor gemini
```

The installer adds a `BeforeAgent` hook to `~/.gemini/settings.json` or the `.gemini` folder under `GEMINI_CLI_HOME`. Restart Gemini CLI and submit `ACME_API_KEY=fixture-never-valid` to check that the guard stops the turn. Use `promptveil uninstall gemini --apply` to remove the hook. Gemini CLI protocol and installer fixtures passed. Live Gemini CLI verification is pending. [Gemini CLI hook reference](https://geminicli.com/docs/hooks/reference/#beforeagent)

The browser, CLI, hooks, and relay share a local scanner. Coverage includes known credential signatures, labeled credentials and authorization headers, and supported PII such as labeled names, street addresses, dates of birth, SSNs, and customer IDs. Native hooks cover the prompt text delivered by the host. For agents without an integration, run the text through `promptveil protect --strict` before entering it in the agent. Unlabeled custom secrets, context-dependent PII, and data sent outside the guarded path can escape detection. [Threat model](docs/threat-model.md)

## Run local verification

Install the repository’s pinned development tools with `corepack pnpm install --frozen-lockfile` on a Node installation that provides Corepack, or use pnpm **10.11.0** directly. The static website preview has no package install step.

```bash
npm run typecheck
npm test
npm run test:security
npm run eval
npm run build
npm run release:check
node tests/e2e/native.mjs claude-code codex
node tests/e2e/codex.mjs
```

The native smoke test requires both local clients. Pass `claude-code` or `codex` alone to test just one. GitHub Actions runs the packaged Playwright browser tests and pinned Codex relay smoke test. To run the packaged browser smoke on macOS or Linux, build first, then install the same pinned Playwright used by CI in a temporary directory:

```bash
browser_tools="$(mktemp -d)"
npm install --ignore-scripts --no-audit --no-fund --no-package-lock --prefix "$browser_tools" playwright@1.60.0
node "$browser_tools/node_modules/playwright/cli.js" install chromium
BROWSER_MODULE="$browser_tools/node_modules/playwright/index.mjs" node tests/e2e/browser.mjs
```

See the [testing guide](docs/testing.md) and [CI workflow](.github/workflows/ci.yml) for exact automation commands. Review the [synthetic evaluation method](eval/README.md) before citing accuracy metrics.

## CI and security

| Workflow | Checks |
| --- | --- |
| Verify | Typecheck, link and workflow checks, cross-platform CLI tests, synthetic agent and browser checks, evaluation, artifact checksums, and a clean packaged install. |
| Verify / security | Privacy regressions for paste, Send, PWA worker, and the relay. Gitleaks scans repository history with redacted output, dependency review checks PR changes, and OSV-Scanner audits the full pnpm lockfile. |
| Code scanning | CodeQL analyzes JavaScript and TypeScript, Python packaging code, and GitHub Actions. Results go to the Security tab. |
| Runtime compatibility canary | Scheduled Node 22 and 24 runtime checks. |
| Tagged release | Re-runs Verify, builds from a matching SemVer tag, attests the three release archives, then verifies checksums and provenance before publishing. |

Dependabot proposes updates to package dependencies and SHA-pinned Actions. Generated release notes group changes by PR label. GitHub repository rules, required code scanning, and private vulnerability reporting are configured in repository settings. [Security policy](SECURITY.md) · [Release and repository setup](docs/releasing.md)

## Deploy the website to Vercel

Import the repo root into Vercel and use Node.js **22 or later**. [The project config](vercel.json) runs `npm run build:web` and serves `dist/web` as static files. Prompt scanning runs on the user’s device. Set `GITHUB_REPOSITORY` to `owner/repo` if GitHub repository metadata is unavailable at build time. See the [deployment and release guide](docs/releasing.md). [Vercel static build configuration](https://vercel.com/docs/builds/configure-a-build)

## Repository layout and contributing

| Directory | Contents |
| --- | --- |
| `apps/` | Landing page and PWA, browser extension, CLI, and local gateway |
| `packages/` | Shared detector, contracts, and composer UI |
| `adapters/` | Claude Code, Codex, Cursor, and Gemini hook contracts |
| `.github/` | Verification, code scanning, dependency updates, and tagged release workflows |
| `tests/` and `eval/` | Synthetic verification, integration harnesses, and evaluation |
| `docs/` and `evidence/` | Installation, architecture, security boundaries, compatibility, and Codex Challenge records |

[Documentation index](docs/README.md) · [Contributing](CONTRIBUTING.md) · [Security reporting](SECURITY.md) · [Codex Evidence Pack](evidence/README.md) · [Apache-2.0 license](LICENSE) · [Third-party notices](NOTICE)
