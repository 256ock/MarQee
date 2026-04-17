# MarQee — RSS Ticker

**Scroll your favorite RSS feeds as a sleek, customizable news ticker on any website.**  
**お気に入りのRSSフィードを、あらゆるWebサイト上でスタイリッシュなニュースティッカーとして表示。**

![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen)

---

## Overview / 概要

MarQee is a Chrome extension (Manifest V3) that injects a customizable RSS ticker bar into any web page. Register your RSS feeds, choose a visual style, and let the news flow — at the top or bottom of every site you visit.

MarQeeは、Chrome拡張機能（Manifest V3）です。任意のWebページにカスタマイズ可能なRSSティッカーバーを挿入します。RSSフィードを登録してビジュアルスタイルを選ぶだけで、訪問したすべてのサイトの上部または下部にニュースが流れ始めます。

---

## Features / 機能

- **Live RSS Ticker** — Horizontal scroll, horizontal push, or vertical push modes  
  **リアルタイムRSSティッカー** — 水平スクロール・水平プッシュ・垂直プッシュの3モード

- **Multiple Color Schemes** — System, Light, Dark, Neon Blue, Amber Retro, Tricolor LED, Emerald, Monochrome, or fully custom colors  
  **豊富なカラースキーム** — System / Light / Dark / Neon Blue / Amber Retro / Tricolor LED / Emerald / Monochrome、またはフルカスタムカラー

- **Visual Effects** — Glassmorphism blur or retro LED grid overlay  
  **ビジュアルエフェクト** — グラスモーフィズムブラーまたはレトロLEDグリッドオーバーレイ

- **Article Filtering** — Age window (1–72h), sort order, blink new articles, group by source  
  **記事フィルタリング** — 時間ウィンドウ（1〜72時間）・ソート順・新着点滅・ソース別グループ表示

- **Domain Filter** — Exclude or include-only specific domains  
  **ドメインフィルター** — 特定ドメインでの非表示・表示専用設定

- **RSS Auto-Detection** — One-tap add banner when the current tab contains an RSS feed  
  **RSS自動検出** — 現在のタブにRSSフィードがある場合、ワンタップ登録バナーを表示

- **Backup & Restore** — Export/import all settings and feeds as JSON  
  **バックアップ・復元** — 設定とフィードをJSONでエクスポート/インポート

- **Shadow DOM Isolation** — Ticker styles never clash with the host page  
  **Shadow DOM分離** — ティッカースタイルがページCSSと衝突しない設計

---

## Installation / インストール

### From Chrome Web Store / Chromeウェブストア

*(Coming soon / 近日公開予定)*

### Load Unpacked (Developer) / ローカル読み込み（開発者向け）

1. Clone or download this repository  
   リポジトリをクローンまたはダウンロード

2. Open `chrome://extensions/` in Chrome  
   Chromeで `chrome://extensions/` を開く

3. Enable **Developer mode** (top-right toggle)  
   右上の **デベロッパーモード** を有効化

4. Click **Load unpacked** and select this folder  
   **パッケージ化されていない拡張機能を読み込む** をクリックし、このフォルダを選択

5. The MarQee icon appears in the toolbar — click it to open settings  
   ツールバーにMarQeeアイコンが表示されます。クリックして設定を開く

---

## Settings / 設定タブ

| Tab / タブ | Contents / 内容 |
|-----------|----------------|
| **General** | Position, scroll mode, speed, hover pause, domain filter |
| **Feeds** | Update interval, add/edit/delete RSS feeds |
| **Articles** | Age filter, sort order, blink new, group by source |
| **Appearance** | Color scheme, custom colors, font, glass/LED effects |
| **Backup** | Export & import settings + feeds as JSON |

---

## Architecture / アーキテクチャ

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

### File Structure / ファイル構成

| File | Role / 役割 |
|------|------------|
| `manifest.json` | Extension metadata & permissions |
| `background.js` | RSS fetching, caching, update scheduling |
| `content.js` | Shadow DOM injection, ticker rendering |
| `content.css` | Ticker styles (`mq-` prefix, CSS variables) |
| `index.html` | Settings popup (5 tabs) |
| `script.js` | Popup logic, storage sync, event handlers |
| `style.css` | Settings popup styles |

---

## Permissions / 権限

| Permission | Reason / 理由 |
|-----------|--------------|
| `storage` | Save settings and feeds locally / 設定とフィードをローカル保存 |
| `activeTab` | Detect RSS on the current tab / 現在タブのRSS検出 |
| `alarms` | Schedule periodic feed updates / フィード定期更新スケジュール |
| `*://*/*` (host) | Inject ticker on all websites / 全サイトへのティッカー注入 |

---

## Development Notes / 開発メモ

- **RSS parsing** uses regex (no `DOMParser` in Service Workers), max 30 articles per feed  
  RSSパースは正規表現ベース（Service Worker内でDOMParser不可）、最大30件/フィード

- **Cache** lives in Service Worker memory; clears when the worker goes idle  
  キャッシュはService Workerのメモリ上に存在し、アイドル時に消失

- **LED effect** only applies in dark mode  
  LEDエフェクトはダークモード専用

- **CSS classes** always use `mq-` prefix to avoid host-page conflicts  
  CSSクラスは常に `mq-` プレフィックス付き（ホストページとの衝突防止）

- When adding a new storage key, register its default in `background.js` (`onInstalled`) and add it to the `chrome.storage.local.get()` list in `content.js`  
  ストレージキー追加時は `background.js` の `onInstalled` にデフォルト値を追加し、`content.js` の `get()` リストにも追加すること

---

## License / ライセンス

MIT
