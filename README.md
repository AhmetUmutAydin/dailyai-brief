# dailyai-brief

My morning finance brief. A scheduled Claude Code routine summarizes the YouTubers and X accounts I pick and publishes a daily page.

- `sources.json` lists the people to follow.
- `npm run fetch` collects the last 24h into `data/<date>/raw.json`.
- The routine reads `prompts/report.md`, writes `data/<date>.tr.json` and its field-by-field translation `data/<date>.en.json`, runs `npm run validate <date>` (schema for both files plus a structural parity check) and `npm run index`, then pushes.
- `web/index.html` renders whatever is in `data/` with a TR/EN switch.
- `npm run pp -- state|csv|snapshot` (local only) keeps Portfolio Performance current from Scalable and writes `data/portfolio.json` (weights only). Driven by the `finans` skill in Claude Code.
- When `data/portfolio.json` exists the routine adds a `portfolio` section (today's mentions per holding, a hold / sell / buy_more call, up to 3 ideas) and the page shows a "Portföy" tab.
