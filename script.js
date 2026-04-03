/**
 * Premium News Ticker Application Logic (RSS Version)
 */

// 1. Default Feeds & State Management
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

let userFeeds = [];
let activeFeedId = null;
let speedMultiplier = 1.0; // 0.5x to 3.0x
let hoverPauseEnabled = true; // default: ON
let fetchInterval = 15; // default: 15 minutes
let currentColorScheme = 'system';
let currentVisualEffect = 'none'; // 'none', 'glass', 'led'
let currentGlassBlur = 12; // default: 12px
let ledGridOpacity = 0.6;
let ledBlendMode = 'overlay';
let currentFontWeight = 'normal';
let articleSortOrder = 'chrono'; // 'chrono', 'random'
let articleGrouping = 'grouped'; // 'grouped', 'mixed'
let blinkNewEnabled = true; // default: ON
let scrollMode = 'vertical-push'; // default: 'vertical-push'
let verticalPause = 5; // default: 5 seconds
let currentFontSize = 14; // default: 14px
let articleAgeFilterEnabled = false;
let articleAgeHours = 24;
let excludedDomains = [];

const DEFAULT_COLOR_LIGHT = '#2563eb';
const DEFAULT_COLOR_DARK = '#3b82f6';
const DEFAULT_COLOR_TRICOLOR = '#ff4d4d'; // Legacy

const DEFAULT_TRICOLOR_LINK = '#ffb000';
const DEFAULT_TRICOLOR_TIME = '#ff4d4d';
const DEFAULT_TRICOLOR_SOURCE = '#00ff41';

let customColorLight = DEFAULT_COLOR_LIGHT;
let customColorDark = DEFAULT_COLOR_DARK;
let customColorTricolor = DEFAULT_COLOR_TRICOLOR; // Legacy

let tricolorLinkColor = DEFAULT_TRICOLOR_LINK;
let tricolorTimeColor = DEFAULT_TRICOLOR_TIME;
let tricolorSourceColor = DEFAULT_TRICOLOR_SOURCE;



let editingFeedId = null; // ID of the feed being edited

// 2. DOM Elements
const appContainer = document.querySelector('.app-container');

// Settings Modal & Features Elements
const feedList = document.getElementById('feed-list');
const addFeedBtn = document.getElementById('add-feed-btn');
const newGenreNameInput = document.getElementById('new-genre-name');
const newFeedUrlInput = document.getElementById('new-feed-url');
const speedSlider = document.getElementById('speed-slider');
const speedValueDisplay = document.getElementById('speed-value');
const hoverPauseToggle = document.getElementById('hover-pause-toggle');
const intervalSlider = document.getElementById('interval-slider');
const intervalValueDisplay = document.getElementById('interval-value');
const colorSchemeSelect = document.getElementById('color-scheme-select');
const visualEffectOptions = document.getElementById('visual-effect-options');
const ledOpacitySlider = document.getElementById('led-opacity-slider');
const ledOpacityValueDisplay = document.getElementById('led-opacity-value');
const ledOpacityRow = document.getElementById('led-opacity-row');
const ledBlendModeSelect = document.getElementById('led-blend-mode-select');
const ledBlendModeRow = document.getElementById('led-blend-mode-row');
const glassBlurSlider = document.getElementById('glass-blur-slider');
const glassBlurValueDisplay = document.getElementById('glass-blur-value');
const glassBlurRow = document.getElementById('glass-blur-row');
const fontWeightSelect = document.getElementById('font-weight-select');
const articleSortSelect = document.getElementById('article-sort-select');
const articleGroupSelect = document.getElementById('article-group-select');
const blinkNewToggle = document.getElementById('blink-new-toggle');
const scrollModeSelect = document.getElementById('scroll-mode-select');
const speedControlRow = document.getElementById('speed-control-row');
const pauseDurationRow = document.getElementById('pause-duration-row');
const pauseSlider = document.getElementById('pause-slider');
const pauseValueDisplay = document.getElementById('pause-value');
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeValueDisplay = document.getElementById('font-size-value');
const articleAgeFilterToggle = document.getElementById('article-age-filter-toggle');
const articleAgeSlider = document.getElementById('article-age-slider');
const articleAgeValueDisplay = document.getElementById('article-age-value');
const articleAgeRow = document.getElementById('article-age-row');
const excludedDomainsTextarea = document.getElementById('excluded-domains-textarea');
const saveDomainsBtn = document.getElementById('save-domains-btn');
const addCurrentDomainBtn = document.getElementById('add-current-domain-btn');

const colorLightPicker = document.getElementById('color-light-picker');
const colorDarkPicker = document.getElementById('color-dark-picker');
const colorTricolorPicker = document.getElementById('color-tricolor-picker');
const resetLightBtn = document.getElementById('reset-light-color');
const resetDarkBtn = document.getElementById('reset-dark-color');
const resetTricolorBtn = document.getElementById('reset-tricolor-color'); // Legacy (unlikely to exist now)

