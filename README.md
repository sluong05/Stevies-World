# Stevies World

A personal home for your recipes and healthy living information. Browse, read, research, and keep useful finds. No goals, streaks, habit tracking, or completion checklists.

## What's included

- An empty recipe collection, ready for recipes you add yourself.
- Five source-linked guides covering nutrition, sleep, movement, hydration, and food safety.
- Recipe photos, ingredients, instructions, timing, servings, source links, tags, and notes.
- Optional macros and meal costs, with per-serving and whole-recipe views.
- Combined filters for price, protein, calories, protein per 100 calories, and cooking time, plus sorting and category filters.
- Bookmarks, a research box that opens Google, and JSON library exports/imports.
- Responsive layouts, keyboard navigation, accessible dialogs, and reduced-motion support.

## Run locally

Requires Node.js 20 or newer. There are no runtime or build dependencies to install.

```sh
npm run dev
```

Open http://127.0.0.1:4173. To build and preview the deployable output:

```sh
npm test
npm run build
npm run preview
```

Stop the development server before starting the preview server, since both use port 4173. Set `PORT` to choose another port.

## Deploy on Vercel

Import `sluong05/Stevies-World`. The included `vercel.json` configures:

| Setting | Value |
| --- | --- |
| Framework | Other |
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | Repository root |
| Environment variables | None required |

Vercel can redeploy when new commits reach the connected branch. See [Vercel's build configuration documentation](https://vercel.com/docs/builds/configure-a-build).

## Your recipes and library

Choose **Add a find** or **Add your first recipe**. Recipes require a title, description, category, timing, servings, ingredients, instructions, and a photo. Upload a JPEG, PNG, or WebP up to 15 MB (compressed locally before saving), or paste a working direct HTTPS image link. Photo descriptions and source credits are optional. New and edited recipes cannot be saved without a working photo.

Expand **Macros & meal cost** to enter all four macro values for one serving and/or the cost of ingredients used in the whole recipe. These fields are optional and entered manually, not calculated from ingredient text. Unknown values stay unavailable instead of showing zero. Costs are in USD and exclude the extra cost of buying full packages. Open **Macros** or **Estimated cost** in a recipe to view per-serving or whole-recipe values.

Use **More filters** to combine minimum/maximum price, protein, calories, protein per 100 kcal, and maximum cooking time. All amounts are per serving. Protein density is protein ÷ calories × 100. A recipe with an unknown estimate is excluded only when filtering that estimate; sorting places unknown values last. Search and filters are preserved in the page URL.

Personal additions and bookmarks are saved in **localStorage in the current browser**. They do not sync between devices or write back to GitHub. Clearing website data removes them. Export from **Your library & backups** to keep a copy, then import it on another device. Uploaded photos are included in the backup; external image links depend on their host. Imports merge entries by ID without removing other entries. Older backups without photos remain compatible and display representative serving inspiration until edited.

If saved browser data cannot be read, the app pauses writes to protect the original. Export preserves the original payload for recovery. Importing a valid backup can restore the collection; the previous raw data is also preserved under the `stevies-world.library.v1.recovery` browser-storage key.

There are no built-in recipes. The website intentionally has no account system, database, API keys, automatic recipe scraping, or medical personalization.

## Health information and images

Health guides provide general adult educational information with primary sources and review dates. They are not personalized medical advice. Revisit source guidance when updating them.

The home-page image and fallback photos for older backups are representative serving inspiration, not recipe content. Credits are in [assets/CREDITS.md](assets/CREDITS.md). These images are included in the repository. Fonts load from Google Fonts with system fallbacks.

## Project structure

- `index.html` — page shell and library dialog
- `styles.css` — responsive design
- `app.js` — browsing, dialogs, research, and editing
- `content.js` — health guides; the shared recipe list is intentionally empty
- `recipe-search.js` — filters, serving metrics, sorting, and URL state
- `photo-utils.js` — photo validation
- `data/seed-photos.js` — home/fallback image attribution
- `storage.js` — portable library validation and merge rules
- `assets/` — home/fallback photos and brand icon
- `scripts/` — dependency-free build and local preview
- `tests/` — library safety, photo validation, filters, and content checks

User input is rendered as text. Source links allow HTTP/HTTPS; image links require HTTPS. Imports validate supported fields before saving. Builds include only explicit website files, not local files or secrets.
