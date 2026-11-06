# Security policy

Security fixes target the latest published release and the current development branch. There is no commitment to maintain older release lines or provide a fixed response time.

## Report a vulnerability privately

Use **Security → Report a vulnerability** in the [GitHub repository](https://github.com/cikorsky/ireadfolio/security) when private vulnerability reporting is available. If the private-reporting entry is unavailable, open a public issue asking the maintainer for a private contact channel; omit exploit details and sensitive data until a private channel is established.

Do not put passwords, WebDAV credentials, session cookies, private articles, working access links, or complete browser-storage exports in public issues. Include the affected version, browser version, a minimal synthetic reproduction, impact, and any proposed fix through the private channel.

## Relevant boundaries

- Web pages are untrusted. Extraction, imported HTML, SVG, selectors, backup JSON, and WebDAV XML require validation.
- The reading interface uses an extension-origin frame and same-tab session checks. An ordinary page must not gain access to saved articles, annotations, or WebDAV credentials through extension messages.
- Next-page HTML is limited to the article origin. Image fetching and WebDAV requests have explicit origin, redirect, type, and size checks.
- WebDAV credentials are stored locally and are excluded from article backups. Backup JSON itself is not encrypted by the extension.

Local storage is not a secrets vault. People or software with access to the browser profile may be able to read its contents. See [Privacy](docs/PRIVACY.md) for expected storage and network behavior.

Passing automated checks does not establish that the extension is free of vulnerabilities. Please report suspected boundary violations even when the test suite passes.
