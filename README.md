# Clayins131.github.io

Personal static site for https://tuixue.nl, hosted on GitHub Pages.

## Structure

- `index.html` - homepage, experience, projects, education, skills
- `blog/` - blog index, posts, and RSS feed
- `projects/` - project writeups
- `reading/` - books and annual reports
- `fintools/` - browser-only finance tools and ASML tracker
- `assets/` - shared CSS, theme scripts, favicon

## Local Preview

The site uses root-relative paths such as `/assets/shared.css`, so preview it through a local server from the repository root:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Deployment

Push to `main`. GitHub Pages serves the static files directly. The custom domain is configured through `CNAME`.

## Notes

- Keep page metadata, `sitemap.xml`, and `blog/feed.xml` in sync when adding pages.
- Financial data calls are client-side only. Alpha Vantage works with the shared demo key, but a personal API key is more reliable.
- No build step is required.
