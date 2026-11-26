# Reporting a vulnerability

Use the private **Report a vulnerability** action in the repository's GitHub Security tab after maintainers enable private reporting. If it is unavailable, ask the maintainers for a private contact before sharing details.

Include the version, affected workflow, expected behavior, impact, and a minimal synthetic reproduction. Keep live credentials and personal data out of reports. For the intended protection scope, see the [threat model](docs/threat-model.md).

PromptVeil is in prerelease. Security fixes are developed on `main` and included in subsequent tagged releases. Independent vulnerability reports are welcome for all shipped surfaces.

The project runs privacy regression tests, repository secret scanning, dependency review, and CodeQL. Tagged builds attest the downloadable archives. See the [CI and security overview](README.md#ci-and-security) and [release verification instructions](docs/releasing.md#verify-a-downloaded-release).