const tricolorLinkSelect = document.getElementById('tricolor-link-select');
const tricolorTimeSelect = document.getElementById('tricolor-time-select');
const tricolorSourceSelect = document.getElementById('tricolor-source-select');
const resetTricolorColorsBtn = document.getElementById('reset-tricolor-colors');

const customColorsContainer = document.getElementById('custom-colors-container');
const groupLightColor = document.getElementById('group-light-color');
const groupDarkColor = document.getElementById('group-dark-color');
const groupTricolorColor = document.getElementById('group-tricolor-color');


// Feed Form elements
const formTitle = document.getElementById('form-title');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const feedForm = document.querySelector('.feed-form');

// 3. Logic: Storage
// (Now Chrome Extension only)

async function loadFeeds() {
    const data = await chrome.storage.local.get('newsTickerFeeds');
    if (data.newsTickerFeeds) {
        userFeeds = data.newsTickerFeeds;
    } else {
        userFeeds = [...DEFAULT_FEEDS];
        await saveFeeds();
    }
    if (userFeeds.length > 0) {
        activeFeedId = userFeeds[0].id;
    }
}

async function saveFeeds() {
    await chrome.storage.local.set({ 'newsTickerFeeds': userFeeds });
}

function getFeedById(id) {
    return userFeeds.find(f => f.id === id);
}

async function loadSpeed() {
    const data = await chrome.storage.local.get('newsTickerSpeed');
    const savedSpeed = data.newsTickerSpeed;

    if (savedSpeed) {
        speedMultiplier = parseFloat(savedSpeed);
    }
    // Update UI
    if (speedSlider) {
        speedSlider.value = speedMultiplier;
        updateSpeedDisplay(speedMultiplier);
    }
}

async function saveSpeed(value) {
    speedMultiplier = parseFloat(value);
    await chrome.storage.local.set({ 'newsTickerSpeed': speedMultiplier });
    updateSpeedDisplay(speedMultiplier);
}

function updateSpeedDisplay(val) {
    if (speedValueDisplay) {
        speedValueDisplay.textContent = `${val.toFixed(1)}x`;
    }
}

async function loadHoverPause() {
    const data = await chrome.storage.local.get('newsTickerHoverPause');
    const saved = data.newsTickerHoverPause;

    // Default to true (enabled) if not set
    hoverPauseEnabled = (saved === null || saved === undefined) ? true : saved;
    applyHoverPause();
}

async function saveHoverPause(enabled) {
    hoverPauseEnabled = enabled;
    await chrome.storage.local.set({ 'newsTickerHoverPause': enabled });
    applyHoverPause();
}

function applyHoverPause() {
    if (hoverPauseToggle) {
        hoverPauseToggle.checked = hoverPauseEnabled;
    }
}

async function loadInterval() {
    const data = await chrome.storage.local.get('newsTickerFetchInterval');
    const saved = data.newsTickerFetchInterval;
    if (saved) {
        fetchInterval = parseInt(saved);
    }
    if (intervalSlider) {
        intervalSlider.value = fetchInterval;
        updateIntervalDisplay(fetchInterval);
    }
}

async function saveInterval(val) {
    fetchInterval = parseInt(val);
    await chrome.storage.local.set({ 'newsTickerFetchInterval': fetchInterval });
    updateIntervalDisplay(fetchInterval);
}

function updateIntervalDisplay(val) {
    if (intervalValueDisplay) {
        intervalValueDisplay.textContent = `${val}m`;
    }
}

async function loadScrollSettings() {
    const data = await chrome.storage.local.get(['newsTickerScrollMode', 'newsTickerVerticalPause']);
    scrollMode = data.newsTickerScrollMode || 'vertical-push';
    verticalPause = data.newsTickerVerticalPause || 5;

    if (scrollModeSelect) scrollModeSelect.value = scrollMode;
    if (pauseSlider) {
        pauseSlider.value = verticalPause;
        updatePauseDisplay(verticalPause);
    }
    updateScrollControlVisibility();
}

function updatePauseDisplay(val) {
    if (pauseValueDisplay) {
        pauseValueDisplay.textContent = `${val}s`;
    }
}

async function saveVerticalPause(val) {
    verticalPause = parseInt(val);
    await chrome.storage.local.set({ 'newsTickerVerticalPause': verticalPause });
    updatePauseDisplay(verticalPause);
}

async function saveScrollMode(mode) {
    scrollMode = mode;
    await chrome.storage.local.set({ 'newsTickerScrollMode': mode });
    updateScrollControlVisibility();
}

