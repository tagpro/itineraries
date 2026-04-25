# Tagpro Itineraries

A curated collection of verified travel itineraries, maps, and guides for upcoming and past trips.

## Hosting

This repository is designed to be hosted seamlessly. Currently, it is hosted using GitHub Pages, which serves the root `index.html` as an app-like shell portal to view the different travel itineraries.

### Enabling GitHub Pages via CLI

If you ever need to re-enable or manually set up GitHub Pages for this repository from the command line, you can use the following GitHub CLI (`gh`) command:

```bash
gh api --method POST -H "Accept: application/vnd.github.v3+json" /repos/tagpro/itineraries/pages -f "source[branch]=main" -f "source[path]=/"
```

This command makes an API call to GitHub instructing it to build and serve the `main` branch from the root (`/`) directory.
