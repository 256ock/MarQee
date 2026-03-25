/* background.js */
const rssTextCache = new Map(); // url -> text (in-memory for speed)

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

                // Use in-memory cache if available and within interval
                if (withinInterval && rssTextCache.has(url)) {
                    sendResponse({
                        success: true,
                        data: rssTextCache.get(url),
                        isUpdated: false
                    });
                    return;
                }

                // Otherwise fetch new data
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const text = await response.text();

                rssTextCache.set(url, text);

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

