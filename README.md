# MarQee — RSS Ticker

**Scroll your favorite RSS feeds as a sleek, customizable news ticker on any website.**

![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.1-brightgreen)

---

## Overview

MarQee is a Chrome extension (Manifest V3) that injects a customizable RSS ticker bar into any web page. Register your RSS feeds, choose a visual style, and let the news flow — at the top or bottom of every site you visit.

MarQee works with RSS feeds in **any language** — it just reads whatever text the feed publishes, so a feed in Japanese, French, or any other left-to-right language scrolls exactly like an English one.

*(For readers who don't speak English: MarQee has no built-in language restriction. It will display headlines in whatever language your chosen feeds are written in — Japanese, Korean, Chinese, French, and so on all work.)*

> **Note:** The horizontal scroll direction is fixed right-to-left and isn't mirrored for right-to-left languages (e.g. Arabic, Hebrew) yet. Feed text still displays correctly — only the scrolling direction doesn't match the reading direction.

---

## Features

- **Live RSS Ticker** — Horizontal scroll, horizontal push, or vertical push modes
- **Multiple Color Schemes** — System, Light, Dark, Neon Blue, Amber Retro, Tricolor LED, Emerald, Monochrome, or fully custom colors
- **Visual Effects** — Glassmorphism blur or retro LED grid overlay
- **Article Filtering** — Age window (1–72h), sort order, blink new articles, group by source
- **Domain Filter** — Exclude or include-only specific domains
- **RSS Auto-Detection** — One-tap add banner when the current tab contains an RSS feed
- **Backup & Restore** — Export/import all settings and feeds as JSON
- **Shadow DOM Isolation** — Ticker styles never clash with the host page

---

## Installation

### Chrome Web Store

MarQee has **not been published to the Chrome Web Store yet**. Until it is, the only way to install it is via Developer Mode below.

### Load Unpacked (Developer Mode — currently the only install method)

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select this folder
5. The MarQee icon appears in the toolbar — click it to open settings

---

## Settings

| Tab | Contents |
|-----------|----------------|
| **General** | Position, scroll mode, speed, hover pause, domain filter |
| **Feeds** | Update interval, add/edit/delete RSS feeds |
| **Articles** | Age filter, sort order, blink new, group by source |
| **Appearance** | Color scheme, custom colors, font, glass/LED effects |
| **Backup** | Export & import settings + feeds as JSON |

---

## Architecture

```
Popup (index.html + script.js)
    ↕ chrome.storage.local
Service Worker (background.js)
    → RSS fetch (regex-based, up to 30 articles/feed)
    → In-memory cache (1h TTL)
    → chrome.runtime.sendMessage
Content Script (content.js)
    → Shadow DOM injection at document_start
    → Ticker rendering (content.css)
```

### File Structure

| File | Role |
|------|------------|
| `manifest.json` | Extension metadata & permissions |
| `background.js` | RSS fetching, caching, update scheduling |
| `content.js` | Shadow DOM injection, ticker rendering |
| `content.css` | Ticker styles (`mq-` prefix, CSS variables) |
| `index.html` | Settings popup (5 tabs) |
| `script.js` | Popup logic, storage sync, event handlers |
| `style.css` | Settings popup styles |

---

## Permissions

| Permission | Reason |
|-----------|--------------|
| `storage` | Save settings and feeds locally |
| `activeTab` | Detect RSS on the current tab |
| `alarms` | Schedule periodic feed updates |
| `*://*/*` (host) | Inject ticker on all websites |

See the [privacy policy](https://256ock.github.io/MarQee/) for a full explanation of what each permission is used for.

---

## Development Notes

- **RSS parsing** uses regex (no `DOMParser` in Service Workers), max 30 articles per feed
- **Cache** lives in Service Worker memory; clears when the worker goes idle
- **LED effect** only applies in dark mode
- **CSS classes** always use `mq-` prefix to avoid host-page conflicts
- When adding a new storage key, register its default in `defaults.js` (`DEFAULT_SETTINGS`) and add it to the `chrome.storage.local.get()` list in `content.js`

---

## License

MIT
