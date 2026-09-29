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

The Discord OAuth flow requests only `identify` and `guilds.members.read`. No bot token is needed: the signed-in account is used to ask Discord whether it belongs to the configured server and which roles it currently has. Visitors see the server invite and sign-in screen; server members without the required role see a waiting screen with a recheck button. Assign the role in Discord to grant access. The homepage and every upload, status, preview, and download API verify access server-side; membership and role checks are cached for no more than one second.

For a production build:

```bash
npm run build
npm start
```

Do not deploy the processing routes to a serverless or edge-only host: the FFmpeg job continues after the upload request returns and requires a persistent Node.js process. Job state is held in memory, so use one application instance behind a trusted HTTPS reverse proxy. Configure the proxy to set and overwrite `X-Real-IP`; upload rate limiting uses that header. The built-in limit is five uploads per IP per hour.

## Video processing

- Accepts MP4, MOV, MKV, and WebM uploads up to 1 GB.
- Streams multipart uploads into randomly named files in the OS temporary directory; it does not load the whole upload into application memory.
- Uses FFmpeg with H.264, `yuv420p`, AAC at 192 kbps, and `+faststart`. Maximum, High, and Balanced use CRF 18, 20, and 23 respectively.
- Resolution and frame-rate selectors accept original, 2160p, 1440p, 1080p, 720p, or 480p and original, 60, 30, or 24 FPS. The selected resolution is an upper bound, preserves aspect ratio and orientation, and never upscales; a selected frame rate is exact and uses FFmpeg's FPS filter to add or drop frames as required.
- With original settings, FFmpeg does not scale, autorotate, or set a replacement frame rate. It runs in passthrough frame-rate mode and preserves orientation metadata; odd pixel dimensions are rejected instead of silently resized.
- Uses FFprobe to check input metadata and verify the output codec, pixel dimensions, frame count when available, frame rate, and duration metadata before marking a job complete. Frame-count verification accommodates small average-frame-rate rounding differences such as 60.00 versus 59.94 FPS while rejecting dropped or duplicated frames.
- Reports upload progress from the browser transfer and encoding progress from FFmpeg's reported output timestamp. It does not simulate progress.
- Deletes source files immediately after successful encoding. Output files and failed-job temporary files are removed after one hour; job identifiers and metadata are held in memory and are not durable.

Temporary files are not a permanent video store. For deployment, ensure temporary storage has suitable capacity and configure the reverse proxy with a request-body limit of at least 1 GB plus multipart overhead and a sufficiently long upload timeout.

Never commit `.env.local` or publish the Discord OAuth client secret or `AUTH_SECRET`.
