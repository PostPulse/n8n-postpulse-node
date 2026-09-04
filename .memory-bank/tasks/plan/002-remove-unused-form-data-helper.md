# 002 — Remove dead `makeApiRequestWithFormData` helper

- **Type**: Cleanup / dead code
- **Severity**: Low — no runtime effect
- **Status**: Not started
- **Found**: 2026-09-02, during memory-bank codebase analysis

## Problem

`nodes/PostPulse/helpers/ApiHelper.ts:52` exports
`makeApiRequestWithFormData`. It has **no callers** anywhere in `nodes/` or
`credentials/`.

It is a leftover from the pre-presigned-URL upload flow: it posts
`application/x-www-form-urlencoded` and hand-parses a possibly-string
response. Media upload now goes through the three-step presigned flow
(`/v1/media/upload/urls` → direct `PUT` to S3 → `/v1/media/upload/confirm`),
introduced in `0.1.9` (32d1b81).

Keeping it is actively misleading: it suggests a form-encoded upload path
that no longer exists, and it does not follow the current error convention
(no `returnFullResponse`, no manual `statusCode >= 400` check → an API error
body would not surface the way `makeApiRequest` makes it surface).

## Subtasks

1. Delete the `makeApiRequestWithFormData` function from `ApiHelper.ts`.
2. Drop the now-unused `IHttpRequestOptions` / other imports if nothing else
   in the file needs them (`noUnusedLocals` is on, so `tsc` will point them
   out).
3. `npm run lint` + `npm run build`.

## Notes

Safe to remove: only `dist/` is published and this symbol is not part of the
node's public contract — n8n loads the node class and the credential class,
not the helper module.

If a form-encoded request is ever needed again, reimplement it on top of the
current `makeApiRequest` conventions (`NodeApiError`, `returnFullResponse`)
rather than restoring this version.
