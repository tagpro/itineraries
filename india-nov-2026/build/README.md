# Rebuilding `app.css`

Generated — don't hand-edit. Tailwind only emits classes it can see as literal
strings in `../index.html`, inline `<script>` included, so never assemble a
class name from fragments at runtime.

```sh
cd india-nov-2026/build
npx tailwindcss@3.4.17 -c tailwind.config.js -i app.src.css -o tw.css --minify
cat fonts.css tw.css > ../app.css && rm tw.css
```

Then bump `VERSION` in `../sw.js`, or installed copies keep serving the old
stylesheet. The fonts are the latin subsets of Outfit and Playfair Display,
served from `../fonts` so the page renders offline.
