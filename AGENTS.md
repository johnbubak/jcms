# AGENTS.md — JCMS (JSON Content Management System)

> Single source of truth for agents and maintainers working on **this** repository.
> We deliberately keep **no `CLAUDE.md`** — everything lives here.
> Read this first. GodMode is ON: act autonomously on reversible work, but
> **ask before anything that changes published behaviour or the public API/schema.**

---

## 1. What this project is

**JCMS** is a zero-database, zero-build, file-driven CMS: content is JSON, the
theme is a swappable folder, and the application shell is minimal HTML plus one
vanilla-JS renderer.

| Field | Value |
|-------|-------|
| License | MIT © Jan-Lukas Bobka |
| GitHub | https://github.com/johnbubak/jcms |
| Gitea (LAN) | `http://192.168.178.93:3002/jan/jcms.git` |
| Reference implementation | https://jan.bobka.net (downstream, separate repo) |
| Dev server | `python3 serve.py 8080` → http://localhost:8080 |
| Version | `content/index.json.version`, `theme/theme.json.version` |

**Non-negotiable philosophy:** no build step, no runtime dependencies, no database.
If a feature needs a bundler or a server, it belongs in a plugin — not in core.

---

## 2. Repository layout

| Path | Purpose |
|------|---------|
| `index.html` | The immutable shell (~75 LOC). Contains **no** content and **no** personal data. |
| `app.js` | Universal renderer + SPA router. Loads JSON, applies theme, renders layouts, DE/EN, Dark/Light, meta injection. |
| `content/index.json` | Manifest: routes, section order, layout engines, navigation. |
| `content/meta.json` | Site metadata driving `<head>`, branding and contact. |
| `content/*.json` | Neutral example content (bilingual). |
| `theme/` | `theme.json` (tokens) + `style.css`. |
| `assets/` | Placeholder assets. |
| `serve.py` | Zero-dependency SPA-aware dev server. |
| `README.md`, `LICENSE`, `.gitignore` | Public project files. |

Layout engines: `hero` · `marquee` · `grid-2` · `grid-3` · `manifest` ·
`text-split` · `blog-list` · `kontakt` · auto `<dl>` fallback.

---

## 3. Working principles

1. **No hardcoded brand or personal data** in `index.html`/`app.js` — everything
   flows from `content/meta.json` at runtime (title, description, canonical,
   Open Graph, JSON-LD, brand slots `[data-brand]`, header contact).
2. **Schema discipline:** when the content schema changes, update `app.js`
   **and** the example JSON under `content/` together.
3. **Stay dependency-free.** No npm packages, no CDNs, no frameworks in core.
4. **Neutral examples only.** `content/` must never contain real companies,
   people, phone numbers, addresses, or personal photos.
5. **Atomic commits**, clear messages (English), one topic per commit.
6. **Verify before commit:** JSON valid, all routes render, console clean.

---

## 4. Local development & verification

```bash
git clone https://github.com/johnbubak/jcms.git && cd jcms
python3 serve.py 8080            # http://localhost:8080

# JSON must be valid
python3 -c "import json, glob; [json.load(open(f)) for f in glob.glob('content/**/*.json', recursive=True)]; print('ALL_JSON_OK')"
```

Manual checks: DE/EN toggle, Dark/Light, deep links (`/leistungen`,
`/blog/hello-world`), contact form fallback, and an empty console.

---

## 5. Relationship with downstream implementations (jan.bobka.net)

**jan.bobka.net is the reference implementation and a separate downstream repo.**
It vendors a copy of the framework core (`app.js`, `theme/*`, `serve.py`, shell
mechanics of `index.html`).

### Upstream-first rule

| Change type | Where it belongs |
|-------------|------------------|
| Generic / reusable (renderer, layouts, theme tokens, dev server, shell mechanics, docs) | **Here (JCMS) first**, then downstream syncs |
| Site-specific (content, personal data, SEO files, deploy config, assets) | **Downstream only** — never here |
| Bug affecting both | Fix **here**, then downstream pulls |

**One sentence:** *If someone else could use it without any Jan context, it
belongs to JCMS.*

### What must NEVER enter this repo
- Personal data (name, phone, address, photos, client/internal details).
- A specific site's `content/`, deploy scripts, legal pages, or backend.
- Server, tunnel or credential internals.

### Keeping the core and downstream in sync

1. Land generic changes **here** first (branch → PR/commit → tag/release).
2. Downstream copies the core files from a local checkout of this repo and
   commits with a clear `sync JCMS core vX.Y.Z` note.
3. Any lasting divergence in generic areas means an upstream port is overdue —
   avoid maintaining parallel truths.

### Versioning
- Tag releases; keep `version` fields in `content/index.json` and `theme/theme.json` current.
- Downstream records which core version it vendored.

---

## 6. Contribution workflow

```
main ──▶ feature branch ──▶ PR ──▶ review ──▶ squash-merge ──▶ tag (optional)
```

- Keep the public API/schema backwards-compatible where possible; document
  breaking changes in the PR and bump the version.
- Update `README.md` when behaviour or structure changes.
- Never commit secrets, local assets (`assets/*.webp`, `*.jpg`, …), or logs.

---

## 7. Definition of Done

- [ ] `ALL_JSON_OK` and SVGs/XML well-formed.
- [ ] `serve.py` renders all routes, DE+EN, Dark+Light, no console errors, no 404s.
- [ ] No personal data; no new dependencies; shell still content-free.
- [ ] README/version updated if needed.
- [ ] Committed and pushed (GitHub `origin`; Gitea `gitea`/LAN remote).
