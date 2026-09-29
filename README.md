# KYRO TOOLS

A private video-compression workspace built with Next.js, TypeScript, and server-side FFmpeg. Uploads are streamed to temporary files, encoded to H.264, checked with FFprobe, and automatically removed.

## Requirements

- Node.js 20.9 or newer
- FFmpeg with `libx264` and AAC support
- FFprobe (normally included with FFmpeg)
- A long-running Node.js host with writable operating-system temporary storage

The application starts with `ffmpeg` and `ffprobe` from `PATH`. Set `FFMPEG_PATH` and `FFPROBE_PATH` in the environment if the executables use different paths.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Require Discord server membership and a role

Copy `.env.example` to `.env.local`, then set:

- `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET` from your Discord Developer Portal OAuth2 application. The ID, server ID, and required role ID provided for KYRO TOOLS are prefilled in the example.
- `AUTH_SECRET` to a long, random value.
- `DISCORD_INVITE_URL` to the invite link shown to new visitors. The provided server invite is prefilled.

Register the exact local URL `http://127.0.0.1:3100/api/auth/callback/discord` in the Discord application's OAuth2 redirect URIs to use this preview. For the default development port, use `http://localhost:3000/api/auth/callback/discord`. In production, register the matching HTTPS callback URL and set the same environment variables on the host.

The Discord OAuth flow requests `identify`, `guilds.members.read`, and `guilds`. No bot token is needed: the signed-in account is used to ask Discord whether it belongs to the configured server, which roles it currently has, and whether it owns that server. The configured server owner can access the workspace without the creator role; everyone else still needs a configured role. Visitors see the server invite and sign-in screen; server members without the required role see a waiting screen with a recheck button. The homepage and every upload, status, preview, and download API verify access server-side; membership and role checks are cached for no more than one second. After adding the `guilds` scope, sign out and sign in again and approve the requested permission.

For a production build:

```bash
npm run build
npm start
```

Do not run video processing through serverless functions or an external proxy. The upload is sent directly from the browser to a persistent Node.js service; that service starts FFmpeg after the upload and keeps job state in memory. Run one Railway replica so upload, status, and video requests reach the same process. Configure a trusted reverse proxy to set and overwrite `X-Real-IP`; upload rate limiting uses that header. The built-in limit is five uploads per IP per hour.

### Deploy the website on Vercel with video processing on Railway

The GitHub repository can be connected to both services. Vercel serves the website and Discord sign-in. Railway builds the included `Dockerfile`, installs FFmpeg, and serves the video-processing API. The browser uploads directly to Railway; large video files do not pass through a Vercel Function. Railway's public service URL must be reachable over HTTPS.

1. Import `SAMIRDONHONI/kyro-tools` as a Vercel project.
2. Create a Railway service from the same GitHub repository. Railway detects the `Dockerfile`; generate a public domain and keep the service at one replica.
3. Set these variables on Vercel:
   - All Discord/Auth.js variables from `.env.example`.
   - `VIDEO_API_TOKEN_SECRET`: a random secret of at least 32 characters.
   - `NEXT_PUBLIC_VIDEO_API_URL`: the Railway service's HTTPS URL, with no trailing slash.
4. Set these variables on Railway:
   - `VIDEO_API_TOKEN_SECRET`: the exact same secret as Vercel.
   - `VIDEO_ALLOWED_ORIGINS`: the exact HTTPS origin of the Vercel site (for example, `https://your-project.vercel.app`). Add custom domains as comma-separated origins.
5. In the Discord Developer Portal, register `https://your-project.vercel.app/api/auth/callback/discord` as an OAuth2 redirect URI. Use your production domain instead if you have one.
6. Redeploy both services after setting variables. Test sign-in, upload, processing, preview, and download on the Vercel URL.

Vercel issues short-lived, signed access tokens only to Discord sessions with the required role. Railway validates those tokens and scopes jobs to their owner. Railway's API allows browser requests only from `VIDEO_ALLOWED_ORIGINS`. Keep `VIDEO_API_TOKEN_SECRET` private and identical on both hosts. Do not set Discord OAuth secrets on Railway.

Railway's job state and temporary video files are in process memory and temporary storage, not a durable queue or video library. Use one replica; restarting or redeploying Railway removes active jobs and temporary outputs. Videos are still automatically deleted after one hour.

## Video processing

- Accepts MP4, MOV, MKV, and WebM uploads up to 1 GB.
- Streams multipart uploads into randomly named files in the OS temporary directory; it does not load the whole upload into application memory.
- Uses FFmpeg with H.264, `yuv420p`, AAC at 192 kbps, and `+faststart`. Maximum, High, and Balanced use CRF 18, 20, and 23 respectively.
- Uses the `veryfast` H.264 preset, one encoder/filter thread, and one active encode per Railway process to reduce peak resource use. A second upload receives a retry-later response while the encoder is occupied.
- Optional sharpening (Off, Subtle, Strong) and color grading (Off, Natural, Vibrant) are disabled by default. They apply FFmpeg unsharp and mild contrast/saturation filters only when selected.
- Resolution and frame-rate selectors accept original, 2160p, 1440p, 1080p, 720p, or 480p and original, 60, 30, or 24 FPS. The selected resolution is an upper bound, preserves aspect ratio and orientation, and never upscales; a selected frame rate is exact and uses FFmpeg's FPS filter to add or drop frames as required.
- With original settings, FFmpeg does not scale, autorotate, or set a replacement frame rate. It runs in passthrough frame-rate mode and preserves orientation metadata; odd pixel dimensions are rejected instead of silently resized.
- Uses FFprobe to check input metadata and verify the output codec, pixel dimensions, frame count when available, frame rate, and duration metadata before marking a job complete. Frame-count verification accommodates small average-frame-rate rounding differences such as 60.00 versus 59.94 FPS while rejecting dropped or duplicated frames.
- Reports upload progress from the browser transfer and encoding progress from FFmpeg's reported output timestamp. It does not simulate progress.
- Deletes source files immediately after successful encoding. Output files and failed-job temporary files are removed after one hour; job identifiers and metadata are held in memory and are not durable.

Temporary files are not a permanent video store. For deployment, ensure temporary storage has suitable capacity and configure the reverse proxy with a request-body limit of at least 1 GB plus multipart overhead and a sufficiently long upload timeout.

Never commit `.env.local` or publish the Discord OAuth client secret or `AUTH_SECRET`.
