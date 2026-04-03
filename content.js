/* content.js */
(function () {
    let feeds = [];
    let speed = 1.0;
    let activeFeedId = null;
    let isVisible = false;
    let position = 'top';
    let hoverPause = true;
    let colorScheme = 'system';
    let visualEffect = 'none';
    let ledOpacity = 0.6;
    let ledBlendMode = 'overlay';
    let fontWeight = 'normal';
    let articleSort = 'chrono';
    let articleGroup = 'grouped';
    let blinkNew = true;
    let shiftFixed = false;
    let scrollMode = 'horizontal';
    let verticalPause = 3;
    let fontSize = 14;
    let articleAgeFilterEnabled = false;
    let articleAgeHours = 24;
    let glassmorphismEnabled = false;
    let glassBlur = 12;
    let excludedDomains = [];
    let customColorLight = '#2563eb';
    let customColorDark = '#3b82f6';
    let customColorTricolor = '#ff4d4d';
    let tricolorLinkColor = '#ffb000';
    let tricolorTimeColor = '#ff4d4d';
    let tricolorSourceColor = '#00ff41';
    let rssIsUpdated = false;


    let currentPushItems = 0;
    let container = null;
    let track = null;
    let shadow = null;
    let styleElement = null;
    let pushInterval = null;
    let currentPushIndex = 0;
    let navButtonsEl = null;
    let navUpBtn = null;
    let navDownBtn = null;

    async function init() {
        // 1. Initial fetch for early return check
        const initialData = await chrome.storage.local.get([
            'newsTickerBarVisible',
            'newsTickerExcludedDomains'
        ]);
        
        // Default to true if newsTickerBarVisible is not set
        isVisible = initialData.newsTickerBarVisible !== false;
        excludedDomains = initialData.newsTickerExcludedDomains || [];
        
        if (!isVisible) return; // Exit early if not visible

        const isExcluded = excludedDomains.some(domain => 
            window.location.hostname === domain || 
            window.location.hostname.endsWith('.' + domain)
        );
        if (isExcluded) return; // Exit early if on excluded domain

        // 2. Fetch fontSize immediately for layout shift prevention
        const fontData = await chrome.storage.local.get('newsTickerFontSize');
        fontSize = fontData.newsTickerFontSize || 14;
        updateBodyPadding();

        // 3. Defer non-critical initialization to idle periods
        const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1000));
        idleCallback(async () => {
            const data = await chrome.storage.local.get([
                'newsTickerFeeds',
                'newsTickerSpeed',
                'newsTickerBarPos',
                'newsTickerHoverPause',
                'newsTickerColorScheme',
                'newsTickerLEDStyle',
                'newsTickerLEDOpacity',
                'newsTickerLEDBlendMode',
                'newsTickerFontWeight',
                'newsTickerArticleSort',
                'newsTickerArticleGroup',
                'newsTickerBlinkNew',
                'newsTickerShiftFixed',
                'newsTickerScrollMode',
                'newsTickerVerticalPause',
                'newsTickerAgeFilterEnabled',
                'newsTickerAgeHours',
                'newsTickerVisualEffect',
                'newsTickerGlassmorphismBlur',
                'newsTickerCustomColorLight',
                'newsTickerCustomColorDark',
                'newsTickerCustomColorTricolor',
                'newsTickerTricolorLink',
                'newsTickerTricolorTime',
                'newsTickerTricolorSource'
            ]);

            feeds = data.newsTickerFeeds || [];
            speed = data.newsTickerSpeed || 1.0;
            position = data.newsTickerBarPos || 'top';
            hoverPause = data.newsTickerHoverPause !== undefined ? data.newsTickerHoverPause : true;
            colorScheme = data.newsTickerColorScheme || 'system';
            if (colorScheme === 'default') colorScheme = 'system';
            ledStyle = data.newsTickerLEDStyle || false;
            ledOpacity = data.newsTickerLEDOpacity !== undefined ? data.newsTickerLEDOpacity : 0.6;
            ledBlendMode = data.newsTickerLEDBlendMode || 'overlay';
            fontWeight = data.newsTickerFontWeight || 'normal';
            articleSort = data.newsTickerArticleSort || 'chrono';
            articleGroup = data.newsTickerArticleGroup || 'grouped';
            blinkNew = data.newsTickerBlinkNew !== undefined ? data.newsTickerBlinkNew : true;
            shiftFixed = data.newsTickerShiftFixed || false;
            scrollMode = data.newsTickerScrollMode || 'vertical-push';
            verticalPause = data.newsTickerVerticalPause || 5;
            articleAgeFilterEnabled = data.newsTickerAgeFilterEnabled || false;
            articleAgeHours = data.newsTickerAgeHours || 24;
            visualEffect = data.newsTickerVisualEffect || 'none';
            glassBlur = data.newsTickerGlassmorphismBlur || 12;
            customColorLight = data.newsTickerCustomColorLight || '#2563eb';
            customColorDark = data.newsTickerCustomColorDark || '#3b82f6';
            customColorTricolor = data.newsTickerCustomColorTricolor || '#ff4d4d';
            tricolorLinkColor = data.newsTickerTricolorLink || '#ffb000';
            tricolorTimeColor = data.newsTickerTricolorTime || '#ff4d4d';
            tricolorSourceColor = data.newsTickerTricolorSource || '#00ff41';

            // Handle case where visualEffect is not yet set but old keys exist
            if (data.newsTickerVisualEffect === undefined) {
                if (data.newsTickerLEDStyle) visualEffect = 'led';
                else if (data.newsTickerGlassmorphism) visualEffect = 'glass';
            }

            if (feeds.length > 0) {
                activeFeedId = feeds[0].id;
            }
            
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

        container = document.createElement('nt-ticker');
        container.id = 'nt-container';
        container.classList.add(`nt-${position}`);

        // Create Shadow DOM
        shadow = container.attachShadow({ mode: 'open' });

        // Load and inject CSS
        try {
            const cssUrl = chrome.runtime.getURL('content.css');
            const response = await fetch(cssUrl);
            if (!response.ok) throw new Error(`Failed to load CSS: ${response.status}`);
            const cssText = await response.text();

            styleElement = document.createElement('style');
            const extensionId = chrome.runtime.id;
            styleElement.textContent = cssText.replace(/__EXT_ID__/g, extensionId);
            shadow.appendChild(styleElement);
        } catch (e) {
            console.error('MarQee CSS error:', e);
        }

        applyHoverPauseClass();
        applyStyleClasses();
        applyModeClasses();

        track = document.createElement('div');
        track.id = 'nt-track';

        // Navigation buttons for vertical mode
        navButtonsEl = document.createElement('div');
        navButtonsEl.className = 'nt-nav-buttons';

        navUpBtn = document.createElement('button');
        navUpBtn.className = 'nt-nav-btn';
        navUpBtn.textContent = '▲';
        navUpBtn.disabled = true;
        navUpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigatePush(-1);
        });

        navDownBtn = document.createElement('button');
        navDownBtn.className = 'nt-nav-btn';
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
            track.classList.add('nt-rendering');
        }

        // Adjust body padding to not overlap
        updateBodyPadding();
    }

    function applyHoverPauseClass() {
        if (!container) return;
        if (hoverPause) {
            container.classList.add('hover-pause-enabled');
        } else {
            container.classList.remove('hover-pause-enabled');
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
            container.classList.add('theme-light');
        } else {
            container.classList.remove('theme-light');
        }

        // Remove existing scheme classes
        const schemeClasses = Array.from(container.classList).filter(c => c.startsWith('nt-scheme-'));
        schemeClasses.forEach(c => container.classList.remove(c));

        // Add new scheme class (if not light/dark/system)
        if (colorScheme !== 'light' && colorScheme !== 'dark' && colorScheme !== 'system') {
            container.classList.add(`nt-scheme-${colorScheme}`);
        }

        // Add font weight class
        const weightClasses = ['nt-weight-light', 'nt-weight-normal', 'nt-weight-bold'];
        weightClasses.forEach(c => container.classList.remove(c));
        container.classList.add(`nt-weight-${fontWeight}`);

        // Handle LED overlay
        let overlay = shadow.querySelector('.nt-led-overlay');
        if (ledStyle && !isLight) {
            container.classList.add('nt-led-enabled');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'nt-led-overlay';
                shadow.appendChild(overlay);
            }
            overlay.style.opacity = ledOpacity;
            overlay.style.mixBlendMode = ledBlendMode;
        } else {
            container.classList.remove('nt-led-enabled');
            if (overlay) overlay.remove();
        }

        // Apply font size and height
        const barHeight = fontSize + 18;
        container.style.setProperty('--nt-font-size', `${fontSize}px`);
        container.style.setProperty('--nt-height', `${barHeight}px`);
        container.style.setProperty('--nt-glass-blur', `${glassBlur}px`);

        if (visualEffect === 'glass') {
            container.classList.add('nt-glass-enabled');
        } else {
            container.classList.remove('nt-glass-enabled');
        }

        if (visualEffect === 'led') {
            container.classList.add('nt-led-enabled');
        } else {
            container.classList.remove('nt-led-enabled');
        }

        // Apply Custom Colors
        container.style.setProperty('--nt-custom-light-color', customColorLight);
        container.style.setProperty('--nt-custom-dark-color', customColorDark);
        container.style.setProperty('--nt-custom-tricolor-color', customColorTricolor);
        container.style.setProperty('--nt-tricolor-link-color', tricolorLinkColor);
        container.style.setProperty('--nt-tricolor-time-color', tricolorTimeColor);
        container.style.setProperty('--nt-tricolor-source-color', tricolorSourceColor);
    }



    function applyModeClasses() {
        if (!container) return;
        container.classList.remove('nt-mode-horizontal', 'nt-mode-horizontal-push', 'nt-mode-vertical-push');
        container.classList.add(`nt-mode-${scrollMode}`);
    }

    let shiftedElements = [];

    function shiftFixedElements() {
        if (!shiftFixed || position !== 'top') return;

        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
            if (el === container || el === document.body || el === document.documentElement) return;

            const style = window.getComputedStyle(el);
            if ((style.position === 'fixed' || style.position === 'sticky') && style.top === '0px') {
                const barHeight = fontSize + 18;
                el.style.setProperty('transform', `translateY(${barHeight}px)`, 'important');
                shiftedElements.push(el);
            }
        });
    }

    function unshiftFixedElements() {
        shiftedElements.forEach(el => {
            el.style.removeProperty('transform');
        });
        shiftedElements = [];
    }

    function updateBodyPadding() {
        unshiftFixedElements();
        const barHeight = fontSize + 18;
        if (isVisible) {
            if (position === 'top') {
                document.documentElement.style.setProperty('margin-top', `${barHeight}px`, 'important');
                // Allow DOM to settle before shifting fixed elements
                setTimeout(shiftFixedElements, 100);
            } else {
                document.documentElement.style.setProperty('margin-bottom', `${barHeight}px`, 'important');
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
            styleElement = null;
            navButtonsEl = null;
            navUpBtn = null;
            navDownBtn = null;
            document.documentElement.style.removeProperty('margin-top');
            document.documentElement.style.removeProperty('margin-bottom');
        }
    }

    async function loadAndRender() {
        if (!shadow || !track || feeds.length === 0) return;

        const enabledFeeds = feeds.filter(f => f.enabled !== false);
        if (enabledFeeds.length === 0) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'nt-item';
            const linkSpan = document.createElement('span');
            linkSpan.className = 'nt-link';
            linkSpan.textContent = 'No active feeds';
            itemDiv.appendChild(linkSpan);
            track.replaceChildren(itemDiv);
            return;
        }

        try {
            // Fetch all enabled feeds in parallel
            const fetchPromises = enabledFeeds.map(feed =>
                chrome.runtime.sendMessage({ action: 'fetchRSS', url: feed.url })
                    .then(response => {
                        if (response && response.success) {
                            if (response.isUpdated) rssIsUpdated = true;
                            return {
                                items: parseRSS(response.data),
                                feedName: feed.name
                            };
                        }
                        return { items: [], feedName: feed.name };
                    })
            );

            const results = await Promise.all(fetchPromises);

            // Restore state from session storage
            const state = await chrome.storage.session.get(['newsTickerProgress', 'newsTickerTimestamp', 'newsTickerShuffleSeed', 'newsTickerPushIndex']);
            let shuffleSeed = state.newsTickerShuffleSeed;

            // Generate new seed if RSS updated or seed missing
            if (rssIsUpdated || shuffleSeed === undefined) {
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
                const itemDiv = document.createElement('div');
                itemDiv.className = 'nt-item';
                const linkSpan = document.createElement('span');
                linkSpan.className = 'nt-link';
                linkSpan.textContent = 'No news found';
                itemDiv.appendChild(linkSpan);
                track.replaceChildren(itemDiv);
                return;
            }

            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            const fragment = document.createDocumentFragment();

            const itemsToRender = allItems;

            itemsToRender.forEach(item => {
                const isNew = item.pubDateValue > oneHourAgo;

                const itemDiv = document.createElement('div');
                itemDiv.className = 'nt-item';

                const sourceSpan = document.createElement('span');
                sourceSpan.className = 'nt-source';
                sourceSpan.textContent = `[${item.source}]`;

                const timeSpan = document.createElement('span');
                timeSpan.className = 'nt-time' + ((blinkNew && isNew) ? ' nt-blink' : '');
                timeSpan.textContent = item.timeStr || '';

                const linkA = document.createElement('a');
                linkA.href = item.link;
                linkA.target = '_blank';
                linkA.className = 'nt-link';
                linkA.textContent = item.title;

                itemDiv.append(sourceSpan, ' ', timeSpan, ' ', linkA);
                fragment.appendChild(itemDiv);
            });

            if (scrollMode === 'vertical-push' || scrollMode === 'horizontal-push') {
                const isVertical = scrollMode === 'vertical-push';
                const blankStart = document.createElement('div');
                blankStart.className = 'nt-item nt-blank';
                if (isVertical) {
                    const barHeight = fontSize + 18;
                    blankStart.style.height = `${barHeight}px`;
                } else {
                    blankStart.style.width = '100vw';
                }
                fragment.prepend(blankStart);

                const blankEnd = document.createElement('div');
                blankEnd.className = 'nt-item nt-blank';
                if (isVertical) {
                    const barHeight = fontSize + 18;
                    blankEnd.style.height = `${barHeight}px`;
                } else {
                    blankEnd.style.width = '100vw';
                }
                fragment.appendChild(blankEnd);
            }

            currentPushItems = (scrollMode === 'vertical-push' || scrollMode === 'horizontal-push') ? itemsToRender.length + 2 : itemsToRender.length;
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
                    if (!rssIsUpdated) {
                        progress = state.newsTickerProgress || 0;
                        if (state.newsTickerTimestamp) {
                            const elapsedSeconds = (Date.now() - state.newsTickerTimestamp) / 1000;
                            progress += elapsedSeconds / duration;
                            progress = progress % 1;
                        }
                    }
                    track.style.animationDelay = `-${progress * duration}s`;
                    track.style.animationName = 'nt-scroll';
                } else {
                    // Push Mode
                    track.style.animation = 'none';
                    if (rssIsUpdated) {
                        currentPushIndex = 0;
                    } else {
                        currentPushIndex = state.newsTickerPushIndex || 0;
                    }
                    if (currentPushIndex >= (currentPushItems || 1)) currentPushIndex = 0;
                    
                    // Disable transition temporarily to prevent "catch-up" jump
                    track.style.transition = 'none';
                    if (scrollMode === 'vertical-push') {
                        const barHeight = fontSize + 18;
                        track.style.transform = `translateY(-${currentPushIndex * barHeight}px)`;
                    } else {
                        track.style.transform = `translateX(-${currentPushIndex * 100}vw)`;
                    }
                    // Force reflow
                    track.offsetHeight;
                    track.style.transition = '';
                    
                    startPushAnimation();

                    if (rssIsUpdated) {
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
                            if (scrollMode === 'vertical-push') {
                                const barHeight = fontSize + 18;
                                track.style.transform = `translateY(-${currentPushIndex * barHeight}px)`;
                            } else {
                                track.style.transform = `translateX(-${currentPushIndex * 100}vw)`;
                            }
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

        } catch (e) {
            console.error('MarQee error:', e);
        }
    }

    function parseRSS(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const items = xmlDoc.querySelectorAll("item");
        const results = [];
        for (let i = 0; i < Math.min(items.length, 30); i++) {
            const item = items[i];
            const title = item.querySelector("title")?.textContent || "";
            let link = item.querySelector("link")?.textContent || "#";
            if (link !== "#" && !link.startsWith("http://") && !link.startsWith("https://")) {
                link = "#";
            }
            const pubDate = item.querySelector("pubDate")?.textContent;
            let timeStr = "";
            if (pubDate) {
                const d = new Date(pubDate);
                timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                results.push({ title, link, timeStr, pubDateValue: d.getTime(), description: "" });
            } else {
                results.push({ title, link, timeStr: "", pubDateValue: 0, description: "" });
            }
        }
        return results;
    }

    function updateNavButtons() {
        if (!navUpBtn || !navDownBtn) return;
        if (scrollMode !== 'vertical-push' && scrollMode !== 'horizontal-push') return;
        // In push mode, index 0 = blank start, articles are 1..N, index N+1 = blank end
        navUpBtn.disabled = (currentPushIndex <= 1);
        navDownBtn.disabled = (currentPushIndex >= currentPushItems - 2);
    }

    function navigatePush(direction) {
        if ((scrollMode !== 'vertical-push' && scrollMode !== 'horizontal-push') || !track) return;
        const newIndex = currentPushIndex + direction;
        // Clamp: articles are at indices 1..(currentPushItems - 2)
        if (newIndex < 1 || newIndex > currentPushItems - 2) return;

        currentPushIndex = newIndex;
        if (scrollMode === 'vertical-push') {
            const barHeight = fontSize + 18;
            track.style.transform = `translateY(-${currentPushIndex * barHeight}px)`;
        } else {
            track.style.transform = `translateX(-${currentPushIndex * 100}vw)`;
        }
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

    // Listen for changes
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.newsTickerShiftFixed) {
            shiftFixed = changes.newsTickerShiftFixed.newValue;
            updateBodyPadding();
        }
        if (changes.newsTickerFeeds) {
            feeds = changes.newsTickerFeeds.newValue || [];
            chrome.storage.session.remove(['newsTickerShuffleSeed', 'newsTickerProgress', 'newsTickerVerticalIndex']);
            loadAndRender();
        }
        if (changes.newsTickerBarVisible) {
            isVisible = changes.newsTickerBarVisible.newValue;
            if (isVisible) {
                createTicker().then(() => loadAndRender());
            } else {
                removeTicker();
            }
        }
        if (changes.newsTickerBarPos) {
            position = changes.newsTickerBarPos.newValue;
            if (container) {
                container.classList.remove('nt-top', 'nt-bottom');
                container.classList.add(`nt-${position}`);
                document.documentElement.style.removeProperty('margin-top');
                document.documentElement.style.removeProperty('margin-bottom');
                updateBodyPadding();
            }
        }
        if (changes.newsTickerSpeed) {
            speed = changes.newsTickerSpeed.newValue;
            if (track && track.offsetWidth > 0) {
                const computedStyle = window.getComputedStyle(track);
                const currentDuration = parseFloat(computedStyle.animationDuration);
                const currentDelay = parseFloat(computedStyle.animationDelay) || 0;

                // Calculate current progress (0.0 to 1.0)
                let progress = 0;
                if (currentDuration > 0) {
                    progress = (Math.abs(currentDelay) / currentDuration) % 1;
                }

                // Update duration with new speed
                const newDuration = (track.offsetWidth / 50) / speed;
                track.style.animationDuration = `${newDuration}s`;
                track.style.animationTimingFunction = 'linear';
                track.style.animationIterationCount = 'infinite';

                // Set new animation delay to maintain same progress
                track.style.animationDelay = `-${progress * newDuration}s`;
            }
        }
        if (changes.newsTickerHoverPause) {
            hoverPause = changes.newsTickerHoverPause.newValue;
            applyHoverPauseClass();
        }
        if (changes.newsTickerColorScheme) {
            colorScheme = changes.newsTickerColorScheme.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerLEDStyle) {
            ledStyle = changes.newsTickerLEDStyle.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerLEDOpacity) {
            ledOpacity = changes.newsTickerLEDOpacity.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerLEDBlendMode) {
            ledBlendMode = changes.newsTickerLEDBlendMode.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerFontWeight) {
            fontWeight = changes.newsTickerFontWeight.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerArticleSort) {
            articleSort = changes.newsTickerArticleSort.newValue;
            loadAndRender();
        }
        if (changes.newsTickerArticleGroup) {
            articleGroup = changes.newsTickerArticleGroup.newValue;
            loadAndRender();
        }
        if (changes.newsTickerBlinkNew) {
            blinkNew = changes.newsTickerBlinkNew.newValue;
            loadAndRender();
        }
        if (changes.newsTickerScrollMode) {
            scrollMode = changes.newsTickerScrollMode.newValue;
            if (container) {
                applyModeClasses();
                loadAndRender();
            }
        }
        if (changes.newsTickerVerticalPause) {
            verticalPause = changes.newsTickerVerticalPause.newValue;
            if (scrollMode === 'vertical-push' || scrollMode === 'horizontal-push') {
                loadAndRender();
            }
        }
        if (changes.newsTickerFontSize) {
            fontSize = changes.newsTickerFontSize.newValue;
            applyStyleClasses();
            updateBodyPadding();
            if (scrollMode === 'vertical-push' || scrollMode === 'horizontal-push') {
                loadAndRender();
            }
        }
        if (changes.newsTickerAgeFilterEnabled) {
            articleAgeFilterEnabled = changes.newsTickerAgeFilterEnabled.newValue;
            loadAndRender();
        }
        if (changes.newsTickerAgeHours) {
            articleAgeHours = changes.newsTickerAgeHours.newValue;
            if (articleAgeFilterEnabled) {
                loadAndRender();
            }
        }
        if (changes.newsTickerVisualEffect) {
            visualEffect = changes.newsTickerVisualEffect.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerGlassmorphismBlur) {
            glassBlur = changes.newsTickerGlassmorphismBlur.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerCustomColorLight) {
            customColorLight = changes.newsTickerCustomColorLight.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerCustomColorDark) {
            customColorDark = changes.newsTickerCustomColorDark.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerCustomColorTricolor) {
            customColorTricolor = changes.newsTickerCustomColorTricolor.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerTricolorLink) {
            tricolorLinkColor = changes.newsTickerTricolorLink.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerTricolorTime) {
            tricolorTimeColor = changes.newsTickerTricolorTime.newValue;
            applyStyleClasses();
        }
        if (changes.newsTickerTricolorSource) {
            tricolorSourceColor = changes.newsTickerTricolorSource.newValue;
            applyStyleClasses();
        }

        if (changes.newsTickerExcludedDomains) {
            excludedDomains = changes.newsTickerExcludedDomains.newValue || [];
            const isExcluded = excludedDomains.some(domain => window.location.hostname === domain || window.location.hostname.endsWith('.' + domain));
            if (isExcluded) {
                removeTicker();
            } else if (isVisible && feeds.length > 0 && !container) {
                createTicker().then(() => loadAndRender());
            }
        }
    });



    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (colorScheme === 'system') {
            applyStyleClasses();
        }
    });

    function saveTickerProgress() {
        if (!track || !isVisible) return;
        
        if (scrollMode === 'vertical-push' || scrollMode === 'horizontal-push') {
            chrome.storage.session.set({ newsTickerPushIndex: currentPushIndex });
            return;
        }

        if (scrollMode === 'horizontal') {
            const computedStyle = window.getComputedStyle(track);
            const transform = computedStyle.getPropertyValue('transform');
            if (transform && transform !== 'none') {
                const matrixValues = transform.match(/matrix.*\((.+)\)/);
                if (matrixValues) {
                    const parts = matrixValues[1].split(', ');
                    const x = parseFloat(parts[4]);
                    if (!isNaN(x) && track.offsetWidth > 0) {
                        let progress = Math.abs(x) / track.offsetWidth;
                        chrome.storage.session.set({
                            newsTickerProgress: progress,
                            newsTickerTimestamp: Date.now()
                        });
                    }
                }
            }
        } else {
            // Vertical Push Mode
            chrome.storage.session.set({
                newsTickerVerticalIndex: currentVerticalIndex,
                newsTickerTimestamp: Date.now()
            });
        }
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
            track.classList.remove('nt-rendering');
        } else {
            // 1. Resume CSS animations
            track.style.animationPlayState = 'running';
            
            // 2. Restart JS timer if in push mode
            if (scrollMode === 'vertical-push' || scrollMode === 'horizontal-push') {
                startPushAnimation_ref();
            }
            
            // 3. Re-enable will-change
            track.classList.add('nt-rendering');
        }
    });

    init();
})();
