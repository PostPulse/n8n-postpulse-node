# Steerings — conventions & constraints

Rules derived from the codebase, the n8n community-node review process and
past commits. Break them only with a reason.

## Language & style

- **All code, comments, commit messages and identifiers in English.**
- Tabs for indentation, single quotes, semicolons, trailing commas
  (`.prettierrc.js` / `.editorconfig`). Run `npm run format` before commit.
- TypeScript `strict` is on plus `noUnusedLocals`, `noImplicitReturns`,
  `noImplicitAny` — dead locals break the build.

## n8n community-node rules (the hard ones)

`eslint-plugin-n8n-nodes-base` is the gatekeeper — `npm run lint` must pass,
and it runs again in CI and in `prepublishOnly`. Learned the hard way in the
n8n verification reviews (0.1.12, 0.1.13, 0.2.5):

- **Zero runtime dependencies.** `n8n-workflow` is a *peer* dependency;
  `dependencies` is empty. Luxon was removed in 0.2.5 for exactly this reason —
  use native `Date`/`Intl` instead of pulling a date library.
- **Do not construct `Buffer`** (removed in 0.1.5). Use
  `this.helpers.getBinaryDataBuffer()`.
- **Always use `NodeApiError` / `NodeOperationError`**, never bare `throw` or
  `Error`, and pass `{ itemIndex }` where available.
- **Never swallow errors in `loadOptions`** — let them surface to the user.
- Display names are Title Case; option names Title Case, values `camelCase`
  or `SCREAMING_SNAKE` enums; a "get many" operation must be named
  `Get Many` / `getAll`.
- `description` strings must not end with a period and should be full
  sentences; dropdown fields loaded via `loadOptionsMethod` must be named
  `... Name or ID` and carry the standard "Choose from the list, or specify an
  ID using an expression" description.
- Icons must be **SVG** (`file:postpulse.svg`), present for both node and
  credential, and copied into `dist/` by the gulp task.
- `PostPulse.node.json` (codex) must have correct `categories`, a matching
  node id (`@postpulse/n8n-nodes-postpulse.postPulse`) and `codexVersion`.

## Credentials & secrets

- All endpoint/scope/audience config lives in the credential as `hidden`
  fields. The user only ever enters Client ID and Secret.
- Sign requests exclusively with
  `this.helpers.httpRequestWithAuthentication.call(this, 'postPulseOAuth2Api', …)`.
  Never hand-roll `Authorization` headers, and never re-add the old
  `x-api-key` injection (removed in 0.2.5).
- No secrets, tokens, client IDs or account IDs in the repo, in fixtures, or
  in commit messages.

## Adding a resource or operation

1. Add the operation to the `operation` options list for that resource in
   `PostPulse.node.ts`.
2. Add fields with a `displayOptions.show` guard on **both** `resource` and
   `operation` (and `platform` when it is Light-mode platform-specific).
3. Implement it in the matching `resources/*Resource.ts`, dispatching on the
   operation string and ending with a `NodeOperationError` for unknown values.
4. Go through `makeApiRequest` — do not call `httpRequest` directly except for
   the presigned-S3 PUT, which must stay unauthenticated.
5. Strip empty/blank values before sending; the API rejects empty strings.

## Request-body discipline

- Omit `scheduledTime` entirely for "Post Now" — do not send `null`.
- Omit `platformSettings` when it parses to `{}`.
- Filter blank strings out of `attachmentPaths`.
- Keep the `{ path }` response shape for every media upload variant; workflows
  depend on it.

## Backward compatibility

Published to npm and consumed by live n8n workflows. Renaming a parameter,
changing an option `value`, or changing an output shape breaks existing
workflows — prefer adding a new field with a safe default and guarding it with
`displayOptions`. Node `version` stays `1` until a real breaking redesign.

## Release discipline

- Semantic Versioning. Version bump and the changes ship in the same commit;
  commit subjects follow `X.Y.Z: Summary` (or Conventional Commits for CI-only
  changes, e.g. `ci: …`).
- The npm workflow **fails** if the git tag does not match `package.json`
  version — bump first, then tag `vX.Y.Z`.
- Single `master` branch, no feature branches.

## Documentation

`README.md` is the user-facing contract (data model, `platformSettings`
schemas, per-platform validation matrix, examples). Any new operation, field
or response shape must be reflected there in the same change.

## Testing

There is no automated test suite. Definition of done for a change:
`npm run lint` clean, `npm run build` clean, and the operation exercised
manually in a local n8n instance against the real API.
