# Stevies World

My recipes, workouts and notes in one place, built to open fast on my phone.

- **Recipes**: your cookbook recipes (Chicken Katsu Curry, Beef Udon, Thai Tea) plus anything you add. Cook mode shows one step at a time in big text and keeps the screen awake.
- **Workouts**: saved routines with sections, sets, reps and rest. Start workout goes one exercise at a time and has a rest timer.
- **Notes**: anything else, like sizes, gear, routines or links. The five healthy-living guides live here.
- **Paste a link**: paste a TikTok, Instagram, YouTube or recipe-site link (or just the caption text) and it fills in the recipe or workout for you to check and save.
- **Pick one**: picks a random meal or workout for you, from your favorites when you have some.
- **Themes**: Meadow (painted hills, with a sky that follows the time of day), Firefly night, Retro desktop and Plain paper. Change it in Settings.
- **Sync**: with a passcode, your library is the same on your phone and laptop. It also works offline and catches up later.

## How link import works (no AI)

| Link | What's read |
| --- | --- |
| Recipe websites | The recipe card most sites publish for Google (schema.org). This gives exact ingredients, steps, time, servings and macros. |
| TikTok | The video caption, via TikTok's public embed info. |
| Instagram | The post caption from the page's preview info. Instagram sometimes hides it. When that happens the app asks you to paste the caption, and the link is still saved. |
| YouTube | The video description. |
| Anything else | The page text, read with the same pattern matching. |

Captions are sorted using patterns that real posts follow: "Ingredients:" and "Steps:" headings, quantity lines like "200g chicken", numbered steps, "3x10", "4 sets of 8", "rest 90s", "450 cals, 45g protein", and hashtags as tags. You always see the result before saving and can fix anything. If a post only says "recipe in bio", there's nothing to read, so write it in yourself.

## Set up sync (once, about 5 minutes)

Without this, everything you add stays only on the device you added it on.

1. In the [Vercel dashboard](https://vercel.com/dashboard), open the **Stevies-World** project, then **Storage**, then **Create database**. Choose **Upstash for Redis** (the free plan is plenty) and connect it to this project. This adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables for you.
2. In **Settings**, then **Environment Variables**, add `STEVIE_PASSCODE` with a passphrase only you know.
3. Redeploy: push a commit, or click **Redeploy** on the latest deployment.
4. On each device, open the site, go to **Settings**, then **Sync**, and enter the passcode.

The passcode protects reading and changing your library and using the link importer. Photos are served from long random links, so they can't be guessed.

## On your phone

- **Home screen**: in Safari, tap Share, then **Add to Home Screen**. It opens full-screen like an app.
- **Share straight from TikTok or Instagram on iPhone**: Settings in the app has a 4-step Shortcut recipe. It sends a shared link to `https://<your-site>/?add=<link>`.
- **Android**: once it's installed, Stevies World appears in the share menu.

## Run locally

Requires Node.js 20 or newer. There's nothing to install.

```sh
npm run dev                                      # http://127.0.0.1:4173 (no sync)
SW_DEV_MEMORY=1 STEVIE_PASSCODE=test npm run dev # try sync with a throwaway in-memory store
npm test
npm run build && npm run preview
```

Link import needs internet access from your machine. Add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your shell to test against the real database.

## Deploy on Vercel

`vercel.json` sets the build (`npm run build`) and output folder (`dist`). Files in `api/` become serverless functions automatically. Pushing to the connected branch redeploys.

## Project structure

- `index.html`, `styles.css`: page shell, plus all four themes as CSS custom properties
- `src/app.js`: routing (`#/recipes`, `#/item/<id>`, `#/add`…) and event handling
- `src/views.js`: home, list pages, item pages
- `src/editor.js`: paste or import flow, and the editor
- `src/modes.js`: cook mode and workout mode
- `src/settings.js`, `src/theme.js`: settings page and theme switching
- `src/store.js`: library on the device (IndexedDB), offline queue and sync
- `src/scenery.js`: the painted landscape (original SVG)
- `src/builtins.js`, `data/cookbook.js`, `data/recipe-estimates.js`: your cookbook and guides
- `shared/parse.js`: caption to recipe or workout patterns, used by the app and the API
- `shared/extract.js`: recipe-card and metadata reading for web pages
- `shared/schema.js`: the one item shape everything is checked against
- `api/library.js`, `api/photo.js`, `api/import.js`: sync, photos and link import
- `lib/`: Upstash REST client, passcode check, safe fetching (blocks private addresses) and importers
- `sw.js`, `manifest.webmanifest`: installable app and offline cache
- `tests/`: parser, extraction, storage and API tests

Older backups from the previous version can be loaded from **Settings**, then **Backups**. Anything saved in this browser by the old version is brought over automatically the first time the new version opens.

Recipe estimate details: [RECIPE-ESTIMATES.md](RECIPE-ESTIMATES.md). Photo credits: [assets/CREDITS.md](assets/CREDITS.md). The healthy-living notes are general information for adults, not personal medical advice.
