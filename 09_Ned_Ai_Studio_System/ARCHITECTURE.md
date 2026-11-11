# Ned_Ai Studio — System Architecture

## Goal
A free-first local production system for Ned_Ai that combines a browser dashboard with a Windows worker.

## Components
1. **Web dashboard** — runs in Google Chrome; manages ideas, scripts, prompts, project status, export checklists, and publishing metadata.
2. **Windows worker** — a lightweight local Python service/launcher that runs approved tasks such as FFmpeg processing, file organization, and Blender background jobs.
3. **Project workspace** — stores working media and renders locally; GitHub stores source code, documentation, prompts, and small project metadata only.
4. **Optional integrations** — YouTube/TikTok/Metricool connections are added only through supported authorization flows. No passwords or verification codes are stored in the project.

## Proposed free-first stack
- Dashboard: HTML, CSS, and JavaScript (no paid hosting required for local use).
- Local worker: Python 3.
- Media processing: FFmpeg.
- 3D automation: Blender command line/background mode, with conservative settings for the laptop's 2 GB GPU.
- Local coordination: localhost HTTP API; no public server required for the first version.
- Version control: GitHub repository; never commit large video files, credentials, tokens, or private media.

## Safety and operating rules
- No publishing, deleting, account disconnecting, security changes, or paid usage without explicit approval.
- Show a preview/checklist before any publishing action.
- Keep secrets in local environment variables or an OS credential store; never in Git.
- Log task status and errors without recording passwords or access tokens.
- Prefer CPU/lightweight settings when GPU memory is constrained; allow the user to stop jobs.

## Build phases
1. **Foundation:** dashboard shell, local worker health check, project folder configuration.
2. **Production workflow:** idea → script → prompt/assets → project → render → quality checklist.
3. **Media tools:** FFmpeg presets and optional Blender job runner.
4. **Publishing preparation:** title, description, hashtags, thumbnail checklist, and export package.
5. **Analytics:** read-only summaries from supported connected services; no fabricated metrics.

## First milestone acceptance checks
- Dashboard opens in Chrome on the user's Windows laptop.
- Dashboard can detect whether the local worker is running.
- User can create and track a project without uploading media to GitHub.
- No paid service is required for the first milestone.
