# Product Overview

## What this is

`@postpulse/n8n-nodes-postpulse` — the official **n8n community node** for
[PostPulse](https://post-pulse.com), a social media management (SMM) service.
It lets n8n workflows upload media and schedule/publish posts to multiple
social networks through the PostPulse public API.

It is a *library package*, not an application: n8n loads the compiled
`dist/` bundle as a community node.

## Audience

n8n users and automation builders who already have a PostPulse account with
connected social accounts and want to drive publishing from workflows
(campaign automation, content pipelines, cross-posting).

## Supported destinations

Facebook, Instagram, TikTok, YouTube, Threads, LinkedIn, Telegram,
X (Twitter), Bluesky.

## Node surface

One node — **PostPulse** (`postPulse`, group `transform`, version 1) — with
three resources:

| Resource | Operation | Value | What it does |
|---|---|---|---|
| Account | Get Many | `getAll` | List connected social accounts (`GET /v1/accounts`) |
| Account | Get Connected Chats | `getConnectedChats` | Telegram channels / Facebook pages for an account |
| Media | Upload | `upload` | Upload a binary file *or* import from a public URL |
| Media | Get Upload Status | `getUploadStatus` | Poll a URL-import job |
| Post | Schedule | `schedule` | Full-power scheduling: many publications, raw `platformSettings` JSON |
| Post | Schedule (Light) | `scheduleLight` | Guided single-account UI, `platformSettings` built for the user |

Credential: **PostPulse OAuth2 API** (`postPulseOAuth2Api`), extends n8n's
built-in `oAuth2Api` so tokens refresh automatically.

## Two scheduling modes — why both exist

- **Schedule (Light)** — the recommended path. One account picked from a
  dropdown, platform-specific fields appear dynamically, `platformSettings`
  is assembled in code, `isDraft` is always `false`.
- **Schedule** — the advanced path. The user builds `publications[]` by hand
  (multiple accounts, multiple posts per publication, hand-written
  `platformSettings` JSON, `isDraft` toggle).

## Typical workflow

1. *(optional)* **Account → Get Many** to find account IDs.
2. **Media → Upload** — returns `{ path }` (file upload, or URL import with
   *Wait for Completion* on). Without waiting: `{ id, state }`, then poll via
   **Media → Get Upload Status**.
3. **Post → Schedule (Light)** or **Post → Schedule** with those paths in
   `attachmentPaths`.

## Known product limits (v1)

- No update/delete post operations — only create. Drafts can be created but
  not edited from the node; README recommends `isDraft: false`.
- **No client-side content validation.** Per-platform limits (character
  counts, media formats/sizes/durations, attachment counts) are enforced by
  PostPulse Web but *not* by the API or this node — the full matrix lives in
  README.md → "Media & text validations".
- `thumbnailPath` is accepted by the advanced Schedule form but marked
  "coming soon" in the API docs.
- Webhooks (post status, media import progress) exist on the PostPulse side
  and are configured in the Developer Portal — the node has **no trigger
  node**, so webhook consumption uses a plain n8n Webhook node.

## External links

- Developer portal / OAuth clients: https://developers.post-pulse.com
- App: https://post-pulse.com/app/accounts
- Releases: https://post-pulse.com/releases
- Support: support@post-pulse.com, Discord https://discord.gg/yrMdD4R5
