#!/usr/bin/env node
/**
 * Eyezonkid static page builder — zero dependencies.
 *
 *   node _src/build.mjs
 *
 * - Shared header / footer live in _src/partials/ (edit once, used everywhere).
 * - Page bodies live in _src/pages/<slug>.html → output to /<slug>/index.html
 * - The header + footer inside /index.html (home) are refreshed between
 *   <!-- @header --> / <!-- /@header --> and <!-- @footer --> / <!-- /@footer --> markers.
 * - CSS is minified and inlined (no extra request) for a fast first paint.
 * - sitemap.xml is regenerated.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SRC, '..');
const SITE = 'https://eyezonkid.com';
const TODAY = new Date().toISOString().slice(0, 10);
const UPDATED_HUMAN = '25 September 2026'; // change when legal text changes
const YEAR = new Date().getFullYear();

const read = (p) => readFileSync(join(SRC, p), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* ---------- pages ---------- */
const pages = [
  {
    slug: 'help-centre',
    name: 'Help centre',
    title: 'Help Centre – Setup Guides & Support | Eyezonkid',
    description: 'Get help with Eyezonkid: set up parental controls on Android and iPhone, manage screen time and app limits, fix location issues, and contact support.',
    type: 'WebPage',
    priority: '0.8',
  },
  {
    slug: 'faq',
    name: 'FAQ',
    title: 'FAQ – Parental Control App Questions Answered | Eyezonkid',
    description: 'Answers to common questions about Eyezonkid: privacy, live location, YouTube and WhatsApp limits, setup on Android & iPhone, pricing and cancellation.',
    type: 'FAQPage',
    priority: '0.8',
  },
  {
    slug: 'download',
    name: 'Download',
    title: 'Download Eyezonkid – Mac, Windows, Android & iPhone',
    description: 'Download the Eyezonkid parental control app for Mac (Apple Silicon & Intel), Windows, Android and iPhone. Start with a 3-day free trial.',
    type: 'WebPage',
    priority: '0.9',
  },
  {
    slug: 'privacy-policy',
    name: 'Privacy Policy',
    title: 'Privacy Policy | Eyezonkid Parental Control App',
    description: 'How Eyezonkid collects, uses and protects your family\'s data. We never read private chats, never record the screen and never sell your data.',
    type: 'WebPage',
    priority: '0.4',
  },
  {
    slug: 'terms-of-service',
    name: 'Terms of Service',
    title: 'Terms of Service | Eyezonkid Parental Control App',
    description: 'The terms for using Eyezonkid, including eligibility, acceptable use, plans, 3-day trial, billing, cancellation and governing law in India.',
    type: 'WebPage',
    priority: '0.4',
  },
];

/* ---------- css ---------- */
const minifyCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
const CSS = minifyCss(read('partials/site.css'));

/* ---------- partials ---------- */
const HEADER = read('partials/header.html').trim();
const FOOTER = read('partials/footer.html').trim().replace('{{year}}', YEAR);

const withActive = (html, href) =>
  html.replaceAll(`href="${href}" class="wmk-navbar__link"`, `href="${href}" class="wmk-navbar__link" aria-current="page"`)
      .replaceAll(`<a href="${href}">`, `<a href="${href}" aria-current="page">`);

const CTA = `<section class="cta-band" aria-labelledby="cta-h">
    <div><h2 id="cta-h">A smarter way to stay connected.</h2><p>Keep your child safer, set healthier boundaries, and stay in the loop — without stepping into their private world.</p></div>
    <a href="/download/" class="btn">Start your 3-day free trial<span aria-hidden="true"><svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3.333 8h9.334M8.667 3.667 13 8l-4.333 4.333" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></a>
</section>`;

const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#252422"/><text x="32" y="45" font-family="Arial,sans-serif" font-weight="800" font-size="38" text-anchor="middle" fill="#F07167">e</text></svg>')}`;

const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim();

function schemaFor(p, body) {
  const url = `${SITE}/${p.slug}/`;
  const graph = [
    {
      '@type': p.type,
      '@id': `${url}#webpage`,
      url,
      name: p.title,
      description: p.description,
      inLanguage: 'en-IN',
      isPartOf: { '@id': `${SITE}/#website` },
      publisher: { '@id': `${SITE}/#organization` },
      dateModified: TODAY,
      breadcrumb: { '@id': `${url}#breadcrumb` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: p.name, item: url },
      ],
    },
    {
      '@type': 'Organization',
      '@id': `${SITE}/#organization`,
      name: 'Eyezonkid',
      url: `${SITE}/`,
      email: 'info@eyezonkid.com',
      telephone: '+91-9650459807',
      contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: 'support@eyezonkid.com', telephone: '+91-9650459807', areaServed: 'IN', availableLanguage: ['en', 'hi'] },
    },
  ];
  if (p.type === 'FAQPage') {
    graph[0].mainEntity = [...body.matchAll(/<summary>([\s\S]*?)<\/summary>\s*<div class="qa__a">([\s\S]*?)<\/div>\s*<\/details>/g)].map(
      ([, q, a]) => ({ '@type': 'Question', name: stripTags(q), acceptedAnswer: { '@type': 'Answer', text: stripTags(a) } })
    );
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

function render(p) {
  const url = `${SITE}/${p.slug}/`;
  const crumbs = `<nav aria-label="Breadcrumb"><ol class="crumbs"><li><a href="/">Home</a></li><li aria-current="page">${p.name}</li></ol></nav>`;
  const body = read(`pages/${p.slug}.html`)
    .replace('{{breadcrumbs}}', crumbs)
    .replace('{{cta}}', CTA)
    .replaceAll('{{updated}}', UPDATED_HUMAN);
  const href = `/${p.slug}/`;

  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en-IN" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta name="theme-color" content="#2EC4B6">
<link rel="icon" href="${FAVICON}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Eyezonkid">
<meta property="og:locale" content="en_IN">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${SITE}/og-image.jpg">
<link rel="preload" href="/fonts/urbanist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/source-serif-4.woff2" as="font" type="font/woff2" crossorigin>
<style>${CSS}</style>
<script type="application/ld+json">${schemaFor(p, body)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${withActive(HEADER, href)}
<main id="main">
${body.trim()}
</main>
${withActive(FOOTER, href)}
</body>
</html>
`;
}

for (const p of pages) {
  const dir = join(ROOT, p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), render(p));
  console.log(`✓ /${p.slug}/`);
}

/* ---------- keep home header/footer in sync ---------- */
const homePath = join(ROOT, 'index.html');
if (existsSync(homePath)) {
  let home = readFileSync(homePath, 'utf8');
  const swap = (html, name, partial) => {
    const re = new RegExp(`<!-- @${name} -->[\\s\\S]*?<!-- /@${name} -->`);
    return re.test(html) ? html.replace(re, () => `<!-- @${name} -->\n${partial}\n<!-- /@${name} -->`) : html;
  };
  const next = swap(swap(home, 'header', HEADER), 'footer', FOOTER);
  if (next !== home) { writeFileSync(homePath, next); console.log('✓ / (header + footer synced)'); }
}

/* ---------- sitemap ---------- */
const urls = [{ loc: `${SITE}/`, priority: '1.0' }, ...pages.map((p) => ({ loc: `${SITE}/${p.slug}/`, priority: p.priority }))];
writeFileSync(
  join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`
);
console.log('✓ sitemap.xml');
