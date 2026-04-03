const rssTextCache = new Map(); // url -> { text, timestamp }
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
setAccess();
chrome.runtime.onInstalled.addListener(() => {
    setAccess();
    initIconState();
});

chrome.runtime.onStartup.addListener(initIconState);

// Also run on every SW wake-up so the icon survives idle restarts
initIconState();

async function initIconState() {
    // Release memory on wake-up (clean expired items)
    cleanCache();

    const data = await chrome.storage.local.get('newsTickerBarVisible');
    updateIcon(data.newsTickerBarVisible || false);
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
            rssTextCache.clear();
            
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
                if (withinInterval && rssTextCache.has(url)) {
                    const cached = rssTextCache.get(url);
                    if (now - cached.timestamp < CACHE_TTL) {
                        sendResponse({
                            success: true,
                            data: cached.text,
                            isUpdated: false
                        });
                        return;
                    } else {
                        // TTL expired, remove it and proceed to fetch
                        rssTextCache.delete(url);
                    }
                }

                // Otherwise fetch new data
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const text = await response.text();

                rssTextCache.set(url, { text, timestamp: now });

                // If it was within interval but memory cache was missing (SW restart), 
                // we don't treat it as a "reset" update.
                const shouldReset = !withinInterval;

                if (shouldReset) {
                    await chrome.storage.session.set({ [sessionKey]: now });
                }

                sendResponse({
                    success: true,
                    data: text,
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
        rssTextCache.clear();
        console.log('Cache cleared (forced).');
        return;
    }

    const now = Date.now();
    let count = 0;
    for (const [url, entry] of rssTextCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL) {
            rssTextCache.delete(url);
            count++;
        }
    }
    if (count > 0) {
        console.log(`Cache cleaned: ${count} expired entries removed.`);
    }
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
