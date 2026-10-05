# Italie 2027

Trip-planning page for Italy 2027 (David, Lise, Chantal and Norm).

- `site/` is what Netlify publishes (index.html, manifest, icons). Do not edit index.html by hand.
- `source/` builds the page. Content lives in `source/data.mjs` (version number at the top, places, day trips, scenarios).

To rebuild after editing data.mjs:

    cd source
    npm install
    node build.mjs

This writes `site/index.html`.
