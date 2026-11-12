# StrainDB — SeedNest Research UI

GitHub Pages URL after a successful deployment:

https://astromanager-dev.github.io/StrainDB/

## Developer design preview

- **Meine 84 Sorten** reads `docs/data/strains.json`, a public list of 84 seed identities and existing sourced research information, *not* private quantities or storage.
- **CannaLib-Katalog durchsuchen** performs an on-demand full-corpus text search via `GET https://api.cannalib.org/v1/catalogs/strains?q=...&limit=10`. This is **not** a bulk catalogue download. Enter 2+ letters to search. Results reflect CannaLib's search ranking.
- Clicking a strain opens a detail panel and requests a single full `strain_tree_v1` record from CannaLib.
- **Live-API** displays every field delivered at runtime recursively, including nested evidence, branches, lineage, chemistry, photos and sources. No invented values.
- APIs may return null/empty fields. The UI preserves missing values as missing.
- Details retrieved from CannaLib stay **only in current page memory**, never in GitHub, Web Storage, IndexedDB or server files.
- CannaLib attribution must remain visible wherever API data is shown: [Data by CannaLib](https://cannalib.org).
- The site's global search is anonymous and subject to CannaLib's per-hour/day throttles; a GitHub Pages static site cannot protect API keys. Do **not** put CannaLib API keys into the JavaScript.
- The upstream API presently declares `Access-Control-Allow-Origin: *`. If this policy changes, direct browser requests may stop working; switch to an authenticated, rate-limited VPS proxy after checking the provider's terms.
- Global browsing is keyword-based search: CannaLib does **not** publish a complete breeder-list or bulk-catalogue API endpoint.
- The repository is public: commit no private inventories, API secrets or personal information. The 84 strain identities and existing research metadata are intentionally published.

## Deploy

Publishing runs automatically on pushes to `main` with changes in `docs/**`. The workflow `.github/workflows/pages.yml` validates JavaScript syntax and JSON counts, then deploys `docs/` to GitHub Pages.

If the repository's Pages feature is not enabled, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**, then rerun the workflow.

API documentation: https://cannalib.org/api/ . Licence: https://cannalib.org/api/terms/ .
