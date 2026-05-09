/* content.js */
(function () {
    let feeds = [];
    let speed = 1.0;
    let isVisible = false;
    let position = 'top';
    let hoverPause = true;
    let colorScheme = 'system';
    let visualEffect = 'none';
    let ledOpacity = 0.6;
    let ledBlendMode = 'overlay';
    let fontWeight = 'normal';
    let articleSort = 'chrono';
    let articleGroup = 'mixed';
    let blinkNew = true;
    let shiftFixed = false;
    let scrollMode = 'horizontal';
    let verticalPause = 3;
    let fontSize = 14;
    let articleAgeFilterEnabled = false;
    let articleAgeHours = 12;
    let glassBlur = 12;
    let glassBrightness = 1.0;
    let excludedDomains = ['x.com', 'youtube.com'];
    let domainFilterMode = 'exclude'; // 'exclude' or 'include'
    let customColorLight = '#2563eb';
    let customColorDark = '#3b82f6';
    let customColorTricolor = '#ff4d4d';
    let tricolorLinkColor = '#ffb000';
    let tricolorTimeColor = '#ff4d4d';
    let tricolorSourceColor = '#00ff41';
    let rssIsUpdated = false;
    let showLoading = true;


    let currentPushItems = 0;
    let container = null;
    let track = null;
    let shadow = null;
    let pushInterval = null;
    let currentPushIndex = 0;
    let navButtonsEl = null;
    let navUpBtn = null;
    let navDownBtn = null;

    const BAR_PADDING = 18;
    const barHeight = () => fontSize + BAR_PADDING;
    const isPushMode = () => scrollMode === 'vertical-push' || scrollMode === 'horizontal-push';

    function shouldHideOnCurrentDomain() {
        const hostname = window.location.hostname;
        const matchesDomain = excludedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
        if (domainFilterMode === 'include') {
            return excludedDomains.length > 0 && !matchesDomain;
        }
        return matchesDomain;
    }

    const EARLY_DEFAULTS = {
        newsTickerBarVisible:      DEFAULT_SETTINGS.newsTickerBarVisible,
        newsTickerExcludedDomains: DEFAULT_SETTINGS.newsTickerExcludedDomains,
        newsTickerDomainFilterMode:DEFAULT_SETTINGS.newsTickerDomainFilterMode,
        newsTickerFontSize:        DEFAULT_SETTINGS.newsTickerFontSize
    };

    async function init() {
        // 1. Early load for layout-shift prevention (BarVisible / FontSize / domain gates)
        const initialData = await chrome.storage.local.get(EARLY_DEFAULTS);
        isVisible        = initialData.newsTickerBarVisible;
        excludedDomains  = initialData.newsTickerExcludedDomains;
        domainFilterMode = initialData.newsTickerDomainFilterMode;
        fontSize         = initialData.newsTickerFontSize;
        if (isVisible) updateBodyPadding();

        // 2. Defer the rest to idle. Always load full settings so the change listener
        //    works correctly even if the bar was hidden at startup.
        const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1000));
        idleCallback(async () => {
            // Two parallel gets: defaults form for normal settings, raw form for
            // legacy migration check (need undefined-detection for visualEffect).
            const [data, legacy] = await Promise.all([
                chrome.storage.local.get({ ...DEFAULT_SETTINGS, newsTickerFeeds: [] }),
                chrome.storage.local.get(['newsTickerVisualEffect', 'newsTickerLEDStyle', 'newsTickerGlassmorphism'])
            ]);

            feeds                   = data.newsTickerFeeds;
            speed                   = data.newsTickerSpeed;
            position                = data.newsTickerBarPos;
            hoverPause              = data.newsTickerHoverPause;
            colorScheme             = data.newsTickerColorScheme === 'default' ? 'system' : data.newsTickerColorScheme;
            ledOpacity              = data.newsTickerLEDOpacity;
            ledBlendMode            = data.newsTickerLEDBlendMode;
            fontWeight              = data.newsTickerFontWeight;
            articleSort             = data.newsTickerArticleSort;
            articleGroup            = data.newsTickerArticleGroup;
            blinkNew                = data.newsTickerBlinkNew;
            shiftFixed              = data.newsTickerShiftFixed;
            scrollMode              = data.newsTickerScrollMode;
            verticalPause           = data.newsTickerVerticalPause;
            articleAgeFilterEnabled = data.newsTickerAgeFilterEnabled;
            articleAgeHours         = data.newsTickerAgeHours;
            visualEffect            = data.newsTickerVisualEffect;
            glassBlur               = data.newsTickerGlassmorphismBlur;
            glassBrightness         = data.newsTickerGlassBrightness;
            customColorLight        = data.newsTickerCustomColorLight;
            customColorDark         = data.newsTickerCustomColorDark;
            customColorTricolor     = data.newsTickerCustomColorTricolor;
            tricolorLinkColor       = data.newsTickerTricolorLink;
            tricolorTimeColor       = data.newsTickerTricolorTime;
            tricolorSourceColor     = data.newsTickerTricolorSource;
            showLoading             = data.newsTickerShowLoading;

            // Legacy migration: visualEffect key never set → infer from old LED/Glass keys
            if (legacy.newsTickerVisualEffect === undefined) {
                if (legacy.newsTickerLEDStyle) visualEffect = 'led';
                else if (legacy.newsTickerGlassmorphism) visualEffect = 'glass';
            }

            // Skip rendering if bar is hidden or domain-filtered
            // (settings are still loaded above so toggle-on works without reload)
            if (!isVisible || shouldHideOnCurrentDomain()) return;

            // Wait for document.body to be available before injecting the ticker
            if (document.body) {
                await createTicker();
                loadAndRender();
            } else {
                const observer = new MutationObserver((mutations, obs) => {
                    if (document.body) {
                        obs.disconnect();
                        createTicker().then(() => loadAndRender());
                    }
                });
                observer.observe(document.documentElement, { childList: true });
            }
        }, { timeout: 1000 });
    }

    async function createTicker() {
        if (container) return;

        container = document.createElement('mq-ticker');
        container.id = 'mq-container';
        container.classList.add(`mq-${position}`);

        // Create Shadow DOM
        shadow = container.attachShadow({ mode: 'open' });

        try {
            const response = await fetch(chrome.runtime.getURL('content.css'));
            let cssText = await response.text();
            
            // Fix relative URLs in CSS (like led-tile.png) to be absolute extension URLs
            // This is required because adoptedStyleSheets resolve URLs relative to the document, not the extension
            cssText = cssText.replace(/url\(['"]?([^'")]+\.(?:png|jpg|jpeg|gif|svg))['"]?\)/g, (match, path) => {
                return `url("${chrome.runtime.getURL(path)}")`;
            });

            const sheet = new CSSStyleSheet();
            sheet.replaceSync(cssText);
            shadow.adoptedStyleSheets = [sheet];
        } catch (e) {
            console.error('MarQee CSS load error:', e);
        }

        applyHoverPauseClass();
        applyStyleClasses();
        applyModeClasses();

        track = document.createElement('div');
        track.id = 'mq-track';

        // Navigation buttons for vertical mode
        navButtonsEl = document.createElement('div');
        navButtonsEl.className = 'mq-nav-buttons';

        navUpBtn = document.createElement('button');
        navUpBtn.className = 'mq-nav-btn';
        navUpBtn.textContent = '▲';
        navUpBtn.disabled = true;
        navUpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigatePush(-1);
        });

        navDownBtn = document.createElement('button');
        navDownBtn.className = 'mq-nav-btn';
        navDownBtn.textContent = '▼';
        navDownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigatePush(1);
        });

        navButtonsEl.append(navUpBtn, navDownBtn);

        shadow.appendChild(track);
        shadow.appendChild(navButtonsEl);
        document.body.appendChild(container);

        // Add rendering class if tab is currently visible
        if (!document.hidden) {
            track.classList.add('mq-rendering');
        }

        // Adjust body padding to not overlap
        updateBodyPadding();
    }

    function applyHoverPauseClass() {
        if (!container) return;
        if (hoverPause) {
            container.classList.add('mq-hover-pause-enabled');
        } else {
            container.classList.remove('mq-hover-pause-enabled');
        }
    }

    function applyStyleClasses() {
        if (!container || !shadow) return;

        // Theme Light/Dark handled here now based on colorScheme
        let isLight = false;
        if (colorScheme === 'light') {
            isLight = true;
        } else if (colorScheme === 'system') {
            isLight = !window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        if (isLight) {
            container.classList.add('mq-theme-light');
        } else {
            container.classList.remove('mq-theme-light');
        }

        // Remove existing scheme classes
        const schemeClasses = Array.from(container.classList).filter(c => c.startsWith('mq-scheme-'));
        schemeClasses.forEach(c => container.classList.remove(c));

        // Add new scheme class (if not light/dark/system)
        if (colorScheme !== 'light' && colorScheme !== 'dark' && colorScheme !== 'system') {
            container.classList.add(`mq-scheme-${colorScheme}`);
        }

        // Add font weight class
        const weightClasses = ['mq-weight-light', 'mq-weight-normal', 'mq-weight-bold'];
        weightClasses.forEach(c => container.classList.remove(c));
        container.classList.add(`mq-weight-${fontWeight}`);

        // Handle Visual Effects
        const isLED = (visualEffect === 'led') && !isLight;
        const isGlass = (visualEffect === 'glass');

        // LED Overlay & Class
        let overlay = shadow.querySelector('.mq-led-overlay');
        if (isLED) {
            container.classList.add('mq-led-enabled');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'mq-led-overlay';
                shadow.appendChild(overlay);
            }
            container.style.setProperty('--mq-led-opacity', ledOpacity);
            container.style.setProperty('--mq-led-blend-mode', ledBlendMode);
        } else {
            container.classList.remove('mq-led-enabled');
            if (overlay) overlay.remove();
        }

        // Glass Class
        if (isGlass) {
            container.classList.add('mq-glass-enabled');
        } else {
            container.classList.remove('mq-glass-enabled');
        }

        // Apply font size and height
        container.style.setProperty('--mq-font-size', `${fontSize}px`);
        container.style.setProperty('--mq-height', `${barHeight()}px`);
        container.style.setProperty('--mq-glass-blur', `${glassBlur}px`);
        container.style.setProperty('--mq-glass-brightness', glassBrightness);

        // Apply Custom Colors
        container.style.setProperty('--mq-custom-light-color', customColorLight);
        container.style.setProperty('--mq-custom-dark-color', customColorDark);
        container.style.setProperty('--mq-custom-tricolor-color', customColorTricolor);
        container.style.setProperty('--mq-tricolor-link-color', tricolorLinkColor);
        container.style.setProperty('--mq-tricolor-time-color', tricolorTimeColor);
        container.style.setProperty('--mq-tricolor-source-color', tricolorSourceColor);
    }



    function applyModeClasses() {
        if (!container) return;
        container.classList.remove('mq-mode-horizontal', 'mq-mode-horizontal-push', 'mq-mode-vertical-push');
        container.classList.add(`mq-mode-${scrollMode}`);
    }

    let shiftedElements = [];
    let originalTransforms = new WeakMap();

    function shiftFixedElements() {
        if (!shiftFixed || position !== 'top') return;

        const elements = document.querySelectorAll('body > *, header, nav, .fixed, .sticky, [class*="header"], [id*="header"]');
        elements.forEach(el => {
            if (el === container || el === document.body || el === document.documentElement) return;
            if (shiftedElements.includes(el)) return;

            const style = window.getComputedStyle(el);
            if ((style.position === 'fixed' || style.position === 'sticky') && style.top === '0px') {
                const base = el.style.transform.replace(/translateY\([^)]*\)/g, '').trim();
                originalTransforms.set(el, base);
                const shifted = base ? `${base} translateY(${barHeight()}px)` : `translateY(${barHeight()}px)`;
                el.style.setProperty('transform', shifted, 'important');
                shiftedElements.push(el);
            }
        });
    }

    function unshiftFixedElements() {
        shiftedElements.forEach(el => {
            const base = originalTransforms.get(el);
            if (base) {
                el.style.setProperty('transform', base, 'important');
            } else {
                el.style.removeProperty('transform');
            }
            originalTransforms.delete(el);
        });
        shiftedElements = [];
    }

    function updateBodyPadding() {
        unshiftFixedElements();
        if (isVisible && !shouldHideOnCurrentDomain()) {
            if (position === 'top') {
                document.documentElement.style.setProperty('margin-top', `${barHeight()}px`, 'important');
                // Allow DOM to settle before shifting fixed elements
                setTimeout(shiftFixedElements, 100);
            } else {
                document.documentElement.style.setProperty('margin-bottom', `${barHeight()}px`, 'important');
            }
        } else {
            document.documentElement.style.removeProperty('margin-top');
            document.documentElement.style.removeProperty('margin-bottom');
        }
    }

    function removeTicker() {
        if (pushInterval) clearTimeout(pushInterval);
        if (container) {
            unshiftFixedElements();
            container.remove();
            container = null;
            track = null;
            shadow = null;
            navButtonsEl = null;
            navUpBtn = null;
            navDownBtn = null;
            document.documentElement.style.removeProperty('margin-top');
            document.documentElement.style.removeProperty('margin-bottom');
        }
    }

    function showStatusMessage(text) {
        if (!track) return;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'mq-item';
        const linkSpan = document.createElement('span');
        linkSpan.className = 'mq-link';
        linkSpan.textContent = text;
        itemDiv.appendChild(linkSpan);
        track.replaceChildren(itemDiv);
    }

    // Render a pre-resolved array of { items, feedName } results.
    // forceReset: true when the fetch interval elapsed and we want to restart scroll position.
    async function renderFeedResults(results, forceReset) {
        if (!shadow || !track) return;

        // Restore scroll-position state from session storage
        const state = await chrome.storage.session.get(['newsTickerProgress', 'newsTickerTimestamp', 'newsTickerShuffleSeed', 'newsTickerPushIndex']);
        let shuffleSeed = state.newsTickerShuffleSeed;

        if (forceReset || shuffleSeed === undefined) {
            shuffleSeed = Math.floor(Math.random() * 2147483647);
            chrome.storage.session.set({ newsTickerShuffleSeed: shuffleSeed });
        }

        // Apply sorting and grouping
        let allItems = [];

        if (articleGroup === 'grouped') {
            results.forEach(res => {
                let items = res.items;
                if (articleSort === 'chrono') {
                    items.sort((a, b) => (b.pubDateValue || 0) - (a.pubDateValue || 0));
                } else if (articleSort === 'random') {
                    items = shuffleArray([...items], shuffleSeed);
                }
                items.forEach(item => item.source = res.feedName);
                allItems = allItems.concat(items);
            });
        } else {
            // Mixed
            results.forEach(res => {
                res.items.forEach(item => item.source = res.feedName);
                allItems = allItems.concat(res.items);
            });

            if (articleSort === 'chrono') {
                allItems.sort((a, b) => (b.pubDateValue || 0) - (a.pubDateValue || 0));
            } else if (articleSort === 'random') {
                allItems = shuffleArray(allItems, shuffleSeed);
            }
        }

        // Apply article age filter
        if (articleAgeFilterEnabled) {
            const cutoff = Date.now() - (articleAgeHours * 60 * 60 * 1000);
            allItems = allItems.filter(item => item.pubDateValue && item.pubDateValue >= cutoff);
        }

        if (allItems.length === 0) {
            showStatusMessage('No news found');
            return;
        }

        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const fragment = document.createDocumentFragment();
        const itemsToRender = allItems;

        itemsToRender.forEach(item => {
            const isNew = item.pubDateValue > oneHourAgo;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'mq-item';

            const sourceSpan = document.createElement('span');
            sourceSpan.className = 'mq-source';
            sourceSpan.textContent = `[${item.source}]`;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'mq-time' + ((blinkNew && isNew) ? ' mq-blink' : '');
            timeSpan.textContent = item.timeStr || '';

            const linkA = document.createElement('a');
            linkA.href = item.link;
            linkA.target = '_blank';
            linkA.className = 'mq-link';
            linkA.textContent = item.title;

            itemDiv.append(sourceSpan, ' ', timeSpan, ' ', linkA);
            fragment.appendChild(itemDiv);
        });

        if (isPushMode()) {
            const isVertical = scrollMode === 'vertical-push';
            const makeBlank = () => {
                const el = document.createElement('div');
                el.className = 'mq-item mq-blank';
                if (isVertical) el.style.height = `${barHeight()}px`;
                else el.style.width = '100vw';
                return el;
            };
            fragment.prepend(makeBlank());
            fragment.appendChild(makeBlank());
        }

        currentPushItems = isPushMode() ? itemsToRender.length + 2 : itemsToRender.length;
        track.replaceChildren(fragment);

        function applyScroll() {
            if (!track) return;

            if (scrollMode === 'horizontal') {
                const width = track.offsetWidth;
                if (width === 0) {
                    requestAnimationFrame(applyScroll);
                    return;
                }

                const duration = (width / 50) / speed;
                track.style.animationDuration = `${duration}s`;
                track.style.animationTimingFunction = 'linear';
                track.style.animationIterationCount = 'infinite';

                let progress = 0;
                if (!forceReset) {
                    progress = state.newsTickerProgress || 0;
                    if (state.newsTickerTimestamp) {
                        const elapsedSeconds = (Date.now() - state.newsTickerTimestamp) / 1000;
                        progress += elapsedSeconds / duration;
                        progress = progress % 1;
                    }
                }
                track.style.animationDelay = `-${progress * duration}s`;
                track.style.animationName = 'mq-scroll';
            } else {
                // Push Mode
                track.style.animation = 'none';
                if (forceReset) {
                    currentPushIndex = 0;
                } else {
                    currentPushIndex = state.newsTickerPushIndex || 0;
                }
                if (currentPushIndex >= (currentPushItems || 1)) currentPushIndex = 0;

                // Disable transition temporarily to prevent "catch-up" jump
                track.style.transition = 'none';
                applyPushTransform();
                // Force reflow
                track.offsetHeight;
                track.style.transition = '';

                startPushAnimation();

                if (forceReset) {
                    chrome.storage.session.remove(['newsTickerProgress', 'newsTickerTimestamp', 'newsTickerPushIndex']);
                }
            }
        }

        function startPushAnimation() {
            if (pushInterval) clearTimeout(pushInterval);
            if (currentPushItems <= 1) return;
            startPushAnimation_ref = startPushAnimation;

            const totalItems = currentPushItems;

            function tick() {
                pushInterval = setTimeout(() => {
                    // Check if mouse is hovering and pause is enabled
                    if (hoverPause && container && container.matches(':hover')) {
                        tick();
                        return;
                    }

                    currentPushIndex++;
                    if (currentPushIndex >= totalItems) {
                        // Reset instantly
                        track.style.transition = 'none';
                        currentPushIndex = 0;
                        track.style.transform = (scrollMode === 'vertical-push') ? `translateY(0)` : `translateX(0)`;
                        // Force reflow
                        track.offsetHeight;
                        track.style.transition = '';
                        updateNavButtons();

                        startPushAnimation();
                    } else {
                        applyPushTransform();
                        updateNavButtons();
                        tick();
                    }
                }, (currentPushIndex === 0) ? 50 : (currentPushIndex === totalItems - 1) ? 500 : verticalPause * 1000);
            }

            tick();
        }

        applyScroll();
        updateNavButtons();
        rssIsUpdated = false;
    }

    async function loadAndRender() {
        if (!shadow || !track || feeds.length === 0 || !chrome.runtime?.id) return;

        const enabledFeeds = feeds.filter(f => f.enabled !== false);
        if (enabledFeeds.length === 0) {
            showStatusMessage('No active feeds');
            return;
        }

        // Check session item cache: if all feeds have cached items, render instantly without Loading.
        // background.js writes rssItems_<url> to session storage after every successful fetch,
        // so this survives SW idle restarts and page navigations within the configured interval.
        const cacheKeys = enabledFeeds.map(f => `rssItems_${f.url}`);
        const sessionItems = await chrome.storage.session.get(cacheKeys);
        const hasCachedData = enabledFeeds.every(f => Array.isArray(sessionItems[`rssItems_${f.url}`]));

        if (hasCachedData) {
            // Render immediately — no Loading indicator
            const cachedResults = enabledFeeds.map(f => ({
                items: sessionItems[`rssItems_${f.url}`],
                feedName: f.name
            }));
            await renderFeedResults(cachedResults, false);
        } else if (showLoading) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'mq-item mq-loading';
            loadingDiv.textContent = 'Loading Feeds';
            track.replaceChildren(loadingDiv);
        }

        // Fetch from SW in the background (respects interval / memory-cache logic)
        try {
            const fetchPromises = enabledFeeds.map(feed =>
                chrome.runtime.sendMessage({ action: 'fetchRSS', url: feed.url })
                    .then(response => {
                        if (response && response.success) {
                            if (response.isUpdated) rssIsUpdated = true;
                            return { items: response.data || [], feedName: feed.name };
                        }
                        return { items: [], feedName: feed.name };
                    })
            );

            const results = await Promise.all(fetchPromises);

            // Re-render only when the interval elapsed (genuine new data) or there was no cache
            if (rssIsUpdated || !hasCachedData) {
                await renderFeedResults(results, rssIsUpdated);
            }
        } catch (e) {
            console.error('MarQee error:', e);
            if (!hasCachedData) showStatusMessage('Error loading feeds');
        }
    }



    function updateNavButtons() {
        if (!navUpBtn || !navDownBtn) return;
        if (!isPushMode()) return;
        // In push mode, index 0 = blank start, articles are 1..N, index N+1 = blank end
        navUpBtn.disabled = (currentPushIndex <= 1);
        navDownBtn.disabled = (currentPushIndex >= currentPushItems - 2);
    }

    function applyPushTransform() {
        if (!track) return;
        if (scrollMode === 'vertical-push') {
            track.style.transform = `translateY(-${currentPushIndex * barHeight()}px)`;
        } else {
            track.style.transform = `translateX(-${currentPushIndex * 100}vw)`;
        }
    }

    function navigatePush(direction) {
        if (!isPushMode() || !track) return;
        const newIndex = currentPushIndex + direction;
        // Clamp: articles are at indices 1..(currentPushItems - 2)
        if (newIndex < 1 || newIndex > currentPushItems - 2) return;

        currentPushIndex = newIndex;
        applyPushTransform();
        updateNavButtons();

        // Reset auto-advance timer
        if (pushInterval) clearTimeout(pushInterval);
        startPushAnimation_ref();
    }

    // Reference holder for push animation to be callable from manual navigation
    let startPushAnimation_ref = () => {};

    function shuffleArray(array, seed) {
        // Simple LCG for reproducible random
        let s = seed || 0;
        const next = () => {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            return s / 0x7fffffff;
        };

        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Dispatch table: storage key -> { assign to local, optional side-effect }
    // `reload` means reload feed list. `style` re-applies style classes.
    const SETTING_HANDLERS = {
        newsTickerFontWeight:         { set: v => fontWeight = v,              effect: 'style' },
        newsTickerColorScheme:        { set: v => colorScheme = v,             effect: 'style' },
        newsTickerLEDOpacity:         { set: v => ledOpacity = v,              effect: 'style' },
        newsTickerLEDBlendMode:       { set: v => ledBlendMode = v,            effect: 'style' },
        newsTickerVisualEffect:       { set: v => visualEffect = v,            effect: 'style' },
        newsTickerGlassmorphismBlur:  { set: v => glassBlur = v,               effect: 'style' },
        newsTickerGlassBrightness:    { set: v => glassBrightness = v,         effect: 'style' },
        newsTickerCustomColorLight:   { set: v => customColorLight = v,        effect: 'style' },
        newsTickerCustomColorDark:    { set: v => customColorDark = v,         effect: 'style' },
        newsTickerCustomColorTricolor:{ set: v => customColorTricolor = v,     effect: 'style' },
        newsTickerTricolorLink:       { set: v => tricolorLinkColor = v,       effect: 'style' },
        newsTickerTricolorTime:       { set: v => tricolorTimeColor = v,       effect: 'style' },
        newsTickerTricolorSource:     { set: v => tricolorSourceColor = v,     effect: 'style' },
        newsTickerArticleSort:        { set: v => articleSort = v,             effect: 'reload' },
        newsTickerArticleGroup:       { set: v => articleGroup = v,            effect: 'reload' },
        newsTickerBlinkNew:           { set: v => blinkNew = v,                effect: 'reload' },
        newsTickerAgeFilterEnabled:   { set: v => articleAgeFilterEnabled = v, effect: 'reload' },
        newsTickerHoverPause:         { set: v => hoverPause = v, effect: () => applyHoverPauseClass() },
        newsTickerShowLoading:        { set: v => showLoading = v },
        newsTickerShiftFixed:         { set: v => shiftFixed = v, effect: () => updateBodyPadding() },
        newsTickerAgeHours:           { set: v => articleAgeHours = v, effect: () => articleAgeFilterEnabled && loadAndRender() },
        newsTickerVerticalPause:      { set: v => verticalPause = v,           effect: () => isPushMode() && loadAndRender() },
        newsTickerSpeed:              { set: v => speed = v,                   effect: () => applySpeedChange() },
        newsTickerFeeds: {
            set: v => {
                feeds = v || [];
                chrome.storage.session.remove(['newsTickerShuffleSeed', 'newsTickerProgress', 'newsTickerVerticalIndex']);
            },
            effect: 'reload'
        },
    };

    chrome.storage.onChanged.addListener((changes) => {
        let needsStyle = false, needsReload = false;

        for (const [key, change] of Object.entries(changes)) {
            const handler = SETTING_HANDLERS[key];
            if (!handler) continue;
            handler.set(change.newValue);
            if (handler.effect === 'style') needsStyle = true;
            else if (handler.effect === 'reload') needsReload = true;
            else if (typeof handler.effect === 'function') handler.effect();
        }

        if (changes.newsTickerBarVisible) {
            isVisible = changes.newsTickerBarVisible.newValue;
            if (isVisible && !shouldHideOnCurrentDomain()) {
                createTicker().then(() => loadAndRender());
            } else {
                removeTicker();
            }
            return; // createTicker handles subsequent render; avoid double loadAndRender
        }

        if (changes.newsTickerBarPos) {
            position = changes.newsTickerBarPos.newValue;
            if (container) {
                container.classList.remove('mq-top', 'mq-bottom');
                container.classList.add(`mq-${position}`);
                document.documentElement.style.removeProperty('margin-top');
                document.documentElement.style.removeProperty('margin-bottom');
                updateBodyPadding();
            }
        }

        if (changes.newsTickerScrollMode) {
            scrollMode = changes.newsTickerScrollMode.newValue;
            if (container) {
                applyModeClasses();
                needsReload = true;
            }
        }

        if (changes.newsTickerFontSize) {
            fontSize = changes.newsTickerFontSize.newValue;
            needsStyle = true;
            updateBodyPadding();
            if (isPushMode()) needsReload = true;
        }

        if (changes.newsTickerExcludedDomains || changes.newsTickerDomainFilterMode) {
            if (changes.newsTickerExcludedDomains) {
                excludedDomains = changes.newsTickerExcludedDomains.newValue || [];
            }
            if (changes.newsTickerDomainFilterMode) {
                domainFilterMode = changes.newsTickerDomainFilterMode.newValue || 'exclude';
            }
            if (shouldHideOnCurrentDomain()) {
                removeTicker();
            } else if (isVisible && feeds.length > 0 && !container) {
                createTicker().then(() => loadAndRender());
            }
        }

        if (needsStyle) applyStyleClasses();
        if (needsReload) loadAndRender();
    });

    function applySpeedChange() {
        if (!track || track.offsetWidth <= 0) return;
        const computed = window.getComputedStyle(track);
        const currentDuration = parseFloat(computed.animationDuration);
        const currentDelay = parseFloat(computed.animationDelay) || 0;

        const progress = currentDuration > 0
            ? (Math.abs(currentDelay) / currentDuration) % 1
            : 0;

        const newDuration = (track.offsetWidth / 50) / speed;
        track.style.animationDuration = `${newDuration}s`;
        track.style.animationTimingFunction = 'linear';
        track.style.animationIterationCount = 'infinite';
        track.style.animationDelay = `-${progress * newDuration}s`;
    }



    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (colorScheme === 'system') {
            applyStyleClasses();
        }
    });

    function saveTickerProgress() {
        if (!track || !isVisible || !chrome.runtime?.id) return;

        if (isPushMode()) {
            chrome.storage.session.set({ newsTickerPushIndex: currentPushIndex });
            return;
        }

        // Horizontal mode — save scroll progress as a fraction.
        const transform = window.getComputedStyle(track).getPropertyValue('transform');
        if (!transform || transform === 'none') return;

        const matrixValues = transform.match(/matrix.*\((.+)\)/);
        if (!matrixValues) return;

        const x = parseFloat(matrixValues[1].split(', ')[4]);
        if (isNaN(x) || track.offsetWidth <= 0) return;

        chrome.storage.session.set({
            newsTickerProgress: Math.abs(x) / track.offsetWidth,
            newsTickerTimestamp: Date.now()
        });
    }

    window.addEventListener('pagehide', saveTickerProgress);
    window.addEventListener('visibilitychange', () => {
        if (!track) return;

        if (document.hidden) {
            // 1. Save progress
            saveTickerProgress();
            
            // 2. Pause CSS animations (Horizontal mode)
            track.style.animationPlayState = 'paused';
            
            // 3. Clear JS timer (Push modes)
            if (pushInterval) {
                clearTimeout(pushInterval);
                pushInterval = null;
            }
            
            // 4. Remove will-change to save GPU memory
            track.classList.remove('mq-rendering');
        } else {
            // 1. Resume CSS animations
            track.style.animationPlayState = 'running';
            
            // 2. Restart JS timer if in push mode
            if (isPushMode()) {
                startPushAnimation_ref();
            }
            
            // 3. Re-enable will-change
            track.classList.add('mq-rendering');
        }
    });

    init();
})();
