# Stevies World

A personal home for recipes and healthy living information. Browse, read, research, and keep useful finds. No goals, streaks, habit tracking, or completion checklists.

## What's included

- Six original starter recipes with ingredients, instructions, approximate timing, and food-safety notes.
- Five source-linked guides covering nutrition, sleep, movement, hydration, and food safety.
- Search across titles, ingredients, tags, and guide content; category filters and bookmarks.
- Add, edit, and remove your own recipes and health notes, with optional source links.
- Export and import a JSON backup of your personal collection.
- A research box that opens Google in a new tab, plus links to recipe and health resources.
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

The development server is intentionally limited to the local computer. Stop it before starting the preview server, since both use port 4173. Set `PORT` to choose another port.

## Deploy on Vercel

Import `sluong05/Stevies-World` into Vercel as a new project. The included `vercel.json` configures:

| Setting | Value |
| --- | --- |
| Framework | Other |
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | Repository root |
| Environment variables | None required |

Vercel can redeploy when new commits reach the connected branch. See [Vercel's build configuration documentation](https://vercel.com/docs/builds/configure-a-build).

## How your library works

Personal additions and bookmarks are saved in **localStorage in the current browser**. They do not sync between devices or write back to GitHub. Clearing website data removes them. Export from **Your library & backups** to keep a copy; import that file on another device. Imports merge entries by ID, updating matching personal entries without removing other items.

The starter collection lives in `content.js`. To publish new shared content for everyone, edit that file and push a commit. The site intentionally has no account system, database, API keys, automatic recipe scraping, or medical personalization.

If saved browser data cannot be read, the app pauses writes to protect the original. Export preserves the original payload for recovery. Importing a valid backup can restore the collection; the prior raw data is also preserved under the `stevies-world.library.v1.recovery` browser-storage key.

## Content and photography

Recipes are original starter concepts, not kitchen-tested recipes. Preparation times are estimates. Food photography is representative serving inspiration. Image source credits are in [assets/CREDITS.md](assets/CREDITS.md).

Health guides are general adult educational information, with primary sources and review dates. They are not personalized medical advice. Revisit source guidance when updating the collection.

Fonts load from Google Fonts, with local system fallbacks. All food photos are included in the repository, so they do not depend on a remote image service.

## Project structure

- `index.html` — page shell and library dialog
- `styles.css` — responsive design
- `app.js` — browsing, dialogs, research, and editing
- `content.js` — starter recipes and guides
- `storage.js` — validated portable library format and merge rules
- `assets/` — photos and brand icon
- `scripts/` — dependency-free build and local preview
- `tests/` — backup validation, merge behavior, and content integrity

User input is rendered as text, source links allow only HTTP/HTTPS, and imports validate and strip unsupported fields before saving. Builds include only the explicit website files, not local files or secrets.
