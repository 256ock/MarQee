importScripts('defaults.js');

const rssDataCache = new Map(); // url -> { items, timestamp }
const CACHE_TTL = 3600000; // 1 hour in milliseconds
const CLEANUP_ALARM_NAME = 'cacheCleanup';
const FETCH_TIMEOUT_MS = 15000;
const MAX_RSS_RESPONSE_BYTES = 1024 * 1024;
const MAX_RSS_FIELD_LENGTH = 4096;

// Content scripts need session access only for the ticker's RSS cache and progress state.
async function setAccess() {
    await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
}

async function initializeMissingSettings() {
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
}

async function initializeExtension({ initializeSettings = false } = {}) {
    await setAccess();
    if (initializeSettings) await initializeMissingSettings();
    await initIconState();
}

function logInitializationError(error) {
    console.error('MarQee initialization failed:', error);
}

chrome.runtime.onInstalled.addListener(() => {
    void initializeExtension({ initializeSettings: true }).catch(logInitializationError);
});

chrome.runtime.onStartup.addListener(() => {
    void initializeExtension().catch(logInitializationError);
});

// Also run on every SW wake-up so the icon survives idle restarts.
void initializeExtension().catch(logInitializationError);

async function initIconState() {
    // Release memory on wake-up (clean expired items)
    cleanCache();

    const data = await chrome.storage.local.get('newsTickerBarVisible');
    const isVisible = data.newsTickerBarVisible !== false;
    await updateIcon(isVisible);
}

function updateIcon(isTickerVisible) {
    const suffix = isTickerVisible ? '' : '_gray';
    return chrome.action.setIcon({
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
        void updateIcon(changes.newsTickerBarVisible.newValue).catch(error => {
            console.error('MarQee icon update failed:', error);
        });
    }
    if (changes.newsTickerFeeds) {
        // Clear in-memory cache
        rssDataCache.clear();

        // Clear session storage: fetch timestamps AND cached item arrays
        void chrome.storage.session.get(null).then(allData => {
            const keysToRemove = Object.keys(allData).filter(key =>
                key.startsWith('lastFetch_') || key.startsWith('rssItems_')
            );
            if (keysToRemove.length > 0) {
                return chrome.storage.session.remove(keysToRemove);
            }
            return undefined;
        }).catch(error => {
            console.error('MarQee cache cleanup failed:', error);
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.action !== 'fetchRSS' || sender.id !== chrome.runtime.id || !sender.tab) return;

    const url = normalizeFeedUrl(request.url);
    if (!url) {
        sendResponse({ success: false, error: 'Invalid RSS URL' });
        return;
    }

    (async () => {
        try {
            const storedSettings = await chrome.storage.local.get('newsTickerFetchInterval');
            const settings = normalizeSettings(storedSettings);
            const intervalMinutes = settings.newsTickerFetchInterval;
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
                    await chrome.storage.session.set({ [`rssItems_${url}`]: cached.items });
                    sendResponse({ success: true, data: cached.items, isUpdated: false });
                    return;
                }
                // TTL expired, remove it and proceed to fetch
                rssDataCache.delete(url);
            }

            // Otherwise fetch new data
            const response = await fetchRSS(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const text = await readRSSResponse(response);

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
            sendResponse({ success: false, error: error instanceof Error ? error.message : 'RSS fetch failed' });
        }
    })();
    return true;
});

async function fetchRSS(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        return await fetch(url, {
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function readRSSResponse(response) {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RSS_RESPONSE_BYTES) {
        throw new Error('RSS response exceeds the 1 MB limit');
    }

    if (!response.body) throw new Error('RSS response body is unavailable');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    let receivedBytes = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            receivedBytes += value.byteLength;
            if (receivedBytes > MAX_RSS_RESPONSE_BYTES) {
                await reader.cancel();
                throw new Error('RSS response exceeds the 1 MB limit');
            }
            chunks.push(decoder.decode(value, { stream: true }));
        }
        chunks.push(decoder.decode());
        return chunks.join('');
    } finally {
        reader.releaseLock();
    }
}

function cleanCache() {
    const now = Date.now();
    for (const [url, entry] of rssDataCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL) {
            rssDataCache.delete(url);
        }
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
    return decodeXMLEntities(content.trim()).slice(0, MAX_RSS_FIELD_LENGTH);
}

function parseRSS(xmlString) {
    if (typeof xmlString !== 'string') return [];

    const results = [];
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

    let match;
    let count = 0;
    while ((match = itemRegex.exec(xmlString)) !== null && count < 30) {
        const itemStr = match[1];

        const title = extractTag(itemStr, 'title');
        const linkStr = extractTag(itemStr, 'link');
        const pubDateStr = extractTag(itemStr, 'pubDate');

        const link = normalizeFeedUrl(linkStr) || '#';

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
