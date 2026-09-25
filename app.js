/**
 * JCMS — JSON Content Management System
 * app.js — theme-agnostischer Renderer
 *
 * Prinzipien:
 * - Content = JSON laden, Theme = theme.json, Shell = index.html (nie anfassen)
 * - Bilingual DE/EN via localStorage
 * - Bekannte Keys → spezifische Templates
 * - Unbekannte Keys → <dl><dt><dd> automatisch
 * - History API + Intersection Observer für saubere URLs
 * - GodMode: keine externen Abhängigkeiten, kein Build-Schritt
 */

(() => {
  'use strict';

  // ── State ───────────────────────────────────────────────────
  let lang  = localStorage.getItem('lang')  || 'de';
  let dark  = localStorage.getItem('dark')  !== 'false'; // default: dark
  let manifest  = null;
  let meta      = {};
  let sectionData = {};
  let observer  = null;
  let isBlogPost = false;

  // ── Helpers ─────────────────────────────────────────────────

  // Localized text: obj.key_de / obj.key_en / obj.key
  const t = (obj, key) => {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[`${key}_${lang}`] ?? obj[key] ?? '';
  };

  // Escape HTML
  const esc = s => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Fetch JSON (with fallback to null on error)
  const fetchJSON = async url => {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  };

  // Format date (ISO → localized)
  const formatDate = iso => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(
        lang === 'de' ? 'de-DE' : 'en-GB',
        { year: 'numeric', month: 'long', day: 'numeric' }
      );
    } catch { return iso; }
  };

  // ── Site meta (no brand/person data is ever hardcoded in the shell) ──

  const siteName = () => (meta && meta.site_name) || 'JCMS';

  // Absolute URL (for canonical / og:image)
  const absUrl = u => {
    if (!u) return '';
    if (/^https?:\/\//.test(u)) return u;
    const base = (meta.url || location.origin).replace(/\/$/, '');
    return base + (u.startsWith('/') ? u : `/${u}`);
  };

  const setNamed = (name, val) => {
    if (val == null || val === '') return;
    let m = document.querySelector(`meta[name="${name}"]`);
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', name); document.head.appendChild(m); }
    m.setAttribute('content', val);
  };

  const setProp = (prop, val) => {
    if (val == null || val === '') return;
    let m = document.querySelector(`meta[property="${prop}"]`);
    if (!m) { m = document.createElement('meta'); m.setAttribute('property', prop); document.head.appendChild(m); }
    m.setAttribute('content', val);
  };

  const setCanonical = url => {
    if (!url) return;
    let l = document.querySelector('link[rel="canonical"]');
    if (!l) { l = document.createElement('link'); l.rel = 'canonical'; document.head.appendChild(l); }
    l.setAttribute('href', url);
  };

  // Populate <head>, all [data-brand] slots and the header contact from meta.json
  const applyMeta = () => {
    const brand = siteName();
    document.querySelectorAll('[data-brand]').forEach(el => { el.textContent = brand; });

    const tagline = t(meta, 'tagline');
    const title = meta.title || (tagline ? `${brand} — ${tagline}` : brand);
    document.title = title;

    const desc = t(meta, 'description');
    setNamed('description', desc);
    setNamed('author', meta.author || brand);
    setNamed('twitter:card', 'summary_large_image');
    setNamed('twitter:title', title);
    if (meta.og_image) setNamed('twitter:image', absUrl(meta.og_image));

    setProp('og:title', title);
    setProp('og:description', desc);
    setProp('og:type', 'website');
    if (meta.url) { setProp('og:url', meta.url); setCanonical(meta.url); }
    if (meta.og_image) setProp('og:image', absUrl(meta.og_image));
    if (meta.locale_de) setProp('og:locale', meta.locale_de);
    if (meta.locale_en) setProp('og:locale:alternate', meta.locale_en);

    renderJsonLd();
    renderHeaderContact();
  };

  const renderJsonLd = () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': meta.schema_type || 'Organization',
      name: siteName()
    };
    if (meta.url) ld.url = meta.url;
    if (meta.email) ld.email = meta.email;
    if (t(meta, 'description')) ld.description = t(meta, 'description');
    if (t(meta, 'job_title')) ld.jobTitle = t(meta, 'job_title');
    if (meta.country) ld.address = { '@type': 'PostalAddress', addressCountry: meta.country };
    if (meta.github) ld.sameAs = [/^https?:\/\//.test(meta.github) ? meta.github : `https://github.com/${meta.github}`];

    let s = document.getElementById('jcms-json-ld');
    if (!s) {
      s = document.createElement('script');
      s.type = 'application/ld+json';
      s.id = 'jcms-json-ld';
      document.head.appendChild(s);
    }
    s.textContent = JSON.stringify(ld, null, 2);
  };

  const renderHeaderContact = () => {
    const el = document.getElementById('header-contact');
    if (!el) return;
    const parts = [];
    const telHref = meta.phone_href || meta.phone;
    if (meta.phone && telHref) {
      parts.push(`<a href="tel:${esc(telHref)}" class="contact-tel" aria-label="Call"><span class="icon" aria-hidden="true">☏</span><span class="tel-text">${esc(meta.phone)}</span></a>`);
    }
    if (meta.email) {
      parts.push(`<a href="mailto:${esc(meta.email)}" class="contact-mail" aria-label="Email"><span class="icon" aria-hidden="true">✉</span></a>`);
    }
    el.innerHTML = parts.join('');
  };

  // ── Theme ────────────────────────────────────────────────────

  const applyTheme = async () => {
    const themeData = await fetchJSON('/theme/theme.json');
    if (!themeData) return;

    const colors = dark
      ? themeData.colors?.dark
      : themeData.colors?.light;

    if (colors) {
      const root = document.documentElement;
      Object.entries(colors).forEach(([k, v]) => root.style.setProperty(k, v));
    }

    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.getElementById('theme-icon').textContent = dark ? '☀' : '☾';

    // Ticker speed
    if (themeData.animation?.marquee_speed) {
      document.documentElement.style.setProperty('--marquee-speed', themeData.animation.marquee_speed);
    }
  };

  const toggleTheme = () => {
    dark = !dark;
    localStorage.setItem('dark', dark);
    applyTheme();
  };

  // ── Language ─────────────────────────────────────────────────

  const applyLang = () => {
    document.documentElement.lang = lang;
    document.getElementById('lang-label').textContent = lang === 'de' ? 'EN' : 'DE';
  };

  const toggleLang = () => {
    lang = lang === 'de' ? 'en' : 'de';
    localStorage.setItem('lang', lang);
    applyLang();
    // Aktuelle Ansicht neu rendern (Section-Seite oder Blog-Post)
    if (isBlogPost) {
      const slug = location.pathname.replace('/blog/', '').replace(/\/$/, '');
      renderBlogPost(slug);
    } else {
      renderAllSections();
    }
  };

  // ── Navigation ───────────────────────────────────────────────

  const buildNav = () => {
    if (!manifest) return;
    const nav = document.getElementById('main-nav');
    const footerNav = document.getElementById('footer-nav');
    if (!nav) return;

    const links = manifest.nav || [];
    nav.innerHTML = links.map(item => `
      <a href="${esc(item.href)}" data-route="${esc(item.href)}" data-link>
        ${esc(t(item, 'label'))}
      </a>
    `).join('');

    if (footerNav) {
      const fLinks = manifest.footer_nav || links;
      footerNav.innerHTML = fLinks.map(item => `
        <a href="${esc(item.href)}" data-route="${esc(item.href)}" data-link>
          ${esc(t(item, 'label'))}
        </a>
      `).join('');
    }

    setActiveNav(location.pathname);
  };

  const setActiveNav = path => {
    document.querySelectorAll('#main-nav a[data-route]').forEach(a => {
      const route = a.dataset.route;
      const isActive = route === '/'
        ? path === '/'
        : path.startsWith(route);
      a.classList.toggle('active', isActive);
    });
  };

  // ── Routing ──────────────────────────────────────────────────

  const handleClick = e => {
    const a = e.target.closest('a[data-link]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    navigate(href);
  };

  const navigate = (path, replace = false) => {
    if (replace) {
      history.replaceState(null, '', path);
    } else {
      history.pushState(null, '', path);
    }
    setActiveNav(path);
    route(path);
  };

  const route = async path => {
    // Blog post?
    if (path.startsWith('/blog/') && path.length > 6) {
      const slug = path.replace('/blog/', '').replace(/\/$/, '');
      await renderBlogPost(slug);
      return;
    }
    // Static pages handled by their own HTML files — don't intercept
    if (path === '/impressum' || path === '/datenschutz') {
      window.location.href = path;
      return;
    }
    // Regular section page — scroll to section
    renderAllSections();
    requestAnimationFrame(() => {
      scrollToSection(path, false); // instant beim Nav-Klick innerhalb der Site
    });
  };

  const scrollToSection = (path, animate = true) => {
    if (path === '/') {
      window.scrollTo({ top: 0, behavior: animate ? 'smooth' : 'instant' });
      return;
    }
    const section = manifest?.sections?.find(s => s.route === path);
    if (!section) return;
    const el = document.getElementById(`section-${section.id}`);
    if (el) {
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
      const top = el.getBoundingClientRect().top + window.scrollY - offset - 1;
      window.scrollTo({ top, behavior: animate ? 'smooth' : 'instant' });
    }
  };

  // Intersection Observer: update URL on scroll
  const setupObserver = () => {
    if (observer) observer.disconnect();

    const sections = manifest?.sections?.filter(s => s.route) || [];
    if (!sections.length) return;

    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id.replace('section-', '');
          const section = manifest.sections.find(s => s.id === id);
          if (section?.route) {
            history.replaceState(null, '', section.route);
            setActiveNav(section.route);
          }
        }
      });
    }, {
      root: null,
      rootMargin: '-40% 0px -50% 0px',
      threshold: 0
    });

    sections.forEach(s => {
      const el = document.getElementById(`section-${s.id}`);
      if (el) observer.observe(el);
    });
  };

  // ── Renderers ────────────────────────────────────────────────

  const renderAllSections = () => {
    if (!manifest) return;
    isBlogPost = false;
    const main = document.getElementById('site-main');
    main.innerHTML = manifest.sections.map(s => {
      const data = sectionData[s.id];
      return renderSection(s, data);
    }).join('');
    setupObserver();
    setupContactForm();
    setupFadeIn();
    updateFooterTagline();
    document.getElementById('year').textContent = new Date().getFullYear();
  };

  const renderSection = (section, data) => {
    if (!data) return '';
    const id = `section-${section.id}`;
    const layout = section.layout;

    let inner = '';
    switch (layout) {
      case 'hero':      inner = renderHero(data); break;
      case 'marquee':   inner = renderMarquee(data); break;
      case 'grid-3':    inner = renderGrid(data, 3); break;
      case 'grid-2':    inner = renderGrid(data, 2); break;
      case 'manifest':  inner = renderManifest(data); break;
      case 'text-split':inner = renderTextSplit(data); break;
      case 'blog-list': inner = renderBlogList(data); break;
      case 'kontakt':   inner = renderKontakt(data); break;
      default:          inner = renderAuto(data);
    }
    return `<section id="${id}" class="section-${layout}" aria-labelledby="title-${section.id}">${inner}</section>`;
  };

  // Hero
  const renderHero = data => {
    const d = data[lang] || data;
    const stats = (data.stats || []).map(s => `
      <div class="stat-item">
        <span class="stat-value">${esc(s.wert)}</span>
        <span class="stat-label">${esc(lang === 'de' ? s.label_de : s.label_en)}</span>
      </div>
    `).join('');

    const fotoAlt = lang === 'de' ? (data.foto_alt_de || '') : (data.foto_alt_en || '');
    const foto = data.foto
      ? `<img src="${esc(data.foto)}" alt="${esc(fotoAlt)}" class="hero-photo" loading="eager" width="420" height="560">`
      : `<div class="hero-photo-placeholder" aria-hidden="true"><span>${esc(siteName().toUpperCase())}</span></div>`;

    return `
      <div class="hero-content fade-in">
        <div>
          <h1 class="hero-tagline">${esc(d.tagline || '')}</h1>
          <p class="hero-untertitel">${esc(d.untertitel || '')}</p>
        </div>
        ${d.beschreibung ? `<p class="hero-beschreibung">${esc(d.beschreibung)}</p>` : ''}
        <div class="hero-ctas">
          ${d.cta_primary ? `<a href="${esc(d.cta_primary_href || '/leistungen')}" class="btn btn-primary" data-link>${esc(d.cta_primary)}</a>` : ''}
          ${d.cta_secondary ? `<a href="${esc(d.cta_secondary_href || '/kontakt')}" class="btn btn-secondary" data-link>${esc(d.cta_secondary)}</a>` : ''}
        </div>
        ${stats ? `<div class="hero-stats">${stats}</div>` : ''}
      </div>
      <div class="hero-image fade-in">
        ${foto}
      </div>
    `;
  };

  // Marquee Ticker
  const renderMarquee = data => {
    const items = data[lang] || data.items || [];
    const sep = data.separator || '//';
    const doubled = [...items, ...items]; // duplicate for seamless loop
    const track = doubled.map(item => `
      <span class="ticker-item" data-sep="${esc(sep)}">${esc(item)}</span>
    `).join('');
    return `<div class="ticker-track">${track}</div>`;
  };

  // Grid (3 or 2 columns)
  const renderGrid = (data, cols) => {
    const d = data[lang] || data;
    const titel = t(data, 'titel');
    const untertitel = t(data, 'untertitel');
    const items = data.items || [];

    const cards = items.map(item => {
      const titel_item = t(item, 'titel');
      const text = t(item, 'text');
      const status = t(item, 'status');
      const tags = item.tags || [];
      const links = [];
      if (item.link) links.push({ href: item.link, label: item.link.replace(/^https?:\/\//, '') });
      if (item.link_github) links.push({ href: item.link_github, label: 'GitHub' });

      return `
        <div class="grid-card fade-in">
          ${item.icon ? `<span class="card-icon" aria-hidden="true">${esc(item.icon)}</span>` : ''}
          ${status ? `<span class="card-status">${esc(status)}</span>` : ''}
          <h3 class="card-title">${esc(titel_item)}</h3>
          ${text ? `<p class="card-text">${esc(text)}</p>` : ''}
          ${tags.length ? `<div class="card-tags">${tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>` : ''}
          ${links.length ? `<div class="card-links">${links.map(l => `<a href="${esc(l.href)}" class="card-link" target="_blank" rel="noopener noreferrer">${esc(l.label)} →</a>`).join('')}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="section-header fade-in" id="title-leistungen">
        <h2 class="section-title">${esc(titel)}</h2>
        ${untertitel ? `<p class="section-subtitle">${esc(untertitel)}</p>` : ''}
      </div>
      <div class="grid-${cols}">${cards}</div>
    `;
  };

  // Manifest Quote
  const renderManifest = data => {
    const zitat = t(data, 'zitat');
    // Highlight last word
    const words = zitat.split(' ');
    const last = words.pop();
    const highlighted = `${esc(words.join(' '))} <em>${esc(last)}</em>`;

    return `
      <div class="manifest-inner fade-in">
        <blockquote class="manifest-quote">${highlighted}</blockquote>
        ${data.autor ? `<cite class="manifest-autor">— ${esc(data.autor)}</cite>` : ''}
        ${data.kontext_de ? `<p class="manifest-kontext">${esc(t(data, 'kontext'))}</p>` : ''}
      </div>
    `;
  };

  // Text Split (Über)
  const renderTextSplit = data => {
    const d = data[lang] || data;
    const titel = t(data, 'titel');
    const untertitel = t(data, 'untertitel');
    const tags = lang === 'de' ? (data.tags_de || []) : (data.tags_en || []);
    const verfuegbar = lang === 'de' ? data.de?.verfuegbar_de : data.en?.verfuegbar_en;

    const vita = (data.vita || []).map(v => `
      <div class="vita-item">
        <span class="vita-jahr">${esc(v.jahr)}</span>
        <div class="vita-content">
          <span class="vita-moment">${esc(v.moment)}</span>
          <span class="vita-warum">${esc(lang === 'de' ? v.warum_de : v.warum_en)}</span>
        </div>
      </div>
    `).join('');

    const foto = data.foto
      ? `<img src="${esc(data.foto)}" alt="${esc(lang === 'de' ? data.foto_alt_de : data.foto_alt_en)}" class="ueber-foto" loading="lazy">`
      : '';

    return `
      <div class="section-header fade-in" style="grid-column:1/-1">
        <h2 class="section-title" id="title-ueber">${esc(titel)}</h2>
        ${untertitel ? `<p class="section-subtitle">${esc(untertitel)}</p>` : ''}
      </div>
      <div class="text-split-left fade-in">
        ${foto}
        ${tags.length ? `<div class="ueber-tags">${tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>` : ''}
        ${verfuegbar ? `<span class="ueber-verfuegbar">${esc(verfuegbar)}</span>` : ''}
      </div>
      <div class="text-split-right fade-in">
        ${d.haupttext ? `<p class="ueber-haupttext">${esc(d.haupttext)}</p>` : ''}
        ${d.subtext ? `<p class="ueber-subtext">${esc(d.subtext)}</p>` : ''}
        ${vita ? `<div class="vita-timeline">${vita}</div>` : ''}
      </div>
    `;
  };

  // Blog List
  const renderBlogList = data => {
    const titel = t(data, 'titel');
    const untertitel = t(data, 'untertitel');
    const posts = data.posts || [];

    const cards = posts.map(post => {
      const postTitel = t(post, 'titel');
      const teaser = t(post, 'teaser');
      const kat = t(post, 'kategorie');
      const lese = t(post, 'lesedauer');
      return `
        <article class="blog-post-card fade-in" role="link" tabindex="0"
          data-slug="${esc(post.slug)}"
          onclick="window.__jcms.navigateTo('/blog/${esc(post.slug)}')"
          onkeydown="if(event.key==='Enter')window.__jcms.navigateTo('/blog/${esc(post.slug)}')">
          <div>
            <div class="post-datum">${esc(formatDate(post.datum))}</div>
          </div>
          <div>
            <div class="post-titel">${esc(postTitel)}</div>
            ${teaser ? `<p class="post-teaser">${esc(teaser)}</p>` : ''}
            <div class="post-meta">
              ${kat ? `<span class="post-kategorie">${esc(kat)}</span>` : ''}
              <span>·</span>
              ${lese ? `<span class="post-lesedauer">${esc(lese)}</span>` : ''}
            </div>
          </div>
          <div class="post-arrow" aria-hidden="true">→</div>
        </article>
      `;
    }).join('');

    return `
      <div class="section-header fade-in">
        <h2 class="section-title" id="title-blog">${esc(titel)}</h2>
        ${untertitel ? `<p class="section-subtitle">${esc(untertitel)}</p>` : ''}
      </div>
      <div class="blog-posts">${cards}</div>
    `;
  };

  // Blog Single Post
  const renderBlogPost = async slug => {
    isBlogPost = true;
    if (observer) observer.disconnect();

    const main = document.getElementById('site-main');
    main.innerHTML = `<section class="section-blog-post"><div style="text-align:center;padding:4rem;color:var(--text-dim)">Wird geladen…</div></section>`;

    // Try API first, fallback to static JSON
    let post = await fetchJSON(`/api/blog/${slug}`);
    if (!post) post = await fetchJSON(`/content/blog/${slug}.json`);
    if (!post) {
      main.innerHTML = `<section class="section-blog-post">
        <a href="/blog" class="blog-back" data-link>← Blog</a>
        <h1 class="post-titel">Post nicht gefunden.</h1>
      </section>`;
      return;
    }

    const titel = lang === 'de' ? post.titel_de : post.titel_en;
    const inhalt = lang === 'de' ? post.inhalt_de : post.inhalt_en;
    const kat = lang === 'de' ? post.kategorie_de : post.kategorie_en;
    const lese = lang === 'de' ? post.lesedauer_de : post.lesedauer_en;

    const blocks = (inhalt || []).map(block => {
      if (block.typ === 'p') return `<p>${esc(block.text)}</p>`;
      if (block.typ === 'h2') return `<h2>${esc(block.text)}</h2>`;
      if (block.typ === 'ul') return `<ul>${(block.items||[]).map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`;
      return `<p>${esc(block.text || '')}</p>`;
    }).join('');

    main.innerHTML = `
      <section class="section-blog-post" id="section-blog-post">
        <a href="/blog" class="blog-back" data-link>← ${lang==='de'?'Alle Artikel':'All posts'}</a>
        <header class="blog-post-header">
          <div class="post-meta" style="margin-bottom:1rem">
            ${kat ? `<span class="post-kategorie">${esc(kat)}</span>` : ''}
            <span>·</span>
            <span class="post-lesedauer">${esc(lese||'')}</span>
            <span>·</span>
            <span class="post-datum">${esc(formatDate(post.datum))}</span>
          </div>
          <h1 class="post-titel">${esc(titel)}</h1>
        </header>
        <div class="blog-post-content">${blocks}</div>
      </section>
    `;

    document.title = `${titel} — ${siteName()}`;
    window.scrollTo({ top: 0 });
    setupFadeIn();
    setupDelegatedLinks();
  };

  // Kontakt Form
  const renderKontakt = data => {
    const d = lang === 'de' ? data.de : data.en;
    const titel = t(data, 'titel');
    const untertitel = t(data, 'untertitel');
    const fragen = data.fragen || [];
    const direkt = lang === 'de' ? data.direkt_de : data.direkt_en;
    const mailAddr = data.email || meta.email || '';
    const telAddr = data.telefon || '';
    const telLink = data.telefon_href || data.telefon || '';

    const formFields = fragen.map(f => {
      const frage = lang === 'de' ? f.frage_de : f.frage_en;
      const ph = lang === 'de' ? f.placeholder_de : f.placeholder_en;
      const pflichtMark = f.pflicht ? `<span aria-label="Pflichtfeld">*</span>` : '';

      let input = '';
      if (f.typ === 'text') {
        input = `<input type="text" class="form-input" name="${esc(f.id)}" placeholder="${esc(ph||'')}" ${f.pflicht?'required':''} autocomplete="off">`;
      } else if (f.typ === 'textarea') {
        input = `<textarea class="form-textarea" name="${esc(f.id)}" placeholder="${esc(ph||'')}" ${f.pflicht?'required':''}></textarea>`;
      } else if (f.typ === 'choice') {
        const opts = (f.optionen || []).map(o => {
          const label = lang === 'de' ? o.label_de : o.label_en;
          return `<button type="button" class="choice-btn" data-name="${esc(f.id)}" data-value="${esc(o.wert)}">${esc(label)}</button>`;
        }).join('');
        input = `<div class="choice-group">${opts}</div>`;
      }

      return `
        <div class="form-frage">
          <label class="frage-label" for="${esc(f.id)}">${esc(frage)} ${pflichtMark}</label>
          ${input}
        </div>
      `;
    }).join('');

    return `
      <div class="kontakt-form-col fade-in">
        <div class="section-header" style="margin-bottom:2rem">
          <h2 class="section-title" id="title-kontakt">${esc(titel)}</h2>
          ${untertitel ? `<p class="section-subtitle">${esc(untertitel)}</p>` : ''}
        </div>
        ${d?.intro ? `<p style="margin-bottom:2rem;font-size:0.88rem;color:var(--text-muted)">${esc(d.intro)}</p>` : ''}
        <form id="kontakt-form" class="kontakt-form" novalidate>
          ${formFields}
          <div class="form-submit-row">
            <button type="submit" class="btn btn-primary">${esc(lang==='de'?data.submit_de:data.submit_en)}</button>
          </div>
          <div id="form-message" class="form-message" role="alert" aria-live="polite"></div>
        </form>
      </div>
      <div class="kontakt-direkt fade-in">
        ${d?.intro ? '' : ''}
        <p class="kontakt-intro">${esc(direkt||'')}</p>
        <div class="direkt-links">
          ${mailAddr ? `<a href="mailto:${esc(mailAddr)}" class="direkt-link"><span class="icon">✉</span><span>${esc(mailAddr)}</span></a>` : ''}
          ${telAddr ? `<a href="tel:${esc(telLink)}" class="direkt-link"><span class="icon">☏</span><span>${esc(telAddr)}</span></a>` : ''}
        </div>
      </div>
    `;
  };

  // Auto-Render Fallback (unknown layout)
  const renderAuto = data => {
    const entries = Object.entries(data).filter(([k]) => !k.startsWith('_'));
    const rows = entries.map(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`;
    }).join('');
    return `<div class="auto-render"><dl>${rows}</dl></div>`;
  };

  // ── Contact Form Logic ────────────────────────────────────────

  const setupContactForm = () => {
    const form = document.getElementById('kontakt-form');
    if (!form) return;

    // Choice buttons
    form.querySelectorAll('.choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        form.querySelectorAll(`.choice-btn[data-name="${name}"]`).forEach(b => {
          b.classList.remove('selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-pressed', 'true');
      });
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = document.getElementById('form-message');
      const btn = form.querySelector('[type="submit"]');
      const kontaktData = sectionData['kontakt'] || {};

      // Collect data
      const payload = { lang };
      form.querySelectorAll('.form-input, .form-textarea').forEach(el => {
        if (el.name) payload[el.name] = el.value.trim();
      });
      form.querySelectorAll('.choice-btn.selected').forEach(el => {
        if (el.dataset.name) payload[el.dataset.name] = el.dataset.value;
      });

      // Simple validation
      const nameField = form.querySelector('[name="name"]');
      const kontaktField = form.querySelector('[name="kontakt"]');
      if (!payload.name || !payload.kontakt) {
        nameField?.focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = '…';

      try {
        const r = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (r.ok) {
          const d = kontaktData[lang] || {};
          msg.textContent = `${d.success_titel || 'Gesendet.'} ${d.success_text || ''}`;
          msg.className = 'form-message success visible';
          form.reset();
          form.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
        } else {
          throw new Error('Server error');
        }
      } catch {
        // No backend attached (static hosting) → mailto fallback that keeps the typed content
        const mail = kontaktData.email || meta.email || '';
        const d = (kontaktData[lang] || kontaktData.de || {});
        if (!mail) {
          msg.textContent = d.error_text || 'Submission error.';
          msg.className = 'form-message error visible';
        } else {
          const lines = Object.entries(payload)
            .filter(([k, v]) => k !== 'lang' && v)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');
          const subject = encodeURIComponent(lang === 'de'
            ? `Anfrage über ${siteName()}`
            : `Inquiry via ${siteName()}`);
          const body = encodeURIComponent(lines);
          window.location.href = `mailto:${mail}?subject=${subject}&body=${body}`;
          msg.textContent = lang === 'de'
            ? 'E-Mail-Programm geöffnet — bitte Nachricht nur noch senden.'
            : 'Email client opened — just hit send.';
          msg.className = 'form-message success visible';
        }
      }

      btn.disabled = false;
      btn.textContent = lang === 'de'
        ? (kontaktData.submit_de || 'Absenden')
        : (kontaktData.submit_en || 'Submit');
    });
  };

  // ── Intersection Observer for Fade-In ────────────────────────

  const setupFadeIn = () => {
    const els = document.querySelectorAll('.fade-in:not(.visible)');
    if (!els.length) return;

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.05 });

    els.forEach(el => io.observe(el));
  };

  // ── Delegated Link Handler ────────────────────────────────────

  const setupDelegatedLinks = () => {
    // Already set on document, safe to re-call
  };

  // ── Footer & Meta ─────────────────────────────────────────────

  const updateFooterTagline = () => {
    const el = document.getElementById('footer-tagline');
    if (!el || !meta) return;
    el.textContent = lang === 'de'
      ? (meta.footer_tagline_de || meta.tagline_de || '')
      : (meta.footer_tagline_en || meta.tagline_en || '');
  };

  // ── Boot ──────────────────────────────────────────────────────

  const init = async () => {
    // Apply theme first (prevents flash)
    applyTheme();
    applyLang();

    // Load site metadata first → populate <head>, brand and header contact from meta.json
    meta = await fetchJSON('/content/meta.json') || {};
    applyMeta();

    // Load manifest
    manifest = await fetchJSON('/content/index.json');
    if (!manifest) {
      document.getElementById('site-main').innerHTML =
        '<p style="padding:2rem;color:var(--accent)">Error: content/index.json not found.</p>';
      return;
    }

    // Load all section data in parallel
    const loads = manifest.sections.map(async s => {
      const data = await fetchJSON(`/content/${s.file}`);
      if (data) sectionData[s.id] = data;
    });
    await Promise.all(loads);

    // Build nav
    buildNav();

    // Route initial path
    const path = location.pathname;
    if (path.startsWith('/blog/') && path.length > 6) {
      await renderBlogPost(path.replace('/blog/', ''));
    } else {
      renderAllSections();
      if (path !== '/') {
        // Direkte URL (z.B. /leistungen) → kurz warten bis Layout steht, dann springen
        setTimeout(() => scrollToSection(path, false), 50);
      }
    }

    // Set up controls
    document.getElementById('lang-toggle').addEventListener('click', toggleLang);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.addEventListener('click', handleClick);
    window.addEventListener('popstate', () => {
      const p = location.pathname;
      setActiveNav(p);
      route(p);
    });

    // Year in footer
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  };

  // Expose for onclick handlers
  window.__jcms = { navigateTo: navigate };

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
