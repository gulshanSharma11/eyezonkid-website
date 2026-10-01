# Eyezonkid pages — how to edit

- Header (all pages, incl. home): `_src/partials/header.html`
- Footer (all pages, incl. home): `_src/partials/footer.html`
- Shared styles for inner pages: `_src/partials/site.css`
- Page content: `_src/pages/<slug>.html`  (title/description in `_src/build.mjs`)

After any edit run:

    node _src/build.mjs

It regenerates /faq/, /help-centre/, /privacy-policy/, /terms-of-service/,
re-syncs the header/footer inside /index.html, and rewrites sitemap.xml.
Upload the changed files to the server (the _src folder is optional on the server; it's blocked from the web).
