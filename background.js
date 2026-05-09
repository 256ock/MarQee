importScripts('defaults.js');

const rssDataCache = new Map(); // url -> { items, timestamp }
const CACHE_TTL = 3600000; // 1 hour in milliseconds
const CLEANUP_ALARM_NAME = 'cacheCleanup';

// Enable Content Script to access chrome.storage.session
async function setAccess() {
    try {
        await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    } catch (e) {
        console.error('Failed to set access level:', e);
    }
}

chrome.runtime.onInstalled.addListener(async () => {
    setAccess();

    // Initialize any missing settings with defaults (incl. newsTickerFeeds).
    const keys = [...ALL_SETTINGS_KEYS, 'newsTickerFeeds'];
    const storage = await chrome.storage.local.get(keys);
    const updates = {};

    for (const key of ALL_SETTINGS_KEYS) {
        if (storage[key] === undefined) updates[key] = DEFAULT_SETTINGS[key];
    }
    if (!storage.newsTickerFeeds) updates.newsTickerFeeds = DEFAULT_FEEDS;

    if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
    }

    initIconState();
});

chrome.runtime.onStartup.addListener(() => {
    setAccess();
    initIconState();
});

// Also run on every SW wake-up so the icon survives idle restarts
setAccess();
initIconState();

async function initIconState() {
    // Release memory on wake-up (clean expired items)
    cleanCache();

    const data = await chrome.storage.local.get('newsTickerBarVisible');
    const isVisible = data.newsTickerBarVisible !== false;
    updateIcon(isVisible);
}

function updateIcon(isTickerVisible) {
    const suffix = isTickerVisible ? '' : '_gray';
    chrome.action.setIcon({
        path: {
            "16": `icons/icon16${suffix}.png`,
            "48": `icons/icon48${suffix}.png`,
            "128": `icons/icon128${suffix}.png`
        }
    });
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.newsTickerBarVisible) {
        updateIcon(changes.newsTickerBarVisible.newValue);
    }
    if (changes.newsTickerFeeds) {
        // Clear in-memory cache
        rssDataCache.clear();

        // Clear session storage: fetch timestamps AND cached item arrays
        chrome.storage.session.get(null).then(allData => {
            const keysToRemove = Object.keys(allData).filter(key =>
                key.startsWith('lastFetch_') || key.startsWith('rssItems_')
            );
            if (keysToRemove.length > 0) {
                chrome.storage.session.remove(keysToRemove);
            }
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== 'fetchRSS') return;

    const { url } = request;

    (async () => {
        try {
            const settings = await chrome.storage.local.get('newsTickerFetchInterval');
            const intervalMinutes = settings.newsTickerFetchInterval || 15;
            const now = Date.now();

            const sessionKey = `lastFetch_${url}`;
            const sessionData = await chrome.storage.session.get(sessionKey);
            const lastFetch = sessionData[sessionKey] || 0;

            const withinInterval = (now - lastFetch < intervalMinutes * 60000);

            // Use in-memory cache if available, within fetch interval, and within TTL
            if (withinInterval && rssDataCache.has(url)) {
                const cached = rssDataCache.get(url);
                if (now - cached.timestamp < CACHE_TTL) {
                    // Refresh session item cache so content scripts on new pages render instantly
                    chrome.storage.session.set({ [`rssItems_${url}`]: cached.items });
                    sendResponse({ success: true, data: cached.items, isUpdated: false });
                    return;
                }
                // TTL expired, remove it and proceed to fetch
                rssDataCache.delete(url);
            }

            // Otherwise fetch new data
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const text = await response.text();

            const items = parseRSS(text);
            rssDataCache.set(url, { items, timestamp: now });

            // Persist both the fetch timestamp and the parsed items.
            // rssItems_* lets content scripts on new pages render instantly without Loading.
            await chrome.storage.session.set({
                [sessionKey]: now,
                [`rssItems_${url}`]: items
            });

            // Only signal content script to reset the ticker when the interval truly elapsed.
            const shouldReset = !withinInterval;
            sendResponse({ success: true, data: items, isUpdated: shouldReset });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
});

function cleanCache() {
    const now = Date.now();
    let count = 0;
    for (const [url, entry] of rssDataCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL) {
            rssDataCache.delete(url);
            count++;
        }
    }
    if (count > 0) {
        console.log(`Cache cleaned: ${count} expired entries removed.`);
    }
}

function decodeXMLEntities(text) {
    if (!text) return "";
    return text.replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&apos;/g, "'")
               .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
               .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractTag(str, tag) {
    const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(str);
    if (!match) return "";
    let content = match[1].trim();
    if (content.startsWith("<![CDATA[") && content.endsWith("]]>")) {
        content = content.substring(9, content.length - 3);
    }
    return decodeXMLEntities(content.trim());
}

function parseRSS(xmlString) {
    const results = [];
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

    let match;
    let count = 0;
    while ((match = itemRegex.exec(xmlString)) !== null && count < 30) {
        const itemStr = match[1];

        const title = extractTag(itemStr, 'title');
        const linkStr = extractTag(itemStr, 'link');
        const pubDateStr = extractTag(itemStr, 'pubDate');

        let link = linkStr || "#";
        if (link !== "#" && !link.startsWith("http://") && !link.startsWith("https://")) {
            link = "#";
        }

        let timeStr = "";
        let pubDateValue = 0;
        if (pubDateStr) {
            const d = new Date(pubDateStr);
            if (!isNaN(d.getTime())) {
                timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                pubDateValue = d.getTime();
            }
        }

        results.push({ title, link, timeStr, pubDateValue, description: "" });
        count++;
    }
    return results;
}

// Periodic cleanup alarm
if (chrome.alarms) {
    chrome.alarms.create(CLEANUP_ALARM_NAME, { periodInMinutes: 30 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === CLEANUP_ALARM_NAME) cleanCache();
    });
}
