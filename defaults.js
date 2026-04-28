/* defaults.js - shared across service worker, content script, and popup */

const DEFAULT_FEEDS = [
    { id: 'feed_1', name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', enabled: true },
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
