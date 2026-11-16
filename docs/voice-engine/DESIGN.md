# Voice Engine: Dan Pearson's personal social posting

Status: design agreed with Dan on 2026-11-16. Stories VOICE-001..VOICE-020 in PRD.json build it. VOICE-018..020 are operator stories: the loop stops there and asks Dan.

## What it is

A small service that posts as Dan Pearson (the person, not a brand account) three times a day, with no review step, through one Make.com scenario per platform. It is modeled on GradeThread's slideshow autopost (GradeThread repo: `services/edge-functions/src/lib/content-webhook.ts`, `assets/Slideshow/`, `vault/40-growth/content-publishing.md`), but it is separate from GradeThread and from the ADE hub. The hub is not always running, so nothing here may depend on it, on GradeThread's GitHub runner, or on Dan's PC.

## Why

The hub's earlier attempt (voice "in the style of" Codie Sanchez and Jeremy Miner) produced posts Dan called "pretty bad". Two causes this design removes: the voice was an imitation instruction rather than rules written for Dan, and nothing stopped the model from inventing a story. The goal is **engagement earned by usefulness**: each post teaches something real. Dan explicitly does not want to look like he is engagement farming.

## The three daily tracks

| Track | Default time (America/Chicago) | Speaks as | Sources |
|---|---|---|---|
| `gradethread` | 08:30 | The owner who built GradeThread and FlipDesk: why a feature exists, what resellers get wrong, what shipping it taught him | gradethread.com public pages (sitemap.xml, llms.txt, blog) |
| `eatpal` | 12:15 | A parent of a picky eater with a personal-training background who wants every kid, not only his, to have a shot at a healthy life. Covers ARFID tracking, meal plans, grocery lists, recipes | tryeatpal.com public pages + Story Bank |
| `platform` | 16:30 | The salesman who builds the software: platform development and AI CRM integration, in an owner-and-money register like Codie Sanchez's entrepreneurship content (the register, never imitation) | Rotates daily: Brikly (brikly.net) → Printyx (printyx.net) → AgentBio (agentbio.net); each product's public pages + Story Bank |

Times, enablement and the rotation order are settings, not code.

## Platforms

X, LinkedIn, Instagram, Facebook, Threads, YouTube. **No TikTok** (its app approval is not worth it). Each platform has its own webhook URL and its own Make scenario.

## Hard rules (anti-goals)

1. **No invented claims.** Any personal fact (about Dan, his kid, a client, a number he achieved) must come from a confirmed Story Bank entry. Any product fact must come from a fetched source item. A draft with an unsourced claim is rewritten once, then the track skips the day.
2. **No engagement farming.** No bait questions, "Agree?", "Thoughts?", "Comment X below", "Follow for more", "Like if", "Let that sink in", "Unpopular opinion:", "Nobody talks about", 🧵/👇/🔥 bait, thread hooks. Not every post ends in a question; most should end where the point ends.
3. Dan's employer is never named. Clients are anonymous unless the story says otherwise. No prices in posts.
4. Never double-post. A platform that already accepted a post is never sent it again.

## Formats (the engine picks one per post)

- `text_carousel`: hook slide, 3-6 numbered point slides, closing slide; Dan's headshot and handle on the first and last slide.
- `single_image`: one sentence on a flat brand card or over one of Dan's uploaded photos.
- `product_carousel`: real app screenshots (uploaded by Dan per product in the admin) with his take as headlines. Only possible when that product has screenshots; otherwise fall back to `text_carousel`.

Per platform: Instagram, Facebook, LinkedIn take carousels. X and Threads take the single image or slide 1 (X max 4 images). YouTube takes only video: every carousel is also rendered to a 9:16 MP4 (slides + crossfade + optional music), which also goes to Instagram as a Reel when `reels` is enabled. A `single_image` post skips YouTube that day.

## Architecture

```
services/voice-engine/  (Node 20 + TypeScript, own package.json)
  Dockerfile           Chromium (Playwright) + ffmpeg + fonts baked in
  src/config.ts        env validation
  src/scheduler.ts     node-cron tick every 5 min -> which tracks are due today
  src/pipeline.ts      claim run -> pick topic -> write -> check -> render -> dispatch
  src/sources/         fetch + cache product pages into voice_source_items
  src/topics.ts        choose an unused topic/angle
  src/writer.ts        Claude: per-platform copy + slide content (structured JSON)
  src/checker.ts       banned-pattern scan + claim-to-source audit
  src/render/          HTML slide templates -> PNG (Playwright), slides -> MP4 (ffmpeg)
  src/dispatch.ts      signed webhook per platform, retry once, log
  src/server.ts        /health, POST /run (secret-protected "post now")
  voice/danpearson.voice.json   the voice guide as data
```

