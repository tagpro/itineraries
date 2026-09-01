# Rebuilding `app.css`

The page used to pull Tailwind and Google Fonts from CDNs. It no longer does —
both are baked in so the itinerary renders with no network at all, which is the
whole point of the offline app.

`../app.css` is generated. Don't hand-edit it. To rebuild after changing markup:

```sh
cd tassie-campervan-2026/build
npx tailwindcss@3.4.17 -c tailwind.config.js -i app.src.css -o tw.css --minify
cat fonts.css tw.css > ../app.css && rm tw.css
```

Tailwind only emits classes it can see, and it scans `../index.html` — inline
`<script>` included. So any class name the JS applies must appear as a literal
string in that file, never assembled from fragments at runtime.

## Fonts

`../fonts/outfit.woff2` and `../fonts/playfair.woff2` are the latin subsets from
Google Fonts. Both are variable fonts, so one file covers every weight the page
uses; `fonts.css` declares the ranges.

## After changing any cached asset

Bump `VERSION` in `../sw.js`. Installed copies keep serving the old cache until
that string changes, and visitors then get the "newer plan is ready" prompt.