function updateScrollControlVisibility() {
    if (speedControlRow) speedControlRow.style.display = scrollMode === 'horizontal' ? 'flex' : 'none';
    if (pauseDurationRow) pauseDurationRow.style.display = (scrollMode === 'vertical-push' || scrollMode === 'horizontal-push') ? 'flex' : 'none';
}

async function loadStyleSettings() {
    const data = await chrome.storage.local.get(['newsTickerColorScheme', 'newsTickerVisualEffect', 'newsTickerGlassmorphismBlur', 'newsTickerLEDStyle', 'newsTickerLEDOpacity', 'newsTickerLEDBlendMode', 'newsTickerFontWeight', 'newsTickerFontSize', 'newsTickerCustomColorLight', 'newsTickerCustomColorDark', 'newsTickerCustomColorTricolor', 'newsTickerTricolorLink', 'newsTickerTricolorTime', 'newsTickerTricolorSource']);
    currentColorScheme = data.newsTickerColorScheme || 'system';

    customColorLight = data.newsTickerCustomColorLight || DEFAULT_COLOR_LIGHT;
    customColorDark = data.newsTickerCustomColorDark || DEFAULT_COLOR_DARK;
    customColorTricolor = data.newsTickerCustomColorTricolor || DEFAULT_COLOR_TRICOLOR;

    tricolorLinkColor = data.newsTickerTricolorLink || DEFAULT_TRICOLOR_LINK;
    tricolorTimeColor = data.newsTickerTricolorTime || DEFAULT_TRICOLOR_TIME;
    tricolorSourceColor = data.newsTickerTricolorSource || DEFAULT_TRICOLOR_SOURCE;



    if (currentColorScheme === 'default') {
        currentColorScheme = 'system';
        await saveColorScheme('system');
    }
    currentFontWeight = data.newsTickerFontWeight || 'normal';
    currentFontSize = data.newsTickerFontSize || 14;
    currentGlassBlur = data.newsTickerGlassmorphismBlur || 12;

    // Load new visual effect key, or migrate from old keys
    if (data.newsTickerVisualEffect) {
        currentVisualEffect = data.newsTickerVisualEffect;
    } else {
        const oldLED = data.newsTickerLEDStyle || false;
        const oldGlass = data.newsTickerGlassmorphism || false;
        if (oldLED) currentVisualEffect = 'led';
        else if (oldGlass) currentVisualEffect = 'glass';
        else currentVisualEffect = 'none';

        // Save migrated value
        saveVisualEffect(currentVisualEffect);
    }

    if (colorSchemeSelect) colorSchemeSelect.value = currentColorScheme;
    if (fontWeightSelect) fontWeightSelect.value = currentFontWeight;
    if (fontSizeSlider) {
        fontSizeSlider.value = currentFontSize;
        updateFontSizeDisplay(currentFontSize);
    }
    if (glassBlurSlider) {
        glassBlurSlider.value = currentGlassBlur;
        updateGlassBlurDisplay(currentGlassBlur);
    }
    if (ledOpacitySlider) {
        ledOpacitySlider.value = ledGridOpacity;
        updateLEDOpacityDisplay(ledGridOpacity);
    }
    if (ledBlendModeSelect) ledBlendModeSelect.value = ledBlendMode;

    if (colorLightPicker) colorLightPicker.value = customColorLight;
    if (colorDarkPicker) colorDarkPicker.value = customColorDark;
    if (colorTricolorPicker) colorTricolorPicker.value = customColorTricolor;

    if (tricolorLinkSelect) tricolorLinkSelect.value = tricolorLinkColor;
    if (tricolorTimeSelect) tricolorTimeSelect.value = tricolorTimeColor;
    if (tricolorSourceSelect) tricolorSourceSelect.value = tricolorSourceColor;

    updateLEDSettingVisibility();
    updateVisualEffectUI();
    updateCustomColorVisibility();
}



async function saveVisualEffect(effect) {
    currentVisualEffect = effect;
    await chrome.storage.local.set({ 'newsTickerVisualEffect': effect });

    // For backward compatibility / content script consistency
    await chrome.storage.local.set({
        'newsTickerLEDStyle': (effect === 'led'),
        'newsTickerGlassmorphism': (effect === 'glass')
    });

    updateVisualEffectUI();
    updateLEDSettingVisibility();
}

