# Tech Details

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.8, `strict: true`, target ES2019, CommonJS |
| Runtime contract | n8n community node, `n8nNodesApiVersion: 1` |
| Peer dependency | `n8n-workflow ^2.10.0` (the **only** runtime dep — see steerings) |
| Node.js | `>=20.15` |
| Build | `tsc` → `dist/`, then `gulp build:icons` copies `*.svg`/`*.png` |
| Lint | ESLint 8 + `eslint-plugin-n8n-nodes-base` |
| Format | Prettier — tabs, width 2, single quotes, trailing commas, semicolons |
| CI/CD | GitHub Actions → npm Trusted Publishing (OIDC) |
| VCS | Git, single `master` branch, no feature branches |

## Layout

```
credentials/
  PostPulseOAuth2Api.credentials.ts   OAuth2 credential (extends oAuth2Api)
  postpulse.svg                       credential icon
nodes/PostPulse/
  PostPulse.node.ts                   INodeType: description (UI schema) + loadOptions + execute()
  PostPulse.node.json                 codex metadata (categories, docs URL)
  postpulse.svg                       node icon
  helpers/ApiHelper.ts                makeApiRequest / makeApiRequestWithFormData
  resources/AccountResource.ts        executeAccountOperation
  resources/MediaResource.ts          executeMediaOperation
  resources/PostResource.ts           executePostOperation
index.js                              empty; `main` entry, n8n loads dist/ paths from package.json "n8n"
```

`package.json → n8n` points at `dist/credentials/PostPulseOAuth2Api.credentials.js`
and `dist/nodes/PostPulse/PostPulse.node.js`. Only `dist` is published (`files`).

## Architecture

**Thin dispatcher + resource modules.**

`PostPulse.node.ts` holds the whole declarative UI (`description.properties`)
and an `execute()` that loops input items and dispatches on
`resource` → `executeXxxOperation.call(this, operation, itemIndex)`.
Each resource module dispatches again on `operation` and throws
`NodeOperationError` for unknown ones. All of them go through
`makeApiRequest` in `helpers/ApiHelper.ts`.

Adding an operation therefore touches three places: the `operation` options
list, the field definitions (guarded by `displayOptions.show`), and the
resource module's dispatch.

### Error handling

- `makeApiRequest` sets `returnFullResponse: true` and manually raises
  `NodeApiError` for `statusCode >= 400`, so the API's error body reaches the
  user instead of a generic message (added in 0.2.1 / 0.2.3).
- `execute()` honours `this.continueOnFail()` — pushes `{ error: message }`
  per item instead of throwing.
- `loadOptions` methods deliberately let errors propagate (an n8n review
  finding in 0.2.5: never silently `return []`).

### Authentication

`postPulseOAuth2Api` extends `oAuth2Api`; every field is `type: 'hidden'`
(authUrl, accessTokenUrl, scope, audience query param, `authentication: 'body'`,
`baseUrl`). The user supplies only Client ID / Secret. Requests are signed via
`this.helpers.httpRequestWithAuthentication.call(this, 'postPulseOAuth2Api', …)`
— never a hand-built `Authorization` header.

- Auth host: `https://auth.post-pulse.com` (`/authorize`, `/oauth/token`)
- API host: `https://api.post-pulse.com` (overridable via the hidden `baseUrl`
  credential field; `makeApiRequest` strips trailing slashes and falls back to
  the default)
- Scopes: `openid profile email offline_access` +
  `postpulse-api/{accounts.read,api,media.write,posts.read,posts.write}`
- `audience=https://api.post-pulse.com` passed as `authQueryParameters`
- Credential test: `GET /v1/accounts`

## API endpoints used

| Method | Endpoint | Used by |
|---|---|---|
| GET | `/v1/accounts` | Account → Get Many, `getAccounts` loadOptions, credential test |
| GET | `/v1/accounts/{id}/chats?platform=` | Get Connected Chats, `getConnectedChats` loadOptions |
| POST | `/v1/media/upload/urls` | file upload step 1 — presigned URL |
| *(presigned)* | `PUT` to S3 URL | file upload step 2 — raw buffer, plain `httpRequest` (unauthenticated) |
| POST | `/v1/media/upload/confirm` | file upload step 3 — integrity confirm |
| POST | `/v1/media/upload/import` | URL import |
| GET | `/v1/media/upload/import/{id}` | import status polling / Get Upload Status |
| POST | `/v1/posts` | both Schedule operations |

## Notable implementation details

- **Media file upload is a 3-step flow** (presign → direct PUT → confirm).
  The binary body is read with `this.helpers.getBinaryDataBuffer`; `Buffer`
  construction is avoided because n8n's community rules disallow it (0.1.5).
  The response is normalised to `{ path: key }` for backward compatibility.
