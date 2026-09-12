# Progress Console — Template v1.0.0

A local-first personal progress dashboard for daily time logging, weekly planning, habits, long-term roadmaps, objectives, and lightweight progress analytics.

This repository is the **clean public template**. It contains only generic starter data and no personal records.

## Features

- Quick time logging with optional notes
- Weekly hour targets by module
- Weekly tasks and “Today” assignment
- Habit tracking by target days per week
- Adjustable long-term roadmap with milestones and ranges
- Objectives + measurable key results
- Weekly rotating quote / line library
- Historical time insights
- Chinese / English interface toggle
- Local-first storage with IndexedDB
- JSON export / import backup
- Installable PWA with offline caching
- Static deployment: no backend required

## Tech stack

- HTML
- CSS
- Vanilla JavaScript
- IndexedDB
- Service Worker
- Web App Manifest / PWA

There is no build step and no framework dependency.

## Run locally

From the project folder:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

Any simple static server works. Opening `index.html` directly with `file://` is not recommended because service workers require HTTP(S).

## Customize the template

### Content and data model

Edit `app.js`.

The starter seed data lives in `seedIfEmpty()` and includes generic examples for:

- modules
- work tags
- habits
- weekly tasks
- roadmap groups and milestones
- objectives and key results
- weekly quote library

The seed only runs when the local database has no modules yet. If you edit starter data after already using the app, existing IndexedDB data will not be overwritten.

### Optional page copy

Near the top of `app.js`:

```js
const CUSTOM_COPY = {
  weekSubtitle: { zh: '', en: '' },
  roadmapSubtitle: { zh: '', en: '' },
  insightsSubtitle: { zh: '', en: '' },
};
```

Leave values blank for no subtitle, or add your own copy.

### Layout and visual design

Edit `styles.css` for:

- spacing and density
- typography
- navigation
- cards and panels
- motion and hover states
- roadmap appearance
- responsive layout

### PWA metadata

Edit:

- `manifest.webmanifest` — app name, theme, icons
- `index.html` — page metadata and app shell
- `icons/` — app icons
- `sw.js` — offline cache

When changing cached static assets, bump the cache name in `sw.js` so installed copies receive the new version.

## Data and privacy

User data is stored in the browser's **IndexedDB** for the site's origin. No account, analytics service, or backend is required by this template.

Because data is local:

- another browser/device has a separate database
- clearing site data can remove records
- deleting an installed PWA may remove local data depending on platform/browser behavior

Use **Settings → Export JSON** for backups.

## Deploy

The repository includes configuration files for:

- Vercel (`vercel.json`)
- Netlify (`netlify.toml`)

Because this is a static app, you can also host it on any service that serves static files over HTTPS.

## Make this a GitHub template

After pushing this repository to GitHub:

1. Open the repository **Settings**.
2. Under **General**, enable **Template repository**.
3. Other users can then choose **Use this template** to create their own copy.

## Suggested first-time setup for users

1. Open **Settings** and rename/remove the example modules.
2. Set weekly hour targets.
3. Replace the example habits.
4. Replace roadmap items and objectives.
5. Replace the weekly quote library.
6. Export a JSON backup after setup.

## Version

**v1.0.0** — first clean public template release.

## License

MIT License. See [LICENSE](LICENSE).
