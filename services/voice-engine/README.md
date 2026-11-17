# Voice engine

Posts as Dan Pearson three times a day (GradeThread at 08:30, EatPal at 12:15, a platform track rotating Brikly, Printyx and AgentBio at 16:30, all America/Chicago) through one Make scenario per platform. No review step: a checker blocks engagement bait and any claim the Story Bank or a product page does not back, and a track skips the day rather than post something it cannot stand behind.

Design and the rules it enforces: [docs/voice-engine/DESIGN.md](../../docs/voice-engine/DESIGN.md). The admin side lives in this repo's site under Admin > Voice.

## Run it locally

Secrets come from Infisical, the same as the other apps.

```bash
npm --prefix services/voice-engine ci
```

```bash
infisical run -- npm --prefix services/voice-engine start
```

`start` runs the built server (`npm run build` first); `dev` runs from source with tsx. One track, once, from the command line:

```bash
infisical run -- npm --prefix services/voice-engine run once -- --track eatpal --dry-run
```

Sample slides with no database and no Claude call, written to `out/preview/`:

```bash
npm --prefix services/voice-engine run preview -- --fixture all
```

Tests (no network; the render tests start Chromium and ffmpeg):

```bash
npm --prefix services/voice-engine test
```

If the installed Chromium build does not match the pinned Playwright version, point `CHROMIUM_PATH` at a Chromium binary. The Docker image needs no override.

## Environment

| Variable                    | Required | Default                      | What it is                                                                                                                                            |
| --------------------------- | -------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | yes      |                              | The DanPearson Supabase, `https://api.danpearson.net`                                                                                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      |                              | Service role key. Bypasses RLS.                                                                                                                       |
| `ANTHROPIC_API_KEY`         | yes      |                              | Claude API key                                                                                                                                        |
| `VOICE_MODEL`               | no       | `claude-opus-5-5`            | Model for the topic picker, writer and audit                                                                                                          |
| `VOICE_WEBHOOK_SECRET`      | yes      |                              | HMAC key for `X-Content-Signature` on every webhook (at least 16 characters). The `voice-test-webhook` edge function needs the same value.            |
| `VOICE_RUN_SECRET`          | yes      |                              | Shared secret for `POST /run` (at least 16 characters). The `voice-run-now` edge function needs the same value.                                       |
| `VOICE_DRY_RUN`             | no       | `true`                       | `true` renders and logs every payload and sends nothing. Set `false` only to go live.                                                                 |
| `VOICE_HANDLE`              | no       | `@danpearson`                | Handle printed on the first and last slide                                                                                                            |
| `VOICE_DENY_TERMS`          | no       | empty                        | Comma-separated names that must never appear in a post, such as the employer. Infisical only; never commit it. Never written to logs or the database. |
| `VOICE_FUNCTIONS_URL`       | no       | `$SUPABASE_URL/functions/v1` | Edge functions base URL, for the skip email. Self-hosted: `https://functions.danpearson.net`.                                                         |
| `TZ`                        | yes      |                              | `America/Chicago`                                                                                                                                     |
| `PORT`                      | no       | `8080`                       | HTTP port                                                                                                                                             |
| `CHROMIUM_PATH`             | no       |                              | Local override for the Chromium binary. Not needed in Docker.                                                                                         |

A missing or invalid variable stops startup with the variable names listed, never their values.

## HTTP

- `GET /health` returns `{ ok, version, dryRun }`.
- `POST /run` with header `x-run-secret` and body `{ "track": "eatpal", "dryRun": true }` starts a track now and answers `202`. `401` on a wrong secret, `409` when the track already posted today or is running, `429` past 6 calls an hour. A service with `VOICE_DRY_RUN=true` never makes a real post, whatever the body says.

Nothing else is served.

## Deploy

Its own Coolify application built from `services/voice-engine/Dockerfile` (develop branch), public at `voice.danpearson.net`. Creating it is a server change and goes through a change plan Dan approves (VOICE-019). Apply `supabase/migrations/20261116000001_voice_engine.sql` first.