- **Data:** the DanPearson self-hosted Supabase (api.danpearson.net). Tables are prefixed `voice_`. Media in a public-read storage bucket `voice-media`. The service uses the service-role key; the admin pages use the existing admin auth and RLS pattern.
- **Admin UI:** pages in this site under `/admin/voice` (settings, story bank, assets, activity), reusing the existing admin layout and RBAC.
- **AI:** Anthropic API. Model from env `VOICE_MODEL` (default `claude-opus-5-5`; verify current IDs against Anthropic's model docs at build time). Prompts live in files, not inline strings.
- **Secrets:** Infisical, same as the other apps. Env names: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VOICE_MODEL`, `VOICE_WEBHOOK_SECRET` (HMAC for outbound webhooks), `VOICE_RUN_SECRET` (protects POST /run), `VOICE_DRY_RUN` (true = render and log, fire nothing), `VOICE_HANDLE` (shown on slides), `VOICE_DENY_TERMS` (names that must never appear, such as the employer; Infisical only, never committed), `TZ=America/Chicago`. The edge functions app additionally gets `VOICE_SERVICE_URL`.
- **Deploy:** its own Coolify application built from `services/voice-engine/Dockerfile`, public at voice.danpearson.net (only `/health` and the secret-protected `/run`). Creating it is a server change and needs Dan's approval of a change plan (see VOICE-019).
- **Edge functions (admin-only or service-only):** `voice-test-webhook` (Test fire), `voice-run-now` (Post now, holds the run secret), `voice-notify` (skip emails over the SMTP settings `send-notification-email` already uses; that function only handles support tickets and is not changed).
- **Make:** six scenarios in the Make folder "Dan Pearson", one per platform, copied on 2026-11-16 from GradeThread's "GT Webhook - *" scenarios and left inactive until Dan swaps the connections and targets to his personal accounts (VOICE-020; scenario and hook ids are in that story's notes). Threads goes through Buffer (a copy of the X scenario). The copied Instagram, Facebook and LinkedIn image branches post a single image (`image_url`), not a carousel.

## Webhook contract

Same shape as GradeThread's `WebhookPayloadSocial` so the Make scenarios look familiar:

```json
{
  "event": "social.published",
  "platform": "instagram",
  "timestamp": "2026-11-17T18:15:02.000Z",
  "data": {
    "id": "<voice_posts.id>",
    "body": "<caption for this platform>",
    "hashtags": ["..."],
    "cta_url": null,
    "product_focus": "eatpal",
    "track": "eatpal",
    "title": "<YouTube title, youtube only>",
    "image_url": "<slide 1 or the single image>",
    "media_type": "image | carousel | video",
    "image_urls": ["<ordered slides, carousel only>"],
    "video_url": "<mp4, video only>"
  }
}
```

A Test fire from the admin adds a top-level `"test": true`. Real sends **omit `test` entirely**: the Make scenarios (copied from GradeThread's) pass a run only when `test` does not exist, so even `"test": false` would be dropped.

Header `X-Content-Signature: <hex HMAC-SHA256 of the raw body with VOICE_WEBHOOK_SECRET>` and `X-Idempotency-Key: <post id>:<platform>`.

## Failure behaviour

Each stage is retried once. If the post still cannot be produced, the track is marked `skipped` for that day with the reason, and an email goes to Dan through the existing notification path. Dispatch failures are per platform: a failed platform retries once and is logged; platforms that succeeded are not re-sent. The platform rotation only advances when a post went out.

## Not in v1

Reading likes or comments back to learn what works. TikTok. AI-generated photos. A human approval queue.

## Prior art in the repo and hub (reuse, do not depend on at runtime)

- `hub/voices/danpearson.json` and `hub/playbooks/danpearson.json` in the Server repo: the hub's unsigned voice profile and story-first playbook. VOICE-003 copies the useful parts (neverSays list, anonymity rules) into this repo.
- `docs/superpowers/specs/2026-09-25-dan-pearson-social-voice-design.md` in the Server repo: the earlier brand brief.
- The Hermes vault's Story Bank notes: VOICE-005 imports confirmed ones once.
- `supabase/functions/generate-social-content` and `send-article-webhook` in this repo: the site's article-to-social path. Leave them alone; the voice engine is separate.