function updateVisualEffectUI() {
    if (!visualEffectOptions) return;
    visualEffectOptions.querySelectorAll('.pos-btn').forEach(btn => {
        if (btn.dataset.effect === currentVisualEffect) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

async function saveColorScheme(scheme) {
    currentColorScheme = scheme;
    await chrome.storage.local.set({ 'newsTickerColorScheme': scheme });
    applyTheme(scheme);
    updateCustomColorVisibility();
}


async function saveGlassmorphismBlur(val) {
    currentGlassBlur = parseInt(val);
    await chrome.storage.local.set({ 'newsTickerGlassmorphismBlur': currentGlassBlur });
    updateGlassBlurDisplay(currentGlassBlur);
}

function updateGlassBlurDisplay(val) {
    if (glassBlurValueDisplay) {
        glassBlurValueDisplay.textContent = `${val}px`;
    }
}

async function saveFontWeight(weight) {
    currentFontWeight = weight;
    await chrome.storage.local.set({ 'newsTickerFontWeight': weight });
}

async function saveFontSize(size) {
    currentFontSize = parseInt(size);
    await chrome.storage.local.set({ 'newsTickerFontSize': currentFontSize });
    updateFontSizeDisplay(currentFontSize);
}

function updateFontSizeDisplay(val) {
    if (fontSizeValueDisplay) {
        fontSizeValueDisplay.textContent = `${val}px`;
    }
}

async function saveLEDBlendMode(mode) {
    ledBlendMode = mode;
    await chrome.storage.local.set({ 'newsTickerLEDBlendMode': mode });
}

async function saveLEDOpacity(val) {
    ledGridOpacity = parseFloat(val);
    await chrome.storage.local.set({ 'newsTickerLEDOpacity': ledGridOpacity });
    updateLEDOpacityDisplay(ledGridOpacity);
}

function updateLEDOpacityDisplay(val) {
    if (ledOpacityValueDisplay) {
        ledOpacityValueDisplay.textContent = parseFloat(val).toFixed(1);
    }
}

async function saveCustomColor(type, color) {
    if (type === 'light') {
        customColorLight = color;
        await chrome.storage.local.set({ 'newsTickerCustomColorLight': color });
    } else if (type === 'dark') {
        customColorDark = color;
        await chrome.storage.local.set({ 'newsTickerCustomColorDark': color });
    } else if (type === 'tricolor') {
        customColorTricolor = color;
        await chrome.storage.local.set({ 'newsTickerCustomColorTricolor': color });
    }
}

async function saveTricolorColor(type, color) {
    if (type === 'link') {
        tricolorLinkColor = color;
        await chrome.storage.local.set({ 'newsTickerTricolorLink': color });
    } else if (type === 'time') {
        tricolorTimeColor = color;
        await chrome.storage.local.set({ 'newsTickerTricolorTime': color });
    } else if (type === 'source') {
        tricolorSourceColor = color;
        await chrome.storage.local.set({ 'newsTickerTricolorSource': color });
    }
}

function updateCustomColorVisibility() {
    if (!customColorsContainer) return;

    let scheme = currentColorScheme;
    if (scheme === 'system') {
        scheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    const showLight = (scheme === 'light');
    const showDark = (scheme === 'dark');
    const showTricolor = (scheme === 'tricolor');

    if (groupLightColor) groupLightColor.style.display = showLight ? 'flex' : 'none';
    if (groupDarkColor) groupDarkColor.style.display = showDark ? 'flex' : 'none';
    if (groupTricolorColor) groupTricolorColor.style.display = showTricolor ? 'block' : 'none';

    customColorsContainer.style.display = (showLight || showDark || showTricolor) ? 'block' : 'none';
}



function updateLEDSettingVisibility() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const display = (currentVisualEffect === 'led' && !isLight) ? 'flex' : 'none';
    if (ledOpacityRow) ledOpacityRow.style.display = display;
    if (ledBlendModeRow) ledBlendModeRow.style.display = display;

    // Glass Blur visibility
    if (glassBlurRow) {
        glassBlurRow.style.display = (currentVisualEffect === 'glass') ? 'flex' : 'none';
    }

    if (visualEffectOptions) {
        const ledBtn = visualEffectOptions.querySelector('[data-effect="led"]');
        if (ledBtn) {
            ledBtn.style.display = isLight ? 'none' : 'flex';
            if (isLight && currentVisualEffect === 'led') {
                saveVisualEffect('none');
            }
        }
    }
}

async function loadArticleSettings() {
    const data = await chrome.storage.local.get(['newsTickerArticleSort', 'newsTickerArticleGroup', 'newsTickerBlinkNew', 'newsTickerAgeFilterEnabled', 'newsTickerAgeHours', 'newsTickerExcludedDomains']);
    articleSortOrder = data.newsTickerArticleSort || 'chrono';
    articleGrouping = data.newsTickerArticleGroup || 'grouped';
    blinkNewEnabled = data.newsTickerBlinkNew !== undefined ? data.newsTickerBlinkNew : true;
    articleAgeFilterEnabled = data.newsTickerAgeFilterEnabled || false;
    articleAgeHours = data.newsTickerAgeHours || 24;
    excludedDomains = data.newsTickerExcludedDomains || [];

    if (articleSortSelect) articleSortSelect.value = articleSortOrder;
    if (articleGroupSelect) articleGroupSelect.value = articleGrouping;
    if (blinkNewToggle) blinkNewToggle.checked = blinkNewEnabled;
    if (articleAgeFilterToggle) articleAgeFilterToggle.checked = articleAgeFilterEnabled;
    if (articleAgeSlider) {
        articleAgeSlider.value = articleAgeHours;
        updateAgeHoursDisplay(articleAgeHours);
    }
    updateAgeFilterVisibility();
    updateExcludedDomainsUI();
}

async function saveExcludedDomains() {
    const text = excludedDomainsTextarea.value.trim();
    excludedDomains = text ? text.split('\n').map(d => d.trim()).filter(d => d !== '') : [];
    await chrome.storage.local.set({ 'newsTickerExcludedDomains': excludedDomains });

    // Pulse animation on button to show save success
    if (saveDomainsBtn) {
        const originalText = saveDomainsBtn.textContent;
        saveDomainsBtn.textContent = 'Saved!';
        saveDomainsBtn.style.background = 'var(--live-red)';
        setTimeout(() => {
            saveDomainsBtn.textContent = originalText;
            saveDomainsBtn.style.background = '';
        }, 2000);
    }
}

async function handleAddCurrentDomain() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) return;

        let url;
        try {
            url = new URL(tab.url);
        } catch (e) {
            // Probably not a standard URL (e.g. chrome://)
            return;
        }

        const domain = url.hostname;
        if (!domain) return;

        if (!excludedDomains.includes(domain)) {
            excludedDomains.push(domain);
            updateExcludedDomainsUI();
            await chrome.storage.local.set({ 'newsTickerExcludedDomains': excludedDomains });

            // Visual feedback
            if (addCurrentDomainBtn) {
                const originalText = addCurrentDomainBtn.textContent;
                addCurrentDomainBtn.textContent = 'Added!';
                addCurrentDomainBtn.style.background = 'var(--live-red)';
                addCurrentDomainBtn.style.color = 'white';
                setTimeout(() => {
                    addCurrentDomainBtn.textContent = originalText;
                    addCurrentDomainBtn.style.background = '';
                    addCurrentDomainBtn.style.color = '';
                }, 2000);
            }
        } else {
            // Already added feedback
            if (addCurrentDomainBtn) {
                const originalText = addCurrentDomainBtn.textContent;
                addCurrentDomainBtn.textContent = 'Already Added';
                setTimeout(() => {
                    addCurrentDomainBtn.textContent = originalText;
                }, 2000);
            }
        }
    } catch (error) {
        console.error('Error adding current domain:', error);
    }
}


