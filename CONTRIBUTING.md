# Contributing to iReadFolio

Bug reports, reproducible site-compatibility cases, documentation fixes, and focused pull requests are welcome. The current interface is primarily Chinese; issues and pull requests may be written in Chinese or English.

## Set up

Use Node.js 22 and npm:

```sh
npm ci
npm run check
npx playwright install chromium
npm run e2e
node scripts/toolbar-e2e.mjs
```

On Linux, browser system dependencies can be installed with `npx playwright install --with-deps chromium`. Use `CHROMIUM_PATH` only when you deliberately need a compatible alternate executable. Browser tests must use disposable profiles, synthetic articles, and local test services.

`npm run dev` previews a sample page. For extension APIs, build and load `dist/chrome` or temporarily load `dist/firefox/manifest.json` as described in the README.

## Propose a change

1. Describe the concrete problem or user-visible result. For site extraction, include a public URL and minimal steps when the page can be shared.
2. Keep changes focused and follow existing TypeScript, React, and ESLint conventions. Discuss new dependencies or substantial data-format changes before implementing them.
3. Add focused regression coverage when behavior changes. Verify the actual downloaded artifact for export changes; an XML assertion alone does not prove Word layout quality.
4. Run checks relevant to the change. Explain any checks that cannot run and distinguish mocked API behavior from real browser results.
5. Summarize the problem, resulting behavior, and validation in the pull request. Retain third-party copyright and license notices.

Storage keys, record IDs, backup schemas, style IDs, WebDAV version naming, and browser extension IDs affect compatibility. Propose explicit migrations and test existing-data behavior before changing them. Never clear user data to make a migration or test pass.

## Keep submissions safe to publish

Do not commit credentials, cookies, access tokens, private documents, browser profiles, full browser-storage snapshots, or screenshots containing personal information. Remove URL query parameters that grant access to non-public content. Use synthetic fixtures instead of copying paywalled or copyrighted page assets.

Do not add private service endpoints, telemetry, or automatic uploads as an incidental change. Explain new permission or network behavior in the pull request and privacy documentation. Security vulnerabilities should follow [SECURITY.md](SECURITY.md), not a public bug report.

## Licensing

Contribute only material you are authorized to submit. By intentionally submitting a contribution for inclusion, you agree to license that contribution under this project's Apache-2.0 terms. Identify any third-party code or asset, its upstream source, and its license. The project license does not override third-party license obligations or grant rights to unrelated trademarks.
