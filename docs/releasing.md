# Release and deployment

1. Require passing fixture, browser, agent, evaluation, packaging, and security checks on the release commit. Review the [compatibility matrix](compatibility.md) and [submission checklist](../evidence/submission-checklist.md).
2. Complete the physical-device mobile checks, desktop browser and provider-site checks, native agent checks, and live Codex relay acceptance using synthetic inputs.
3. Publish from the protected version tag. Attach the extension ZIP, CLI tarball, static site ZIP, SHA-256 sums, attribution, compatibility, and evaluation results to GitHub Releases. The workflow attests the archives and verifies that the attestations match this repository, workflow, tag, and source commit before publication.
4. Deploy the site artifact with GitHub Pages and publish the PWA and demo links in release notes. Load the site, release, and evidence URLs signed out and validate the install links.
5. Keep the previous passing tagged artifact available. To roll back, deploy that artifact again and document the affected release and follow-up.

Run the packaging verification locally before pushing a release tag. Set the GitHub Pages build source to GitHub Actions. Protect version tags and configure the `release` and `github-pages` environments with allowed refs and approvers. Dispatch the workflow with `gh workflow run release.yml --ref v0.1.0 -f manual_checks_complete=true`. The workflow checks that the tag points to work on `main`, runs reusable CI, then publishes and deploys. Keep provider credentials out of fork CI, artifact paths, mock requests, and challenge records. [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) · [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)

## Repository setup

- Enable private vulnerability reporting, Dependabot alerts, and the dependency graph. Use the checked-in CodeQL workflow as the advanced code scanning setup.
- Protect `main` with required Verify jobs and a code scanning rule for CodeQL. Protect tags matching `v*` against unauthorized creation or replacement. The release workflow accepts `vMAJOR.MINOR.PATCH` tags that match the version in `package.json`.
- Use PR labels `security`, `privacy`, `enhancement`, `bug`, `documentation`, and `dependencies` for generated release categories. Use `skip-changelog` for PRs that should be omitted. Suggested repository topics are `privacy`, `redaction`, `pii`, `chrome-extension`, `pwa`, `cli`, and `typescript`.

[Code scanning rules](https://docs.github.com/en/code-security/concepts/vulnerability-reporting-and-management/vulnerability-exposure) · [Generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)

## Verify a downloaded release

From the directory with the downloaded assets, verify SHA-256 checksums. Set `release_repo` to the published GitHub repository and `release_tag` to the version you downloaded.

```sh
shasum -a 256 -c SHA256SUMS
gh attestation verify extension.zip --repo "$release_repo" \
  --signer-workflow "$release_repo/.github/workflows/release.yml" \
  --source-ref "refs/tags/$release_tag"
```

Repeat the attestation check for the site ZIP and CLI tarball. [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations) · [GitHub CLI verification](https://cli.github.com/manual/gh_attestation_verify)

## Vercel website deployment

Import the repository with its root as the project directory and select Node.js 22 or later. The root [Vercel configuration](../vercel.json) runs `npm run build:web` and publishes `dist/web` as static files. This build has no package install step. For links to GitHub and its releases, enable Vercel system environment variables for a GitHub-connected project or set `GITHUB_REPOSITORY` to the GitHub owner and repository name. [Vercel static configuration](https://vercel.com/docs/project-configuration/vercel-json)

## Browser stores

The README documents the verified build inputs, listings, target-specific port requirements, and public installation steps. Store submissions follow the respective store review and release process. [Browser publication guide](../README.md#publish-the-extension)
