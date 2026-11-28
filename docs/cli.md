# Command-line reference

The CLI reads text from standard input or a local file and runs the scanner on your device. Use Node.js 22.18 or later. You can run the source CLI directly or install a built package.

## Run from source

From the repository root, check that the command starts.

```sh
node apps/cli/index.ts --help
```

On macOS or Linux:

```sh
printf '%s\n' 'Draft a friendly reply to a customer whose package arrived damaged. Customer ID: 48372651. Email: maya.patel@example.com. Offer a replacement or a $48 refund.' | node apps/cli/index.ts protect
```

On Windows PowerShell:

```powershell
'Draft a friendly reply to a customer whose package arrived damaged. Customer ID: 48372651. Email: maya.patel@example.com. Offer a replacement or a $48 refund.' | node apps/cli/index.ts protect
```

The protected text keeps the support request and refund and replaces the fictional ID and email.

## Install the CLI package

Build with Node.js and Python 3 using `npm run build`, then use the generated tarball. If you downloaded a release tarball, substitute its path.

```sh
npm install -g ./dist/cli/promptveil-0.1.0.tgz
promptveil --help
```

## Inspect a local file

Create `sample.txt` with the fictional prompt above. Use the following command to print finding types and offsets without detected values.

```sh
promptveil scan --file ./sample.txt --json
```

| Exit code | Meaning |
| --- | --- |
| 0 | The operation succeeded. |
| 2 | Protection blocked the input or a finding needs review. |
| 3 | Processing failed. |

Remove installed [coding-agent hooks](agents.md) before running `npm uninstall -g promptveil`.
