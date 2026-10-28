#!/usr/bin/env node
// Static site builder, no dependencies.
// src/pages/<id>.html + src/i18n/<lang>.json + config/site.json  ->  dist/
// src/articles/<id>/<lang>.html (with a front-matter comment) -> dist/blog/<id>/
//
// Template syntax:
//   {{> header}}          include src/partials/header.html
//   {{t.home.hero.title}} value from the current language file
//   {{site.phone}}        value from config/site.json
//   {{url.contact}}       link to a page in the current language
//   {{alt.uk}}            link to the current page in another language

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const readText = (p) => fs.readFileSync(p, 'utf8');
const readJSON = (p) => JSON.parse(readText(p));

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function lookup(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function render(tpl, ctx, file) {
  // Partials first (they may contain variables), up to a few levels deep.
  for (let i = 0; i < 5 && /\{\{>\s*[\w-]+\s*\}\}/.test(tpl); i++) {
    tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) =>
      readText(path.join(SRC, 'partials', `${name}.html`))
    );
  }
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = lookup(ctx, key);
    if (val === undefined) throw new Error(`Missing value "${key}" in ${file} [${ctx.lang}]`);
    return String(val);
  });
}

// Article file: an HTML comment with "key: value" lines, then the body.
function readArticle(file) {
  const src = readText(file);
  const m = src.match(/^<!--([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`Missing front matter in ${file}`);
  const meta = Object.fromEntries(
    m[1].trim().split('\n').map((line) => {
      const i = line.indexOf(':');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
  );
  const body = src.slice(m[0].length);
  const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return { ...meta, body, minutes: Math.max(1, Math.round(words / 200)) };
}

function build() {
  const site = readJSON(path.join(ROOT, 'config', 'site.json'));
  const langs = site.languages;
  const t = Object.fromEntries(langs.map((l) => [l.code, readJSON(path.join(SRC, 'i18n', `${l.code}.json`))]));
  const pages = site.pages.filter((p) => fs.existsSync(path.join(SRC, 'pages', `${p.id}.html`)));
  const articles = site.articles.filter((a) => fs.existsSync(path.join(SRC, 'articles', a.id)));
  const version = Date.now().toString(36);

  const pagePath = (lang, slug) => `${lang.prefix}/${slug ? slug + '/' : ''}`;
  const articleSlug = (a) => `blog/${a.id}`;
  const formatDate = (iso, lang) =>
    new Intl.DateTimeFormat(lang.locale.replace('_', '-'), { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));

  const articleData = Object.fromEntries(
    langs.map((lang) => [
      lang.code,
      articles.map((a) => ({
        ...a,
        ...readArticle(path.join(SRC, 'articles', a.id, `${lang.code}.html`)),
        url: pagePath(lang, articleSlug(a)),
        dateText: formatDate(a.date, lang),
      })),
    ])
  );

  const articleCards = (lang) =>
    articleData[lang.code]
      .map(
        (a) => `<li class="reveal"><a class="post-card spotlight" href="${a.url}">
          <span class="post-card__meta">${a.dateText} · ${a.minutes} ${t[lang.code].blog.minutes}</span>
          <h3 class="post-card__title">${a.title}</h3>
          <p>${a.excerpt}</p>
          <span class="post-card__more">${t[lang.code].blog.readMore} <span aria-hidden="true">→</span></span>
        </a></li>`
      )
      .join('\n');

  fs.rmSync(DIST, { recursive: true, force: true });
  copyDir(path.join(SRC, 'assets'), path.join(DIST, 'assets'));

  // One output file per (template, language).
  function emit({ tplFile, slug, navId, lang, meta, extra = {}, outFile }) {
    const tpl = readText(tplFile);
    const url = Object.fromEntries(site.pages.map((p) => [p.id, pagePath(lang, p.slug)]));
    const alt = Object.fromEntries(langs.map((l) => [l.code, pagePath(l, slug)]));
    const hreflang = [
      ...langs.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${site.domain}${alt[l.code]}">`),
      `<link rel="alternate" hreflang="x-default" href="${site.domain}${alt[site.defaultLang]}">`,
    ].join('\n  ');
    const langSwitch = langs
      .map((l) =>
        l.code === lang.code
          ? `<span class="lang-switch__item is-active" aria-current="true" lang="${l.code}">${l.label}</span>`
          : `<a class="lang-switch__item" href="${alt[l.code]}" hreflang="${l.code}" lang="${l.code}" data-lang-link="${l.code}">${l.label}</a>`
      )
      .join('');

    const ctx = {
      t: t[lang.code],
      tAll: t,
      site,
      lang: lang.code,
      locale: lang.locale,
      url,
      alt,
      v: version,
      year: new Date().getFullYear(),
      page: {
        id: navId,
        path: alt[lang.code],
        canonical: site.domain + alt[lang.code],
        title: meta.title,
        description: meta.description,
      },
      nav: Object.fromEntries(site.pages.map((p) => [p.id, p.id === navId ? ' aria-current="page"' : ''])),
      hreflang,
      langSwitch,
      altJSON: JSON.stringify(alt),
      articleCards: articleCards(lang),
      jsonld: '',
      ...extra,
    };

    const out = outFile || path.join(DIST, alt[lang.code], 'index.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, render(tpl, ctx, path.relative(SRC, tplFile)));
  }

  for (const page of pages) {
    for (const lang of langs) {
      emit({
        tplFile: path.join(SRC, 'pages', `${page.id}.html`),
        slug: page.slug,
        navId: page.id,
        lang,
        meta: t[lang.code].meta[page.id],
        extra: page.id === 'home' ? { jsonld: businessSchema(site, t[lang.code], pagePath(lang, '')) } : {},
      });
    }
  }

  for (const lang of langs) {
    for (const a of articleData[lang.code]) {
      emit({
        tplFile: path.join(SRC, 'templates', 'article.html'),
        slug: articleSlug(a),
        navId: 'blog',
        lang,
        meta: { title: `${a.title} | ${site.name}`, description: a.description },
        extra: { article: a, jsonld: articleSchema(site, a) },
      });
    }
  }

  // 404 lives at the root; Netlify and Cloudflare Pages serve it automatically.
  const notFound = path.join(SRC, 'pages', '_404.html');
  if (fs.existsSync(notFound)) {
    const lang = langs.find((l) => l.code === site.defaultLang);
    emit({
      tplFile: notFound,
      slug: '',
      navId: '',
      lang,
      meta: t[lang.code].meta.notFound,
      outFile: path.join(DIST, '404.html'),
    });
  }

  const sitemapSlugs = [...pages.map((p) => p.slug), ...articles.map(articleSlug)];
  writeSitemap(site, langs, sitemapSlugs, pagePath);
  fs.writeFileSync(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${site.domain}/sitemap.xml\n`
  );

  console.log(`Built ${pages.length} page(s) + ${articles.length} article(s) x ${langs.length} languages -> dist/`);
}

function businessSchema(site, t, pathname) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'AccountingService',
    name: `${site.name} ${site.brandTagline}`,
    description: t.meta.home.description,
    url: site.domain + pathname,
    image: site.domain + site.ogImage,
    telephone: site.phoneHref,
    email: site.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.city,
      addressRegion: site.region,
      addressCountry: site.country,
    },
    areaServed: { '@type': 'State', name: site.areaServed },
    availableLanguage: ['English', 'Ukrainian'],
    sameAs: [site.instagram, site.facebook],
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function articleSchema(site, a) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    author: { '@type': 'Person', name: site.name },
    mainEntityOfPage: site.domain + a.url,
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function writeSitemap(site, langs, slugs, pagePath) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = slugs.flatMap((slug) =>
    langs.map((lang) => {
      const alts = langs
        .map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${site.domain}${pagePath(l, slug)}"/>`)
        .join('\n');
      return `  <url>\n    <loc>${site.domain}${pagePath(lang, slug)}</loc>\n    <lastmod>${today}</lastmod>\n${alts}\n  </url>`;
    })
  );
  fs.writeFileSync(
    path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
  );
}

module.exports = { build };
if (require.main === module) build();
