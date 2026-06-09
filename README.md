# Interval Training Timer

A mobile-friendly interval training timer you can run in any modern browser. Design custom work/rest patterns, save multiple trainings, and follow along with visual and audio cues—no install or build step required.

## Features

- **Timer** — Circular progress ring, cycle counter, play/pause, reset, and skip
- **Training Designer** — Build patterns from work and rest segments, set cycle count, and tune beep pitches
- **Training Manager** — Save, load, edit, and delete named presets (stored in `localStorage`)
- **Audio cues** — Web Audio synthesizer with configurable regular and emphasised final beeps
- **Internationalization** — English by default; Ukrainian UI when the browser language is Ukrainian or Russian

## Getting Started

No dependencies or build tools. Open the app in a browser:

```bash
# From the project directory — use any local static server, or open the file directly
python3 -m http.server 8080
# Then visit http://localhost:8080/interval_beep_timer.html
```

Or double-click `interval_beep_timer.html` to open it locally.

> **Note:** Some browsers require a user gesture (tap Play) before audio can play.

## Usage

1. **Timer** — Start the active training, watch the countdown, and use Reset or Skip as needed.
2. **Designer** — Add work/rest segments, adjust durations and cycles, configure beep pitches, then save the training.
3. **Manager** — Switch between saved trainings or create a new one from the empty state.

Trainings persist in the browser’s `localStorage` on the same device.

## Tech Stack

- Single HTML file (`interval_beep_timer.html`)
- [Tailwind CSS](https://tailwindcss.com/) (CDN)
- [Lucide](https://lucide.dev/) icons (CDN)
- Web Audio API for beeps
- `localStorage` for preset storage

## License

MIT — see [LICENSE](LICENSE).