- **URL import polling** uses `sleep()` from `n8n-workflow`, `pollingInterval`
  (default 2s) and `maxWaitTime` (default 120s) →
  `maxAttempts = ceil(max/interval)`. Terminal states: `READY` (returns
  `{ path: s3Key }`), `FAILED_TEMPORARY`, `FAILED_PERMANENT`; otherwise it
  times out with an explicit message. States seen: `QUEUED`, `DOWNLOADING`,
  `VALIDATING`, `UPLOADING`, `READY`, `FAILED_*`.
- **Account dropdown encodes two values in one option**: `getAccounts` returns
  `value: "${platform}|${id}"`. A hidden `platform` parameter re-derives the
  platform with an expression (`socialMediaAccount.split("|")[0]`) so that
  `displayOptions.show.platform` can reveal platform-specific fields, and
  `scheduleLight` splits the string again at execution time.
- **Platform name ≠ API enum**: `TIKTOK → TIK_TOK`, `X_TWITTER → TWITTER`.
  Mapped in `schedulePostLight`.
- **Platform-specific fields in Light mode**: Instagram/Facebook →
  `publicationType` (FEED/REELS/STORY); YouTube/TikTok → `title` (TikTok also
  forces `hasUsageConfirmation: true`); Threads → optional `topicTag`;
  Facebook/Telegram → `chatId` from the chats dropdown. Everything else sends
  only `{ type }`.
- **Scheduling**: `scheduleMode` `now` omits `scheduledTime` entirely;
  `scheduled` sends `new Date(value).toISOString()`. The UI carries a `notice`
  warning that the value is read in the *workflow* timezone.
- **Empty values are stripped** before building the request body (content,
  chatId, thumbnailPath, blank attachment paths, `{}` platformSettings) — the
  API rejects empty strings.
- `makeApiRequestWithFormData` exists in `ApiHelper.ts` but is currently
  **unused** (leftover from the pre-presigned-URL upload flow).

## Build & release

```bash
npm run build      # rimraf dist && tsc && gulp build:icons
npm run dev        # tsc --watch
npm run lint       # eslint nodes credentials package.json
npm run lintfix
npm run format     # prettier --write
```

`prepublishOnly` runs build + lint with `.eslintrc.prepublish.js` (which turns
the "package name still default" rule into an error).

Release: bump `version` in `package.json`, commit, tag `vX.Y.Z`, push the tag.
`.github/workflows/publish.yml` checks that the tag matches `package.json`,
builds, lints and runs `npm publish --provenance --access public`.
Auth is GitHub OIDC + npm Trusted Publisher — **no `NPM_TOKEN` secret**;
requires npm >= 11.5.1, hence the `npm install -g npm@latest` step.

## No test suite

There are no unit or integration tests and no test tooling in
`devDependencies`. Verification today = `npm run lint` + `npm run build` +
manual testing inside a local n8n instance.

## Local n8n instance (manual testing)

Set up on 2026-09-03 on the Windows dev machine. n8n `2.37.7` is installed
globally (`npm install -g n8n`; it requires Node >= 24, local Node is 24.11).

The package is exposed to n8n through the custom-extensions folder as a
**directory junction**, not `npm link`:

```
C:\Users\Legion\.n8n\custom\node_modules\n8n-nodes-postpulse
    -> D:\PostPulse\n8n-postpulse-node
```

`CustomDirectoryLoader` globs `**/*.node.js` / `**/*.credentials.js` under
`~/.n8n/custom` and follows symlinks, so it picks up `dist/`. The node
registers as **`CUSTOM.postPulse`**, the credential as `postPulseOAuth2Api`.

Why a junction instead of `npm link`: hot reload walks the *top-level* entries
of `custom/node_modules` and watches their `realpath`. With the scoped
`@postpulse/...` link the top-level entry is the scope folder, so the repo path
never gets watched. With the flat junction n8n watches
`D:\PostPulse\n8n-postpulse-node` and reloads on every `dist` write.

Start with `scripts/start-n8n.ps1` (build + `n8n start`). Hot reload needs
**both** `NODE_ENV=development` and `N8N_DEV_RELOAD=true` — the script sets
them. Editor: http://localhost:5678, owner account `leo.welch.rex@gmail.com`.
Instance data (SQLite DB, encryption key) lives in `C:\Users\Legion\.n8n`.

For OAuth2 the credential's redirect URL is
`http://localhost:5678/rest/oauth2-credential/callback` — it must be whitelisted
in the PostPulse OAuth client for local testing to complete the flow.
