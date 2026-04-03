const rssDataCache = new Map(); // url -> { items, timestamp }
const CACHE_TTL = 3600000; // 1 hour in milliseconds
const CLEANUP_ALARM_NAME = 'cacheCleanup';

const DEFAULT_FEEDS = [
    {
        id: 'feed_1',
        name: 'BBC World',
        url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
        enabled: true
    },
    {
        id: 'feed_2',
        name: 'TechCrunch',
        url: 'https://techcrunch.com/feed/',
        enabled: true
    },
    {
        id: 'feed_3',
        name: 'NASA',
        url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
        enabled: true
    }
];

// Enable Content Script to access chrome.storage.session
async function setAccess() {
    try {
        await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    } catch (e) {
        console.error('Failed to set access level:', e);
    }
}
setAccess();

chrome.runtime.onInstalled.addListener(async (details) => {
    setAccess();
    
    // Initialize default settings if they don't exist
    const storage = await chrome.storage.local.get([
        'newsTickerFeeds',
        'newsTickerBarVisible',
        'newsTickerScrollMode',
        'newsTickerVerticalPause'
    ]);

    const updates = {};
    if (!storage.newsTickerFeeds) updates.newsTickerFeeds = DEFAULT_FEEDS;
    if (storage.newsTickerBarVisible === undefined) updates.newsTickerBarVisible = true;
    if (!storage.newsTickerScrollMode) updates.newsTickerScrollMode = 'vertical-push';
    if (storage.newsTickerVerticalPause === undefined) updates.newsTickerVerticalPause = 5;

    if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
    }

    initIconState();
});

chrome.runtime.onStartup.addListener(initIconState);

// Also run on every SW wake-up so the icon survives idle restarts
initIconState();

async function initIconState() {
    // Release memory on wake-up (clean expired items)
    cleanCache();

    const data = await chrome.storage.local.get('newsTickerBarVisible');
    const isVisible = data.newsTickerBarVisible !== false;
    updateIcon(isVisible);
}

async function updateIcon(isTickerVisible) {
    if (isTickerVisible) {
        chrome.action.setIcon({
            path: {
                "16": "icons/icon16.png",
                "48": "icons/icon48.png",
                "128": "icons/icon128.png"
            }
        });
    } else {
        chrome.action.setIcon({
            path: {
                "16": "icons/icon16_gray.png",
                "48": "icons/icon48_gray.png",
                "128": "icons/icon128_gray.png"
            }
        });
    }
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.newsTickerBarVisible) {
            updateIcon(changes.newsTickerBarVisible.newValue);
        }
        if (changes.newsTickerFeeds) {
            // Clear in-memory cache
            rssDataCache.clear();
            
            // Clear session storage fetch timestamps
            chrome.storage.session.get(null).then(allData => {
                const keysToRemove = Object.keys(allData).filter(key => key.startsWith('lastFetch_'));
                if (keysToRemove.length > 0) {
                    chrome.storage.session.remove(keysToRemove);
                }
            });
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchRSS') {
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
                        sendResponse({
                            success: true,
                            data: cached.items,
                            isUpdated: false
                        });
                        return;
                    } else {
                        // TTL expired, remove it and proceed to fetch
                        rssDataCache.delete(url);
                    }
                }

                // Otherwise fetch new data
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const text = await response.text();
                
                const items = parseRSS(text);

                rssDataCache.set(url, { items, timestamp: now });

                // If it was within interval but memory cache was missing (SW restart), 
                // we don't treat it as a "reset" update.
                const shouldReset = !withinInterval;

                if (shouldReset) {
                    await chrome.storage.session.set({ [sessionKey]: now });
                }

                sendResponse({
                    success: true,
                    data: items,
                    isUpdated: shouldReset
                });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

/**
 * Purges expired entries from the cache to free up memory.
 * @param {boolean} force - If true, clears the entire cache.
 */
function cleanCache(force = false) {
    if (force) {
        rssDataCache.clear();
        console.log('Cache cleared (forced).');
        return;
    }

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
               .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
               .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseRSS(xmlString) {
    const results = [];
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    const titleRegex = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
    const linkRegex = /<link\b[^>]*>([\s\S]*?)<\/link>/i;
    const pubDateRegex = /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i;

    function extractContent(str, regex) {
        const match = regex.exec(str);
        if (!match) return "";
        let content = match[1].trim();
        if (content.startsWith("<![CDATA[") && content.endsWith("]]>")) {
            content = content.substring(9, content.length - 3);
        }
        return decodeXMLEntities(content.trim());
    }

    let match;
    let count = 0;
    while ((match = itemRegex.exec(xmlString)) !== null && count < 30) {
        const itemStr = match[1];
        
        let title = extractContent(itemStr, titleRegex);
        let linkStr = extractContent(itemStr, linkRegex);
        let pubDateStr = extractContent(itemStr, pubDateRegex);
        
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

// Set up periodic cleanup alarm
if (chrome.alarms) {
    chrome.alarms.create(CLEANUP_ALARM_NAME, { periodInMinutes: 30 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === CLEANUP_ALARM_NAME) {
            cleanCache();
        }
    });
}