function updateExcludedDomainsUI() {
    if (excludedDomainsTextarea) {
        excludedDomainsTextarea.value = excludedDomains.join('\n');
    }
}

async function saveBlinkNew(enabled) {
    blinkNewEnabled = enabled;
    await chrome.storage.local.set({ 'newsTickerBlinkNew': enabled });
}

async function saveArticleSort(sort) {
    articleSortOrder = sort;
    await chrome.storage.local.set({ 'newsTickerArticleSort': sort });
}

async function saveArticleGroup(group) {
    articleGrouping = group;
    await chrome.storage.local.set({ 'newsTickerArticleGroup': group });
}

async function saveAgeFilter(enabled) {
    articleAgeFilterEnabled = enabled;
    await chrome.storage.local.set({ 'newsTickerAgeFilterEnabled': enabled });
    updateAgeFilterVisibility();
}

async function saveAgeHours(val) {
    articleAgeHours = parseInt(val);
    await chrome.storage.local.set({ 'newsTickerAgeHours': articleAgeHours });
    updateAgeHoursDisplay(articleAgeHours);
}

function updateAgeHoursDisplay(val) {
    if (articleAgeValueDisplay) {
        articleAgeValueDisplay.textContent = `${val}h`;
    }
}

function updateAgeFilterVisibility() {
    if (articleAgeRow) {
        articleAgeRow.style.display = articleAgeFilterEnabled ? 'flex' : 'none';
    }
}

function applyTheme(scheme) {
    const root = document.documentElement;
    let isLight = false;

    if (scheme === 'light') {
        isLight = true;
    } else if (scheme === 'system') {
        isLight = !window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isLight) {
        root.setAttribute('data-theme', 'light');
    } else {
        root.removeAttribute('data-theme');
    }

    updateLEDSettingVisibility();
}

// 4. Logic: UI Generation (Settings)

let draggedItemIndex = null;

