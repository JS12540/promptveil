# Quick start

Scan a prompt in the private composer or run the site on your computer. The local preview requires Node.js 22.18 or later and npm. For a Git checkout, install Git. You can also extract a source ZIP and open the folder that contains `package.json`.

## Run on your computer

```sh
git clone https://github.com/JS12540/promptveil.git
cd promptveil
npm run dev
```

In Windows PowerShell, use `npm.cmd run dev` if PowerShell blocks the npm script shim. Open `http://127.0.0.1:8000/` and select **Open PromptVeil**. Stop the preview with Ctrl+C. Restart it after editing source files.

## Scan your first prompt

Paste this fictional customer-support request into the composer.

```text
Draft a friendly reply to a customer whose package arrived damaged. Customer ID: 48372651. Email: maya.patel@example.com. Offer a replacement or a $48 refund.
```

1. Select **Scan prompt**.
2. Review **Protected text**. The scanner replaces the customer ID and email with session placeholders and keeps the $48 refund.
3. Select **Copy protected text** and paste the reviewed draft into your AI tool.
4. To try offline scanning, wait for **Ready to scan offline**, stop the local preview, and reload the already-open composer in the same browser profile.

## Continue with your setup

- [Install on a laptop or phone](install.md)
- [Protect text from the terminal](cli.md)
- [Set up a coding-agent guard](agents.md)
- [Build and verify the project](testing.md)
