# JCMS — JSON Content Management System

> **Zero-Database. Zero-Build. Zero-Overhead.**
>
> A lightning-fast, file-driven Single Page Application (SPA) architecture built with pure Vanilla JavaScript, modern CSS, and JSON content manifests.

JCMS treats content, presentation and application shell as three strictly separated layers. Your entire website — every page, every translation, every navigation entry — lives in plain JSON files. There is no database to provision, no build pipeline to babysit, and no framework lock-in to escape later.

---

## ⚡ Why JCMS?

- **No Database.** Pure JSON files under `/content/`. Version control your entire content with Git — branch it, review it, roll it back.
- **No Node.js / Webpack / Build Steps.** Pure Vanilla ES6+. Open `index.html` directly, or serve it with any static web server (Nginx, Caddy, Apache, Python).
- **Theme Isolation.** Styles and color tokens are isolated in `/theme/theme.json`. Dark/Light mode with local persistence works out of the box.
- **Bilingual Core.** Built-in DE/EN localization toggle with automatic storage handling — every content string can carry a `_de` / `_en` variant.
- **SEO & AI-Crawler Ready.** Semantic HTML5, runtime-injected Schema.org structured data, and zero-JS-readable JSON endpoints under `/content/`.
- **Convention over Configuration.** Known layouts render beautiful templates; unknown keys fall back to a safe automatic `<dl>` renderer, so nothing ever breaks.

---

## 🚀 Quickstart

```bash
git clone https://github.com/johnbubak/jcms.git
cd jcms
python3 serve.py 8080
```

Open <http://localhost:8080> in your browser. The dev server is a single, dependency-free Python file: unknown routes fall back to `index.html` so deep links such as `/leistungen` or `/blog/hello-world` work exactly like in production.

**Deploy anywhere:** JCMS is fully static. Copy the repository to any web root. Example Nginx configuration:

```nginx
server {
  listen 80;
  root /var/www/jcms;
  index index.html;

  location /content/ { default_type application/json; }
  location / { try_files $uri $uri/ /index.html; }
}
```

---

## 📐 Architecture

| Path | Purpose |
|------|---------|
| `index.html` | The immutable shell (~75 LOC). Contains no content and no personal data — everything is injected at runtime. |
| `app.js` | The universal layout renderer & SPA router. Loads JSON, applies the theme, renders sections, handles DE/EN and Dark/Light. |
| `content/index.json` | The manifest: defines routes, section order, layout engines and navigation. |
| `content/meta.json` | Site metadata (name, URL, email, locale, OG image, Schema.org type) — drives `<head>`, branding and contact rendering. |
| `content/*.json` | Section content. |
| `theme/` | Pure design tokens (`theme.json`) and styles (`style.css`). Swap the folder to reskin the entire site. |
| `assets/` | Static assets (placeholder avatar etc.). |
| `serve.py` | Zero-dependency SPA-aware development server. |

### Layout engines

`hero` · `marquee` · `grid-2` · `grid-3` · `manifest` · `text-split` · `blog-list` · `kontakt` · auto-fallback

### Content model

```json
{
  "sections": [
    { "id": "hero", "route": "/", "layout": "hero", "file": "hero.json" }
  ],
  "nav": [
    { "href": "/", "label_de": "Start", "label_en": "Home" }
  ]
}
```

Localization is purely additive: `tagline_de` / `tagline_en`, `text_de` / `text_en`, and so on. Missing translations fall back gracefully.

---

## 🎨 Theming

All colors, spacing and animation tokens live in `theme/theme.json` and are applied as CSS Custom Properties. Changing a theme never touches markup or content:

```json
{
  "colors": {
    "dark":  { "--bg": "#080808", "--accent": "#CC0000", "--text": "#F0EDE8" },
    "light": { "--bg": "#F0EDE8", "--accent": "#CC0000", "--text": "#080808" }
  }
}
```

---

## 🔒 Privacy by Default

JCMS ships with **no tracking, no cookies and no third-party runtime dependencies**. Language and theme preferences are stored only in the browser's `localStorage`. Because content is plain JSON, it is trivially auditable and portable.

---

## 🤝 Contributing

Issues and pull requests are welcome. Please keep the core philosophy intact: no build step, no runtime dependencies, no database. If a feature requires a bundler, it belongs in a plugin — not in the core.

---

## 📄 License

MIT © Jan-Lukas Bobka — [github.com/johnbubak](https://github.com/johnbubak)

Reference implementation live at **<https://jan.bobka.net>**.
