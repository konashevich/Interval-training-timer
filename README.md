# VPRAVA.ONLINE

A mobile-friendly interval training timer you can run in any modern browser—or install as a PWA on your phone for fullscreen, home-screen access. Design custom work/rest patterns, save multiple trainings, and follow along with visual and audio cues. No build step required.

**Name:** VPRAVA.ONLINE (Ukrainian *вправа* — “exercise”)  
**Live app:** [https://vprava.online/](https://vprava.online/)  
Also at [https://timer.konashevych.com/](https://timer.konashevych.com/) and [https://konashevich.github.io/Interval-training-timer/](https://konashevich.github.io/Interval-training-timer/)

## Features

- **Timer** — Circular progress ring, cycle counter, play/pause, reset, and skip
- **Training Designer** — Build patterns from work and rest segments, set cycle count, and tune beep pitches
- **Training Manager** — Save, load, edit, delete, reorder, and share named presets (stored in `localStorage`)
- **Google Drive** — Optional sign-in to sync/backup trainings across devices and create anyone-with-link share URLs (see [docs/google-oauth/README.md](docs/google-oauth/README.md))
- **Audio cues** — Web Audio synthesizer with configurable regular and emphasised final beeps
- **Internationalization** — English by default; Ukrainian UI when the browser language is Ukrainian or Russian
- **PWA** — Installable on mobile (Add to Home Screen), offline app-shell caching, settings with About and manual install

## Getting Started

No dependencies or build tools. Open the app in a browser:

```bash
# From the project directory — use any local static server, or open the file directly
python3 -m http.server 8080
# Then visit http://localhost:8080/
```

Or double-click `index.html` to open it locally.

> **Note:** Some browsers require a user gesture (tap Play) before audio can play.

## Usage

1. **Timer** — Start the active training, watch the countdown, and use Reset or Skip as needed.
2. **Designer** — Add work/rest segments, adjust durations and cycles, configure beep pitches, then save the training.
3. **Manager** — Switch between saved trainings or create a new one from the empty state.

Trainings persist in the browser’s `localStorage` on the same device. With Google Drive linked, they also sync to a private folder in your Drive.

## Google Drive setup

Operator steps (OAuth client on GCP **Chromium** `chromium-466007`, Drive API key on **vprava-online**, Cloudflare Worker): [docs/google-oauth/README.md](docs/google-oauth/README.md).

Google Drive appears in Settings when `GOOGLE_CLIENT_ID` is set in [`js/google-drive/config.js`](js/google-drive/config.js) (configured for production).

## Tech Stack

- Vanilla HTML/JS PWA (`index.html` + `js/google-drive/` ES modules)
- [Tailwind CSS](https://tailwindcss.com/) (CDN)
- [Lucide](https://lucide.dev/) icons (CDN)
- Web Audio API for beeps
- `localStorage` for preset storage; optional Google Drive vault via Cloudflare OAuth proxy

## License

MIT — see [LICENSE](LICENSE).

## Agent notes

See [AGENTS.md](AGENTS.md) for product naming, domains, and operator paths.