function renderSettingsFeedList() {
    feedList.innerHTML = '';

    if (userFeeds.length === 0) {
        feedList.innerHTML = '<li style="color:var(--text-tertiary);font-size:0.9rem;">No feeds configured.</li>';
        return;
    }

    userFeeds.forEach((feed, index) => {
        const li = document.createElement('li');
        li.className = 'feed-item';
        li.draggable = true;
        li.dataset.index = index;
        if (feed.enabled === false) li.classList.add('disabled');

        li.innerHTML = `
            <div class="drag-handle" aria-label="Drag to reorder">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
            </div>
            <label class="toggle-switch feed-toggle" title="${feed.enabled !== false ? 'Disable' : 'Enable'}">
                <input type="checkbox" class="feed-enabled-checkbox" data-index="${index}" ${feed.enabled !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
            <div class="feed-info">
                <span class="feed-name">${escapeHTML(feed.name)}</span>
                <span class="feed-url">${escapeHTML(feed.url)}</span>
            </div>
            <div class="feed-item-actions" style="display:flex; gap:0.25rem;">
                <button class="edit-btn" type="button" data-index="${index}" aria-label="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="delete-btn" type="button" data-id="${feed.id}" aria-label="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;

        if (editingFeedId === feed.id) {
            li.classList.add('editing');
        }

        // Toggle enabled state
        const checkbox = li.querySelector('.feed-enabled-checkbox');
        checkbox.addEventListener('change', () => {
            userFeeds[index].enabled = checkbox.checked;
            saveFeeds();
            renderSettingsFeedList();
        });

        // Drag and Drop Event Listeners
        li.addEventListener('dragstart', (e) => {
            draggedItemIndex = index;
            e.dataTransfer.effectAllowed = 'move';
            // required for firefox
            e.dataTransfer.setData('text/plain', index);
            setTimeout(() => li.classList.add('dragging'), 0);
        });

        li.addEventListener('dragend', () => {
            draggedItemIndex = null;
            li.classList.remove('dragging');
            document.querySelectorAll('.feed-item').forEach(item => item.classList.remove('drag-over'));
        });

        li.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            e.dataTransfer.dropEffect = 'move';
        });

        li.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (index !== draggedItemIndex) {
                li.classList.add('drag-over');
            }
        });

        li.addEventListener('dragleave', () => {
            li.classList.remove('drag-over');
        });

        li.addEventListener('drop', (e) => {
            e.preventDefault();
            li.classList.remove('drag-over');

            if (draggedItemIndex === null || draggedItemIndex === index) return;

            // Reorder array
            const draggedItem = userFeeds.splice(draggedItemIndex, 1)[0];
            userFeeds.splice(index, 0, draggedItem);

            saveFeeds();
            renderSettingsFeedList();
        });

        // Edit button
        const editBtn = li.querySelector('.edit-btn');
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleStartEdit(index);
        });


        // Delete button with 2-step confirmation
        let deleteTimeout;
        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (deleteBtn.classList.contains('confirm-mode')) {
                clearTimeout(deleteTimeout);
                handleDeleteFeed(feed.id);
            } else {
                deleteBtn.classList.add('confirm-mode');
                deleteBtn.innerHTML = '<span style="font-size:0.75rem; font-weight:600;">Confirm Delete</span>';
                deleteBtn.style.color = 'var(--danger)';
                deleteBtn.style.background = 'rgba(239, 68, 68, 0.1)';
                deleteBtn.style.padding = '0.35rem 0.75rem';

                deleteTimeout = setTimeout(() => {
                    if (document.body.contains(deleteBtn)) {
                        deleteBtn.classList.remove('confirm-mode');
                        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
                        deleteBtn.style.color = '';
                        deleteBtn.style.background = '';
                        deleteBtn.style.padding = '0.25rem';
                    }
                }, 3000);
            }
        });

        feedList.appendChild(li);
    });
}

function handleStartEdit(index) {
    const feed = userFeeds[index];
    editingFeedId = feed.id;
    newGenreNameInput.value = feed.name;
    newFeedUrlInput.value = feed.url;

    formTitle.textContent = 'Edit Feed';
    addFeedBtn.textContent = 'Update';
    cancelEditBtn.style.display = 'inline-block';

    renderSettingsFeedList();
}

function handleCancelEdit() {
    editingFeedId = null;
    newGenreNameInput.value = '';
    newFeedUrlInput.value = '';

    formTitle.textContent = 'Add Feed';
    addFeedBtn.textContent = 'Add';
    cancelEditBtn.style.display = 'none';

    renderSettingsFeedList();
}

async function handleUpdateFeed() {
    const name = newGenreNameInput.value.trim();
    const url = newFeedUrlInput.value.trim();

    if (!name || !url) {
        alert('Please enter Source Name and RSS URL.');
        return;
    }

    const index = userFeeds.findIndex(f => f.id === editingFeedId);
    if (index !== -1) {
        userFeeds[index].name = name;
        userFeeds[index].url = url;
        await saveFeeds();
    }

    handleCancelEdit();
}

function handleAddFeed() {
    if (editingFeedId) {
        handleUpdateFeed();
        return;
    }
    const name = newGenreNameInput.value.trim();
    const url = newFeedUrlInput.value.trim();

    if (!name || !url) {
        alert('Please enter Source Name and RSS URL.');
        return;
    }

    // Very basic URL validation
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('Please enter a valid URL (starting with http:// or https://).');
        return;
    }

    const newFeed = {
        id: 'feed_' + Date.now(),
        name,
        url,
        enabled: true
    };

    userFeeds.push(newFeed);
    saveFeeds();

    // Clear inputs
    newGenreNameInput.value = '';
    newFeedUrlInput.value = '';

    renderSettingsFeedList();
}

function handleDeleteFeed(feedId) {
    userFeeds = userFeeds.filter(f => f.id !== feedId);
    saveFeeds();
    renderSettingsFeedList();
}

// Utility: Escape HTML to prevent XSS (since we generate innerHTML)
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function handleSpeedChange(event) {
    const newSpeed = event.target.value;
    saveSpeed(newSpeed);
    // Ticker animation speed is now handled by content.js
}

// 8. Initialize
async function init() {
    await loadFeeds();
    await loadSpeed();
    await loadHoverPause();
    await loadInterval();
    await loadStyleSettings();
    await loadArticleSettings();
    await loadScrollSettings();
    renderSettingsFeedList();

    applyTheme(currentColorScheme);

    // Event Listeners
    if (speedSlider) {
        speedSlider.addEventListener('input', handleSpeedChange);
    }

    // Hover Pause Toggle
    if (hoverPauseToggle) {
        hoverPauseToggle.addEventListener('change', () => {
            saveHoverPause(hoverPauseToggle.checked);
        });
    }

    if (intervalSlider) {
        intervalSlider.addEventListener('input', (e) => {
            updateIntervalDisplay(e.target.value);
        });
        intervalSlider.addEventListener('change', (e) => {
            saveInterval(e.target.value);
        });
    }

    if (saveDomainsBtn) {
        saveDomainsBtn.addEventListener('click', saveExcludedDomains);
    }

    if (addCurrentDomainBtn) {
        addCurrentDomainBtn.addEventListener('click', handleAddCurrentDomain);
    }

    if (colorSchemeSelect) {
        colorSchemeSelect.addEventListener('change', (e) => {
            saveColorScheme(e.target.value);
        });
    }

    if (visualEffectOptions) {
        visualEffectOptions.addEventListener('click', (e) => {
            const btn = e.target.closest('.pos-btn');
            if (btn) {
                saveVisualEffect(btn.dataset.effect);
            }
        });
    }

    if (glassBlurSlider) {
        glassBlurSlider.addEventListener('input', (e) => {
            saveGlassmorphismBlur(e.target.value);
        });
    }

    if (ledOpacitySlider) {
        ledOpacitySlider.addEventListener('input', (e) => {
            saveLEDOpacity(e.target.value);
        });
    }

    if (ledBlendModeSelect) {
        ledBlendModeSelect.addEventListener('change', (e) => {
            saveLEDBlendMode(e.target.value);
        });
    }

    if (fontWeightSelect) {
        fontWeightSelect.addEventListener('change', (e) => {
            saveFontWeight(e.target.value);
        });
    }

    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', (e) => {
            saveFontSize(e.target.value);
        });
    }

    if (articleSortSelect) {
        articleSortSelect.addEventListener('change', (e) => {
            saveArticleSort(e.target.value);
        });
    }

    if (articleGroupSelect) {
        articleGroupSelect.addEventListener('change', (e) => {
            saveArticleGroup(e.target.value);
        });
    }

    if (blinkNewToggle) {
        blinkNewToggle.addEventListener('change', () => {
            saveBlinkNew(blinkNewToggle.checked);
        });
    }

    if (articleAgeFilterToggle) {
        articleAgeFilterToggle.addEventListener('change', () => {
            saveAgeFilter(articleAgeFilterToggle.checked);
        });
    }

    if (articleAgeSlider) {
        articleAgeSlider.addEventListener('input', (e) => {
            saveAgeHours(e.target.value);
        });
    }

    if (scrollModeSelect) {
        scrollModeSelect.addEventListener('change', (e) => {
            saveScrollMode(e.target.value);
        });
    }

    if (pauseSlider) {
        pauseSlider.addEventListener('input', (e) => {
            saveVerticalPause(e.target.value);
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', handleCancelEdit);
    }

    if (colorLightPicker) {
        colorLightPicker.addEventListener('input', (e) => saveCustomColor('light', e.target.value));
    }
    if (colorDarkPicker) {
        colorDarkPicker.addEventListener('input', (e) => saveCustomColor('dark', e.target.value));
    }
    if (colorTricolorPicker) {
        colorTricolorPicker.addEventListener('input', (e) => saveCustomColor('tricolor', e.target.value));
    }

    if (resetLightBtn) {
        resetLightBtn.addEventListener('click', () => {
            colorLightPicker.value = DEFAULT_COLOR_LIGHT;
            saveCustomColor('light', DEFAULT_COLOR_LIGHT);
        });
    }
    if (resetDarkBtn) {
        resetDarkBtn.addEventListener('click', () => {
            colorDarkPicker.value = DEFAULT_COLOR_DARK;
            saveCustomColor('dark', DEFAULT_COLOR_DARK);
        });
    }
    if (resetTricolorBtn) {
        resetTricolorBtn.addEventListener('click', () => {
            colorTricolorPicker.value = DEFAULT_COLOR_TRICOLOR;
            saveCustomColor('tricolor', DEFAULT_COLOR_TRICOLOR);
        });
    }

    if (tricolorLinkSelect) {
        tricolorLinkSelect.addEventListener('change', (e) => saveTricolorColor('link', e.target.value));
    }
    if (tricolorTimeSelect) {
        tricolorTimeSelect.addEventListener('change', (e) => saveTricolorColor('time', e.target.value));
    }
    if (tricolorSourceSelect) {
        tricolorSourceSelect.addEventListener('change', (e) => saveTricolorColor('source', e.target.value));
    }

    if (resetTricolorColorsBtn) {
        resetTricolorColorsBtn.addEventListener('click', () => {
            tricolorLinkSelect.value = DEFAULT_TRICOLOR_LINK;
            tricolorTimeSelect.value = DEFAULT_TRICOLOR_TIME;
            tricolorSourceSelect.value = DEFAULT_TRICOLOR_SOURCE;
            saveTricolorColor('link', DEFAULT_TRICOLOR_LINK);
            saveTricolorColor('time', DEFAULT_TRICOLOR_TIME);
            saveTricolorColor('source', DEFAULT_TRICOLOR_SOURCE);
        });
    }




    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentColorScheme === 'system') {
            applyTheme('system');
        }
    });

    const tickerBarToggle = document.getElementById('ticker-bar-toggle');
    const tickerPosOptions = document.getElementById('ticker-pos-options');
    const shiftFixedToggle = document.getElementById('shift-fixed-toggle');

    if (shiftFixedToggle) {
        const data = await chrome.storage.local.get('newsTickerShiftFixed');
        shiftFixedToggle.checked = data.newsTickerShiftFixed || false;
        shiftFixedToggle.addEventListener('change', async () => {
            await chrome.storage.local.set({ 'newsTickerShiftFixed': shiftFixedToggle.checked });
        });
    }

    if (tickerBarToggle) {
        const data = await chrome.storage.local.get('newsTickerBarVisible');
        tickerBarToggle.checked = data.newsTickerBarVisible || false;
        tickerBarToggle.addEventListener('change', async () => {
            await chrome.storage.local.set({ 'newsTickerBarVisible': tickerBarToggle.checked });
        });
    }

    if (tickerPosOptions) {
        const shiftFixedRow = document.getElementById('shift-fixed-row');
        const data = await chrome.storage.local.get('newsTickerBarPos');
        const currentPos = data.newsTickerBarPos || 'top';
        tickerPosOptions.querySelectorAll('.pos-btn').forEach(btn => {
            if (btn.dataset.pos === currentPos) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        if (shiftFixedRow) {
            shiftFixedRow.style.display = currentPos === 'top' ? 'flex' : 'none';
        }

        tickerPosOptions.addEventListener('click', async (e) => {
            const btn = e.target.closest('.pos-btn');
            if (btn) {
                tickerPosOptions.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await chrome.storage.local.set({ 'newsTickerBarPos': btn.dataset.pos });

                if (shiftFixedRow) {
                    shiftFixedRow.style.display = btn.dataset.pos === 'top' ? 'flex' : 'none';
                }
            }
        });
    }

    addFeedBtn.addEventListener('click', handleAddFeed);

    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            // Add active class to clicked button
            btn.classList.add('active');

            // Show corresponding pane
            const targetId = btn.getAttribute('data-tab');
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });

    // App entrance animation
    appContainer.style.opacity = 0;
    appContainer.style.transform = 'translateY(20px)';
    appContainer.style.transition = 'opacity 0.8s ease, transform 0.8s ease';

    setTimeout(() => {
        appContainer.style.opacity = 1;
        appContainer.style.transform = 'translateY(0)';
    }, 100);
}

// Run on load
document.addEventListener('DOMContentLoaded', init);
