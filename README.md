# dailyai-brief

My morning finance brief. A scheduled Claude Code routine summarizes the YouTubers and X accounts I pick and publishes a daily page.

- `sources.json` lists the people to follow.
- `npm run fetch` collects the last 24h into `data/<date>/raw.json`.
- The routine reads `prompts/report.md`, writes `data/<date>.json`, runs `npm run validate <date>` and `npm run index`, then pushes.
- `web/index.html` renders whatever is in `data/`.
