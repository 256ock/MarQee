/* defaults.js - shared across service worker, content script, and popup */

const DEFAULT_FEEDS = [
    { id: 'feed_1', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', enabled: true },
    { id: 'feed_2', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', enabled: true },
    { id: 'feed_3', name: 'NASA', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', enabled: true }
];

const DEFAULT_SETTINGS = {
    // Display
    newsTickerBarVisible: true,
    newsTickerBarPos: 'top',
    newsTickerScrollMode: 'vertical-push',
    // Performance
    newsTickerSpeed: 1.0,
    newsTickerVerticalPause: 5,
    newsTickerFetchInterval: 15,
    newsTickerHoverPause: true,
    newsTickerShiftFixed: false,
    // Style
    newsTickerFontSize: 14,
    newsTickerFontWeight: 'normal',
    newsTickerColorScheme: 'system',
    newsTickerVisualEffect: 'none',
    // Effects
    newsTickerGlassmorphismBlur: 12,
    newsTickerGlassBrightness: 1.0,
    newsTickerLEDOpacity: 0.6,
    newsTickerLEDBlendMode: 'overlay',
    // Colors
    newsTickerCustomColorLight: '#2563eb',
    newsTickerCustomColorDark: '#3b82f6',
    newsTickerCustomColorTricolor: '#ff4d4d',
    newsTickerTricolorLink: '#ffb000',
    newsTickerTricolorTime: '#ff4d4d',
    newsTickerTricolorSource: '#00ff41',
    // Filtering
    newsTickerExcludedDomains: ['x.com', 'youtube.com'],
    newsTickerDomainFilterMode: 'exclude',
    newsTickerAgeFilterEnabled: false,
    newsTickerAgeHours: 12,
    // Articles
    newsTickerArticleSort: 'chrono',
    newsTickerArticleGroup: 'mixed',
    newsTickerBlinkNew: true,
    newsTickerShowLoading: true
};

// Settings keys eligible for backup/restore (feeds are handled separately).
const ALL_SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);

const SETTING_VALUES = {
    newsTickerBarPos: ['top', 'bottom'],
    newsTickerScrollMode: ['horizontal', 'horizontal-push', 'vertical-push'],
    newsTickerFontWeight: ['light', 'normal', 'bold'],
    newsTickerColorScheme: ['system', 'light', 'dark', 'neon-blue', 'amber', 'tricolor', 'emerald', 'monochrome'],
    newsTickerVisualEffect: ['none', 'glass', 'led'],
    newsTickerLEDBlendMode: ['screen', 'overlay', 'lighten', 'color-dodge', 'soft-light', 'difference'],
    newsTickerDomainFilterMode: ['exclude', 'include'],
    newsTickerArticleSort: ['chrono', 'random'],
    newsTickerArticleGroup: ['grouped', 'mixed']
};

const BOOLEAN_SETTING_KEYS = new Set([
    'newsTickerBarVisible',
    'newsTickerHoverPause',
    'newsTickerShiftFixed',
    'newsTickerShowLoading',
    'newsTickerAgeFilterEnabled',
    'newsTickerBlinkNew'
]);

const NUMBER_SETTING_RANGES = {
    newsTickerSpeed: [0.5, 3],
    newsTickerVerticalPause: [1, 10],
    newsTickerFetchInterval: [1, 60],
    newsTickerFontSize: [10, 24],
    newsTickerGlassmorphismBlur: [0, 20],
    newsTickerGlassBrightness: [0.2, 2],
    newsTickerLEDOpacity: [0, 1],
    newsTickerAgeHours: [1, 72]
};

const COLOR_SETTING_KEYS = new Set([
    'newsTickerCustomColorLight',
    'newsTickerCustomColorDark',
    'newsTickerCustomColorTricolor',
    'newsTickerTricolorLink',
    'newsTickerTricolorTime',
    'newsTickerTricolorSource'
]);

function normalizeFeedUrl(value) {
    if (typeof value !== 'string') return null;

    const url = value.trim();
    if (!url || url.length > 2048) return null;

    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
    } catch {
        return null;
    }
}

function normalizeDomain(value) {
    if (typeof value !== 'string') return null;

    const domain = value.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
    if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) return null;

    return domain;
}

function normalizeFeeds(value) {
    if (!Array.isArray(value)) return [];

    return value.reduce((feeds, feed, index) => {
        if (!feed || typeof feed !== 'object') return feeds;

        const url = normalizeFeedUrl(feed.url);
        if (!url) return feeds;

        const name = typeof feed.name === 'string' ? feed.name.trim().slice(0, 256) : '';
        const id = typeof feed.id === 'string' && feed.id.length <= 128
            ? feed.id
            : `feed_${Date.now()}_${index}`;

        feeds.push({ id, name: name || 'Unnamed', url, enabled: feed.enabled !== false });
        return feeds;
    }, []);
}

function normalizeSettings(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const settings = { ...DEFAULT_SETTINGS };

    for (const key of ALL_SETTINGS_KEYS) {
        const candidate = source[key];
        if (candidate === undefined) continue;

        if (BOOLEAN_SETTING_KEYS.has(key)) {
            if (typeof candidate === 'boolean') settings[key] = candidate;
            continue;
        }

        if (SETTING_VALUES[key]) {
            if (SETTING_VALUES[key].includes(candidate)) settings[key] = candidate;
            continue;
        }

        if (NUMBER_SETTING_RANGES[key]) {
            const [min, max] = NUMBER_SETTING_RANGES[key];
            if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= min && candidate <= max) {
                settings[key] = candidate;
            }
            continue;
        }

        if (COLOR_SETTING_KEYS.has(key)) {
            if (typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate)) settings[key] = candidate;
            continue;
        }

        if (key === 'newsTickerExcludedDomains' && Array.isArray(candidate)) {
            settings[key] = candidate.map(normalizeDomain).filter(Boolean);
        }
    }

    return settings;
}
