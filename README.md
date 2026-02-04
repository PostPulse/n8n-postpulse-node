# PostPulse n8n Node

> **Official n8n integration for [PostPulse](https://post-pulse.com)** — schedule and publish content to multiple social networks from your n8n workflows.

- **Auth:** OAuth2 (auto refresh) 
- **Core actions:** Accounts → Media Upload → Schedule Post(s) (+ Telegram Channels / Facebook Pages lookup)  
- **Targets today:** Facebook, Instagram, TikTok, YouTube, Threads, LinkedIn, Telegram, X, Bluesky  
- **Use cases:** One-click multi-destination posting, media pipeline, automated campaigns

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Install](#install)
- [Authenticate](#authenticate)
- [Quick start](#quick-start)
- [Operations](#operations)
- [Data model](#data-model)
- [Platform settings](#platform-settings)
- [Media & text validations](#media--text-validations)
- [Rate limits & API keys](#rate-limits--api-keys)
- [Webhooks](#webhooks)
- [Examples](#examples)
- [FAQ](#faq)
- [Support](#support)
- [Versioning & License](#versioning--license)

---

## Prerequisites

1. **Sign up** at https://post-pulse.com/login  
2. **Connect your social accounts** in the web app: https://post-pulse.com/app/accounts  
3. **Create OAuth client**: Visit https://developers.post-pulse.com and sign in using the email associated with your PostPulse account. Create a new OAuth client to obtain `client_id` and `client_secret`.
4. (Telegram only) Add the official **PostPulse bot** to your channels you plan to post to.

> Use the same email in n8n OAuth as your PostPulse account email.

---

## Install

- **From npm (recommended):**
  ```bash
  npm install @postpulse/n8n-nodes-postpulse
  ```

---

## Authenticate

Create **Credentials → PostPulse OAuth2 API** in n8n:

- **OAuth Redirect URL:** Use this URL when creating your OAuth client at https://developers.post-pulse.com
- **Client ID / Secret:** Obtained from the developer portal at https://developers.post-pulse.com

This node extends n8n’s `oAuth2Api` so **tokens are refreshed automatically**.  

---

## Quick start

### Using Schedule (Light) - Recommended for simple workflows

1. **Media → Upload** *(if posting media)*
   - **From File**: Upload binary file data
     - Returns: `{ path }` — use this directly in attachment paths
   - **From Public URL**: Import media from a URL
     - Returns: `{ id, state }` 
     - Then use **Media → Get Upload Status** with the `id` to monitor progress
     - Wait until `state` is `READY`, then use the `s3Key` value in attachment paths
2. **Posts → Schedule (Light)**
   - Select your connected account from the dropdown (accounts loaded automatically)
   - UI automatically shows platform-specific fields (e.g., Instagram: Publication Type)
   - Facebook and Telegram accounts: select Page/Channel from dropdowns (loaded automatically)
   - Enter content and comma-separated attachment paths
   - Set scheduled time and execute!

### Using Schedule - Advanced workflows

For multi-account posting or complex scenarios:

1. **Accounts → Get Many**  
   Retrieve your connected accounts. Save the `id` of targets you'll post to.
2. **Accounts → Get Connected Chats** *(only if posting to Telegram/Facebook manually)*  
   Input: Account ID and platform. Output contains chat/page IDs.
3. **Media → Upload** *(same as above)*
4. **Posts → Schedule**  
   Build one `PostSchedule` with one or more `Publication`s.  
   - Set `scheduledTime` (past/now = queue immediately)
   - Manually construct `platformSettings` JSON
   - For now, prefer `isDraft: false` (update APIs will come later)

---

## Operations

### Accounts: **Get Many**
- **Output:** Array of accounts: `{ id, platform, handle, ... }`
- **Use:** Pick `id` for each destination.

### Telegram: **Get Connected Chats**
- **Input:** `{ id }` (must be a Telegram account)
- **Output:** Array: `{ id, title }` — pass `chatId` into Telegram posts.

### Media: **Upload**
- **Input:** File or Public URL
- **Output:** 
  - File upload: `{ path }` — use in `attachmentPaths` of posts
  - URL import: `{ id, state }` — use `id` with "Get Upload Status" to monitor progress
- **Upload Sources:**
  - **From File:** Upload binary file data (existing functionality)
  - **From Public URL:** Import media from a public URL (new functionality)

### Media: **Get Upload Status**
- **Input:** `{ importId }` (from URL import response)
- **Output:** Complete import status including `id`, `state`, `sourceUrl`, `bytesDownloaded`, `totalBytes`, `detectedMime`, `s3Key`, `errorCode`, `errorMessage`
- **Use:** Monitor the progress of URL-based media imports

### Posts: **Schedule**
- **Input:** `PostSchedule` (see [Data model](#data-model))
- **Behavior:** Schedules one or multiple publications for the same time.
- **Recommended:** `isDraft: false` (until update endpoints are exposed in node).

### Posts: **Schedule (Light)**
- **Purpose:** Simplified interface for scheduling a single post to one account
- **Key Features:**
  - **Platform-specific dynamic fields** — The UI automatically shows relevant fields based on the selected account's platform
  - **Automatic platform settings** — No need to manually construct JSON; the node builds `platformSettings` automatically
  - **Smart chat selection** — Facebook Pages and Telegram Channels appear as dropdowns (loaded from API)
  - **Simple attachment paths** — Enter comma-separated media paths instead of managing collections
- **Input Fields:**
  - `Scheduled Time` — When to publish (UTC)
  - `Social Media Account` — Dropdown of your connected accounts
  - *Dynamic fields based on platform:*
    - **Instagram**: Publication Type (Feed/Reels/Story)
    - **Facebook**: Publication Type (Feed/Reels/Story) + Page dropdown
    - **YouTube**: Video Title
    - **TikTok**: Title
    - **Threads**: Topic Tag (optional)
    - **Telegram**: Channel dropdown
    - **X/Twitter, BlueSky, LinkedIn**: No additional fields
  - `Content` — Post text/caption (multi-line)
  - `Attachment Paths` — Comma-separated media paths from Media → Upload
- **Output:** Same as Schedule operation
- **Use Case:** Perfect for simple workflows and testing; for complex multi-account or multi-post scenarios, use Schedule operation

---

## Data model

### `PostSchedule`
```json
{
  "scheduledTime": "2025-08-17T14:03:00",
  "isDraft": false,
  "publications": [ /* Publication[] */ ]
}
```

### `Publication`
Represents “one publication in user’s mind” that may map to *one or many* platform posts.

```json
{
  "socialMediaAccountId": 442,
  "posts": [ /* Post[] */ ],
  "platformSettings": { /* see below */ }
}
```

- **One publication → multiple posts** is useful when:
  - Telegram account posts to several **channels** (one post per channel)
  - Telegram account posts with large text or more than 10 media (one post per message that will be published)
  - Instagram **storyline** (multiple stories in one conceptual set)

### `Post`
```json
{
  "attachmentPaths": [
    "6354d8d2-e0f1-702b-af6c-62e28e377ec7/c6c2b826-8aca-4eae-8549-515325012ab4.jpeg"
  ],
  "content": "Your caption or description",
  "chatId": "1234567890"   // Telegram only
  /* "thumbnailPath": "..." — coming soon */
}
```

> **Note:** For YouTube/TikTok, `content` is used as **description** (titles are set in `platformSettings`).

---

## Platform settings

Each **Publication** must include `platformSettings` with a required discriminator: `type`.

```json
{ "type": "INSTAGRAM", "publicationType": "REELS" }
```

Supported shapes:

### Instagram
```json
{
  "type": "INSTAGRAM",
  "publicationType": "FEED" | "REELS" | "STORY"
}
```

### LinkedIn
```json
{
  "type": "LINKEDIN",
  "visibility": "PUBLIC" | "CONNECTIONS" | "GROUP"
}
```

### Threads
```json
{
  "type": "THREADS",
  "topicTag": "your-topic-tag"
}
```

### TikTok
```json
{
  "type": "TIK_TOK",
  "title": "My video title",
  "privacyLevel": "PUBLIC_TO_EVERYONE" | "FOLLOWER_OF_CREATOR" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY",
  "disableDuet": false,
  "disableComments": false,
  "disableStitch": false,
  "brandContent": false,
  "brandOrganic": true,
  "hasUsageConfirmation": true
}
```

### YouTube
```json
{
  "type": "YOUTUBE",
  "title": "My video title",
  "privacyStatus": "PUBLIC" | "UNLISTED" | "PRIVATE",
  "category": "FILM_ANIMATION" | "AUTOS_VEHICLES" | "MUSIC" | "PETS_ANIMALS" | "SPORTS" | "TRAVEL_EVENTS" | "GAMING" | "PEOPLE_BLOGS" | "COMEDY" | "ENTERTAINMENT" | "NEWS_POLITICS" | "HOWTO_STYLE" | "EDUCATION" | "SCIENCE_TECHNOLOGY"
}
```

---

## Media & text validations

PostPulse Web enforces rich, platform-specific validations.  
**API clients must currently validate themselves.** (Server-side validations for API clients are planned.)

| Validation area | PostPulse Web | PostPulse API (current) |
|---|---|---|
| X: Standard users can post up to 280 characters per tweet | UI warning | **You must validate** |
| X: Supported image formats are JPG, PNG, and WEBP | Enforced | **You must validate** |
| X: Image size should be less than or equal 5MB | Enforced | **You must validate** |
| X: Video size should be less than or equal 512MB | Enforced | **You must validate** |
| X: Maximum 4 media attachments | Enforced | **You must validate** |
| X: Video duration must be between 0.5 sec and 140 sec | Enforced | **You must validate** |
| X: Media aspect ratio between 1:3 and 3:1 | Enforced | **You must validate** |
| Threads: Users can post up to 500 characters | Enforced | **You must validate** |
| Threads: Topic tag should be less than 100 characters | Enforced | **You must validate** |
| Threads: When no topic tag is specified in the platform settings and the content contains a word with # - the first word with # will be used as a topic tag (expept cases with numbers, like #1) | UI warning | **You must validate** |
| Threads: Image size should be less than or equal 8MB | Enforced | **You must validate** |
| Threads: Media aspect ratio between 0,01:1 and 10:1 | Enforced | **You must validate** |
| Threads: Video duration must be less than 5 min | Enforced | **You must validate** |
| Threads: Supported video format is MP4 | Enforced | **You must validate** |
| YouTube: Title should be less than 100 characters | Enforced | **You must validate** |
| YouTube: Description should be less than 5000 characters | Enforced | **You must validate** |
| TikTok: Title should be less than 2200 characters for video post | Enforced | **You must validate** |
| TikTok: Title should be less than 90 characters for image post | Enforced | **You must validate** |
| TikTok: Description should be less than 4000 characters for image post | Enforced | **You must validate** |
| TikTok: Image size should be less than or equal 20MB | Enforced | **You must validate** |
| TikTok: Supported image formats are JPG, PNG, and WEBP | Enforced | **You must validate** |
| TikTok: Supported video formats are MP4, MOV, and WebM | Enforced | **You must validate** |
| TikTok: Video duration as per individual limits (typically 1 hour) | Enforced | **You must validate** |
| TikTok: One post is either 1 video or up to 10 images | Enforced | **You must validate** |
| TikTok: Video should have no more between 360 and 4096 pixels for both height and width | **To Do** | **You must validate** |
| LinkedIn: User can post up to 3000 characters | Enforced | **You must validate** |
| LinkedIn: One post can contain either 1 video or up to 9 images (or no media at all) | Enforced | **You must validate** |
| LinkedIn: Supported video format is MP4 | Enforced | **You must validate** |
| LinkedIn: Video size should be less than or equal 500MB | Enforced | **You must validate** |
| LinkedIn: Video duration must be between 3 sec and 30 min | Enforced | **You must validate** |
| Instagram: User can post up to 2200 characters | Enforced | **You must validate** |
| Instagram: Supported image formats are JPG and PNG | Enforced | **You must validate** |
| Instagram: Image size should be less than or equal 8MB | Enforced | **You must validate** |
| Instagram: Feed post can contain up to 10 media (carousel) | Enforced | **You must validate** |
| Instagram: Feed post media aspect ratio between 1.91:1 and 4:5 | Enforced | **You must validate** |
| Instagram: Supported video formats are MP4 and MOV | Enforced | **You must validate** |
| Instagram: Video size should be less than or equal 300MB | Enforced | **You must validate** |
| Instagram: Feed and Story post video duration must be between 3 sec and 15 min | Enforced | **You must validate** |
| Instagram: Reels video duration must be between 3 sec and 90 sec | Enforced | **You must validate** |
| Instagram: Reels and Story post media aspect ratio between 0.01:1 and 10:1 | Enforced | **You must validate** |
| Instagram: Reels and Story recommended aspect ratio is 9:16 | UI Warning | **You must validate** |
| Instagram: Video should have no more than 1920 horizontal pixels | **To Do** | **You must validate** |
| Bluesky: Users can post up to 300 characters | Enforced | **You must validate** |
| Bluesky: Post may contain up to 4 images | Enforced | **You must validate** |
| Telegram: Users can post up to 4096 characters | Enforced | **You must validate** |
| Telegram: Standard user can post up to 1024 characters if post contains media as well | Enforced | **You must validate** |
| Telegram: One post may contain up to 10 media | Enforced | **You must validate** |
| Telegram: Supported image formats are JPG, PNG, and WEBP | Enforced | **You must validate** |
| Telegram: Supported video formats is MP4 | Enforced | **You must validate** |

> Follow updates at **https://post-pulse.com/releases** — we’ll announce when API-side validations roll out.

---

## Rate limits & API keys

- Authentication uses **OAuth2**; tokens are auto-refreshed by n8n.
- PostPulse runs on AWS API Gateway usage plans. Typical plans:
  - **Standard:** 20 RPS burst, 200 RPS steady, 50k req/month
  - **Agency:** higher limits on request

---

## Webhooks

PostPulse supports webhooks for real-time notifications instead of polling for status updates. This is especially useful for tracking:

- **Post publishing status** — Get notified when scheduled posts are published or fail
- **Media import progress** — Receive updates on URL-based media imports without polling the "Get Upload Status" endpoint

### Setting up webhooks

1. **Register webhook endpoints** at the [Developer Portal](https://developers.post-pulse.com)
2. **Configure event types** you want to receive notifications for
3. **Review webhook models** and event types in the developer documentation

### Benefits over polling

- **Real-time updates** — Instant notifications when events occur
- **Reduced API calls** — No need to repeatedly poll status endpoints
- **Better reliability** — Guaranteed delivery with retry mechanisms
- **Lower latency** — Immediate response to status changes

> **Learn more:** Visit [https://developers.post-pulse.com](https://developers.post-pulse.com) for complete webhook documentation, supported event types, and payload schemas.

---

## Examples

### Minimal single-destination post (Reel)
```json
{
  "scheduledTime": "2025-08-17T14:03:00",
  "isDraft": false,
  "publications": [
    {
      "socialMediaAccountId": 442,
      "platformSettings": {
        "type": "INSTAGRAM",
        "publicationType": "REELS"
      },
      "posts": [
        {
          "attachmentPaths": [
            "6354d8d2-e0f1-702b-af6c-62e28e377ec7/c6c2b826-8aca-4eae-8549-515325012ab4.jpeg"
          ],
          "content": "New drop is live! #fashion"
        }
      ]
    }
  ]
}
```

### Telegram to multiple channels in one publication
```json
{
  "scheduledTime": "2025-08-17T14:03:00",
  "isDraft": false,
  "publications": [
    {
      "socialMediaAccountId": 501,   // Telegram account id
      "platformSettings": { "type": "TELEGRAM" },
      "posts": [
        { "chatId": "-100123", "content": "Hello Channel A", "attachmentPaths": ["u1/p1.jpg"] },
        { "chatId": "-100456", "content": "Hello Channel B", "attachmentPaths": ["u1/p1.jpg"] }
      ]
    }
  ]
}
```

### TikTok with title & privacy
```json
{
  "scheduledTime": "2025-08-17T14:03:00",
  "isDraft": false,
  "publications": [
    {
      "socialMediaAccountId": 777,
      "platformSettings": {
        "type": "TIK_TOK",
        "title": "Top 5 tips",
        "privacyLevel": "PUBLIC_TO_EVERYONE",
        "hasUsageConfirmation": true
      },
      "posts": [
        { "attachmentPaths": ["u1/v1.mp4"], "content": "Full guide in bio" }
      ]
    }
  ]
}
```

### Media import from URL
```json
{
  "url": "https://example.com/my-video.mp4",
  "filenameHint": "promotional-video.mp4"
}
```
**Response:**
```json
{
  "id": 12345,
  "state": "QUEUED"
}
```

### Check media import status
**Input:** `importId: 12345`

**Response:**
```json
{
  "id": 12345,
  "state": "READY",
  "sourceUrl": "https://example.com/my-video.mp4",
  "bytesDownloaded": 15728640,
  "totalBytes": 15728640,
  "detectedMime": "video/mp4",
  "s3Key": "6354d8d2-e0f1-702b-af6c-62e28e377ec7/promotional-video.mp4"
}
```

> **Note:** Use the `s3Key` value in `attachmentPaths` when the state is `READY`.

### Schedule (Light) - Instagram Reel
Using the simplified interface with automatic platform settings:

**Node configuration:**
- Scheduled Time: `2025-08-17T14:03:00`
- Social Media Account: `INSTAGRAM - @fashionbrand`
- Publication Type: `Reels` (automatically appears for Instagram)
- Content: `New drop is live! #fashion`
- Attachment Paths: `6354d8d2-e0f1-702b-af6c-62e28e377ec7/video.mp4`

The node automatically builds this API request:
```json
{
  "scheduledTime": "2025-08-17T14:03:00",
  "isDraft": false,
  "publications": [{
    "socialMediaAccountId": 442,
    "platformSettings": {
      "type": "INSTAGRAM",
      "publicationType": "REELS"
    },
    "posts": [{
      "content": "New drop is live! #fashion",
      "attachmentPaths": ["6354d8d2-e0f1-702b-af6c-62e28e377ec7/video.mp4"]
    }]
  }]
}
```

### Schedule (Light) - Telegram with Channel Selection
**Node configuration:**
- Scheduled Time: `2025-08-17T14:03:00`
- Social Media Account: `TELEGRAM - @mybot`
- Channel: `Tech Updates` (loaded from API, shows connected channels)
- Content: `Check out our latest update!`
- Attachment Paths: `user1/screenshot.png, user1/demo.mp4`

The node automatically builds this API request:
```json
{
  "scheduledTime": "2025-08-17T14:03:00",
  "isDraft": false,
  "publications": [{
    "socialMediaAccountId": 501,
    "platformSettings": {
      "type": "TELEGRAM"
    },
    "posts": [{
      "chatId": "-1001234567890",
      "content": "Check out our latest update!",
      "attachmentPaths": ["user1/screenshot.png", "user1/demo.mp4"]
    }]
  }]
}
```

### Schedule (Light) - YouTube Video
**Node configuration:**
- Scheduled Time: `2025-08-17T14:03:00`
- Social Media Account: `YOUTUBE - @MyChannel`
- Video Title: `Top 5 JavaScript Tips` (automatically appears for YouTube)
- Content: `Full tutorial with code examples. Links in description.`
- Attachment Paths: `user1/tutorial-video.mp4`

The node automatically builds this API request:
```json
{
  "scheduledTime": "2025-08-17T14:03:00",
  "isDraft": false,
  "publications": [{
    "socialMediaAccountId": 777,
    "platformSettings": {
      "type": "YOUTUBE",
      "title": "Top 5 JavaScript Tips"
    },
    "posts": [{
      "content": "Full tutorial with code examples. Links in description.",
      "attachmentPaths": ["user1/tutorial-video.mp4"]
    }]
  }]
}
```

---

## FAQ

**Do I have to upload media to PostPulse even if I have a public URL?**  
Not anymore! You can now use the "From Public URL" option in Media → Upload to import media directly from URLs. The system will download and host the media on `post-pulse.com` for platform compatibility.

**How do I import media from a URL?**  
Use Media → Upload with "From Public URL" option. Provide the URL and optionally a filename hint. The operation returns an import job ID and initial state. Use Media → Get Upload Status to monitor progress until the state becomes "READY".

**What are the different import states?**  
- `QUEUED`: Import job is waiting to start
- `DOWNLOADING`: Media is being downloaded from the source URL
- `VALIDATING`: Downloaded media is being validated
- `UPLOADING`: Media is being uploaded to PostPulse storage
- `READY`: Import complete, media ready to use (check `s3Key` field)
- `FAILED_TEMPORARY`: Temporary failure, may retry automatically
- `FAILED_PERMANENT`: Permanent failure, check `errorCode` and `errorMessage`

**Can I draft then update later via the node?**  
In v1 of the node, we recommend `isDraft: false`. Update endpoints will be exposed in a later version.

**How do I post to multiple accounts at once?**  
Create one `PostSchedule` with multiple `Publication` objects (one per account).

**How do I set YouTube or TikTok titles?**  
Titles live in **`platformSettings`** (see schemas above). `content` becomes description.

**Should I use webhooks or polling for status updates?**  
Webhooks are recommended for production workflows as they provide real-time notifications without the need to repeatedly call status endpoints. Set up webhooks at [https://developers.post-pulse.com](https://developers.post-pulse.com) to receive instant notifications for post publishing status and media import progress. Use polling (Get Upload Status) only for testing or when webhooks aren't feasible.

---

## Support

- **Developer Portal:** https://developers.post-pulse.com (for OAuth client setup and documentation)
- **Discord Community:** [PostPulse for Developers](https://discord.gg/yrMdD4R5) (feature requests, community support)
- **Email Support:** support@post-pulse.com (technical issues and general inquiries)

---

## Versioning & License

- Semantic Versioning: `MAJOR.MINOR.PATCH`
- License: MIT

---

### Security notes
- Store secrets in **n8n Credentials** only; don’t hardcode in workflows.
