# Cocktail Judges 🍸

Shared cocktail rating app for the crew. Everyone joins with their name + the same party code.

## Files
- public/index.html — the whole app (vanilla HTML/CSS/JS)
- public/manifest.webmanifest — "Add to Home Screen" support
- netlify/functions/api.mjs — API, stores everything in Netlify Blobs
- netlify.toml, package.json — build config + @netlify/blobs dependency

## Deploy (GitHub → Netlify)
1. Create a new GitHub repo, drag ALL files/folders in (keep the folder structure).
2. Netlify → Add new site → Import from GitHub → pick the repo. Leave build settings blank (netlify.toml handles it).
3. Deploy. No environment variables, no database setup — Blobs is built in.

Do NOT use Netlify Drop (it skips the function).

## Scoring
5 categories × 1–10 = total out of 50. Leaderboard = average across judges.
Edit categories in the CATS list in index.html AND in api.mjs (keys must match).
