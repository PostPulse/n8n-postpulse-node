# n8n-postpulse-node - Memory Bank

## Quick Links

- [Product Overview](./product-overview/README.md)
- [Steerings](./steerings/README.md)
- [Tech Details](./tech-details/README.md)
- [Tasks](./tasks/README.md)

## Project Summary

`@postpulse/n8n-nodes-postpulse` — the official **n8n community node** for
[PostPulse](https://post-pulse.com). It lets n8n workflows list connected
social accounts, upload media, and schedule or immediately publish posts to
Facebook, Instagram, TikTok, YouTube, Threads, LinkedIn, Telegram, X and
Bluesky through the PostPulse API, authenticated with OAuth2.

Published to npm; only the compiled `dist/` is shipped.

## Current Status

- **Phase**: Active Development
- **Version**: 0.2.5 (pre-1.0; `package.json` is the source of truth)
- **Last Updated**: 2026-09-02
- **Branch**: `master` (single branch, no feature branches)
- **Recent work**: npm Trusted Publishing (OIDC) CI; addressing n8n
  verification feedback (0.2.5); "Post now" mode and URL-import waiting (0.2.4)

## Key Architecture

- **Entry point**: `nodes/PostPulse/PostPulse.node.ts` — the whole node UI
  schema (`description.properties`), `loadOptions`, and an `execute()` that
  dispatches per input item on `resource`
- **Dispatch layer**: `nodes/PostPulse/resources/{Account,Media,Post}Resource.ts`
  — one `executeXxxOperation(operation, itemIndex)` each
- **HTTP layer**: `nodes/PostPulse/helpers/ApiHelper.ts` — `makeApiRequest`,
  OAuth2 via `httpRequestWithAuthentication`, `NodeApiError` on 4xx/5xx
- **Credential**: `credentials/PostPulseOAuth2Api.credentials.ts` — extends
  n8n's `oAuth2Api`, all endpoints/scopes are hidden fields
- **Loading**: `package.json → "n8n"` points n8n at the built
  `dist/nodes/PostPulse/PostPulse.node.js` and the built credential;
  `index.js` is intentionally empty

## Tech Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.8 (strict, CommonJS, ES2019) |
| Platform | n8n community node, `n8nNodesApiVersion: 1` |
| Runtime deps | none — `n8n-workflow ^2.10.0` is a peer dependency |
| Node.js | >= 20.15 |
| Build | `tsc` + `gulp build:icons` → `dist/` |
| Lint / format | ESLint 8 + `eslint-plugin-n8n-nodes-base`, Prettier (tabs, single quotes) |
| Tests | none (lint + build + manual n8n run) |
| CI/CD | GitHub Actions on `v*.*.*` tags → npm Trusted Publishing (OIDC), provenance |
| API | PostPulse REST `https://api.post-pulse.com/v1`, OAuth2 via `auth.post-pulse.com` |
| VCS | Git, single `master` branch |
