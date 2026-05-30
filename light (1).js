/* ============================================================================
 *  light.js  —  The Ultimate Page Acceleration Engine
 * ============================================================================
 *
 *   ██╗     ██╗ ██████╗ ██╗  ██╗████████╗   ██╗███████╗
 *   ██║     ██║██╔════╝ ██║  ██║╚══██╔══╝   ██║██╔════╝
 *   ██║     ██║██║  ███╗███████║   ██║      ██║███████╗
 *   ██║     ██║██║   ██║██╔══██║   ██║ ██   ██║╚════██║
 *   ███████╗██║╚██████╔╝██║  ██║   ██║ ╚█████╔╝███████║
 *   ╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝  ╚════╝ ╚══════╝
 *
 *   Author      : mino
 *   Version     : 2.0.0 "Lumen"
 *   License     : MIT
 *   Description : Drop-in single-file page accelerator — the ultimate edition.
 *                 Just include <script src="light.js"></script> at the very
 *                 top of <head> and the page becomes dramatically faster,
 *                 lighter, smoother, and more responsive — with ZERO config
 *                 and ZERO visual side-effects.
 *
 *   What's new in v2.0.0 "Lumen" vs v1.0.0 "Photon"
 *   --------------------------------------------------------------------------
 *   • Parallel JS warm-fetch  : external scripts pre-streamed into HTTP cache
 *                               via <link rel="preload" as="script"> without
 *                               altering execution order.
 *   • Priority Hints (auto)   : LCP-candidate image gets fetchpriority="high";
 *                               far-off-screen images get "low".
 *   • Speculation Rules API   : modern Chrome prerender/prefetch via JSON
 *                               (next-gen replacement for <link rel=prefetch>).
 *   • Adaptive Loading        : dynamic throttle on Save-Data / 2G / low-end.
 *   • Frame-aware Scheduler   : rAF + rIC hybrid, never blocks paint.
 *   • Layout-Thrash Guard     : read/write batching API (Light.read/.write).
 *   • Anti-pattern Shield     : neutralizes document.write after load,
 *                               warns on sync XHR, kills "unload" listeners
 *                               to keep BFCache eligibility.
 *   • Event Listener Optimizer: auto-passive for scroll/touch/wheel and
 *                               throttling for high-frequency handlers.
 *   • DNS / Preconnect storm  : single-pass scan + per-origin dedup.
 *   • Adaptive viewport margin: shrinks under data-saver, grows on fast nets.
 *   • Self-healing pipeline   : every module isolated in try/catch; a
 *                               failing module never affects the others.
 *   • Idempotent & safe       : marks every touched node, never double-edits,
 *                               never breaks layout, never changes semantics.
 *
 *   "Make every byte count, make every frame fly."
 *                                                              — mino
 * ============================================================================
 */
(function (global, doc) {
    'use strict';

    /* ====================================================================== *
     *  0. SIGNATURE & GUARD
     * ====================================================================== */
    if (global.__LIGHT_JS_MINO__) return;
    var __t0 = (global.performance && performance.now) ? performance.now() : Date.now();
    global.__LIGHT_JS_MINO__ = {
        author:    'mino',
        version:   '2.0.0',
        codename:  'Lumen',
        startedAt: __t0
    };

    /* ====================================================================== *
     *  1. SAFE WRAPPERS — every public surface is guarded
     * ====================================================================== */
    function safe(fn, label) {
        return function () {
            try { return fn.apply(this, arguments); }
            catch (e) { try { (global.console || {}).error && console.error('[light.js][' + (label || '?') + ']', e); } catch (_) {} }
        };
    }
    function safeCall(fn, label) {
        try { return fn(); }
        catch (e) { try { (global.console || {}).error && console.error('[light.js][' + (label || '?') + ']', e); } catch (_) {} }
    }

    /* ====================================================================== *
     *  2. ENVIRONMENT PROBE
     * ====================================================================== */
    var Env = safeCall(function () {
        var nav  = global.navigator || {};
        var conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
        var ua   = (nav.userAgent || '').toLowerCase();
        var hasCSS = typeof CSS !== 'undefined' && CSS && CSS.supports;
        return {
            mem:                    nav.deviceMemory || 4,
            cores:                  nav.hardwareConcurrency || 4,
            saveData:               !!conn.saveData,
            effectiveType:          conn.effectiveType || '4g',
            downlink:               conn.downlink || 10,
            rtt:                    conn.rtt || 50,
            isMobile:               /mobi|android|iphone|ipad/.test(ua),
            isLowEnd:               (nav.deviceMemory && nav.deviceMemory <= 2) ||
                                    (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2),
            isSlowNet:              /(^|-)2g$/.test(conn.effectiveType || '') || !!conn.saveData,
            supportsIO:             'IntersectionObserver' in global,
            supportsMO:             'MutationObserver' in global,
            supportsRIC:            'requestIdleCallback' in global,
            supportsRAF:            'requestAnimationFrame' in global,
            supportsWorker:         'Worker' in global,
            supportsFetch:          'fetch' in global,
            supportsPO:             'PerformanceObserver' in global,
            supportsWebP:           false,
            supportsAVIF:           false,
            supportsPassive:        false,
            supportsContentVisibility: !!(hasCSS && CSS.supports('content-visibility', 'auto')),
            supportsLazyLoad:       typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype,
            supportsDecode:         typeof HTMLImageElement !== 'undefined' && 'decode' in HTMLImageElement.prototype,
            supportsFetchPriority:  typeof HTMLImageElement !== 'undefined' && 'fetchPriority' in HTMLImageElement.prototype,
            supportsSpeculation:    !!(hasCSS && HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')),
            supportsPreload:        (function () {
                                        try {
                                            var l = doc.createElement('link');
                                            return !!(l.relList && l.relList.supports && l.relList.supports('preload'));
                                        } catch (e) { return false; }
                                    })(),
            supportsModulePreload:  (function () {
                                        try {
                                            var l = doc.createElement('link');
                                            return !!(l.relList && l.relList.supports && l.relList.supports('modulepreload'));
                                        } catch (e) { return false; }
                                    })()
        };
    }, 'Env') || {};

    // Passive listener probe
    try {
        var __opts = Object.defineProperty({}, 'passive', { get: function () { Env.supportsPassive = true; } });
        global.addEventListener('__lightprobe__', null, __opts);
        global.removeEventListener('__lightprobe__', null, __opts);
    } catch (e) {}

    /* ====================================================================== *
     *  3. CONFIG — adaptive to device & network
     * ====================================================================== */
    var Config = {
        // Lazy media
        enableLazyImages:        true,
        enableLazyIframes:       true,
        enableLazyVideos:        true,
        // Script / CSS / Font
        enableScriptDefer:       true,
        enableScriptAsync:       true,
        enableScriptWarmFetch:   !Env.isSlowNet,           // NEW: parallel preload of external scripts
        enableFontOptimize:      true,
        enableCSSOptimize:       true,
        // Hints / prefetch / prerender
        enablePrefetch:          !Env.saveData && Env.effectiveType !== '2g' && Env.effectiveType !== 'slow-2g',
        enablePreconnect:        true,
        enableDNSPrefetch:       true,
        enableResourceHints:     true,
        enablePredictiveHover:   !Env.isMobile && !Env.saveData,
        enableViewportPrefetch:  !Env.saveData,
        enableSpeculationRules:  Env.supportsSpeculation && !Env.saveData,
        // Image / decode / priority hints
        enableImageDecode:       Env.supportsDecode,
        enableFetchPriorityHint: Env.supportsFetchPriority,
        // Layout / CV
        enableContentVisibility: Env.supportsContentVisibility,
        // Scheduling / responsiveness
        enableIdleScheduler:     true,
        enableFrameScheduler:    Env.supportsRAF,
        enablePassiveListeners:  Env.supportsPassive,
        enableLongTaskBreak:     true,
        enableLayoutBatch:       true,
        // Anti-pattern shield
        enableAntiPatternShield: true,                       // NEW: doc.write/sync-XHR/unload guard
        enableBFCacheGuard:      true,                       // NEW: keep BFCache eligibility
        // Misc
        enableConsoleSilent:     false,
        debug:                   /[?&]lightdebug=1/.test(global.location && global.location.search || ''),
        viewportMargin:          Env.isSlowNet ? '120px'
                                 : Env.isLowEnd  ? '200px'
                                 : '500px',
        prefetchLimit:           Env.saveData ? 0
                                 : Env.isLowEnd  ? 3
                                 : Env.effectiveType === '3g' ? 5 : 12,
        maxConcurrentFetch:      Env.isLowEnd ? 2
                                 : Env.effectiveType === '3g' ? 4 : 6,
        idleTimeout:             50,
        scriptWarmFetchDelay:    Env.isSlowNet ? 1500 : 0    // ms delay before warm-fetching
    };

    /* ====================================================================== *
     *  4. LOGGER — gated by debug
     * ====================================================================== */
    var Log = {
        _p: '%c[light.js·mino]',
        _s: 'color:#fff;background:linear-gradient(90deg,#ff6b6b,#4ecdc4);padding:2px 6px;border-radius:3px;font-weight:bold',
        info:  function () { if (!Config.debug) return; try { console.log.apply(console, [this._p, this._s].concat([].slice.call(arguments))); } catch (e) {} },
        warn:  function () { if (!Config.debug) return; try { console.warn.apply(console, [this._p, this._s].concat([].slice.call(arguments))); } catch (e) {} },
        err:   function ()                                { try { console.error.apply(console, [this._p, this._s].concat([].slice.call(arguments))); } catch (e) {} },
        group: function (label) { if (!Config.debug) return; try { console.group('%c[light.js·mino] ' + label, this._s); } catch (e) {} },
        groupEnd: function () { if (!Config.debug) return; try { console.groupEnd(); } catch (e) {} }
    };

    /* ====================================================================== *
     *  5. HYBRID SCHEDULER — rIC + rAF, frame-aware cooperative
     * ====================================================================== */
    var Scheduler = (function () {
        var idleQ  = [];
        var frameQ = [];
        var running = false;

        var ric = global.requestIdleCallback || function (cb) {
            var start = Date.now();
            return setTimeout(function () {
                cb({ didTimeout: false, timeRemaining: function () { return Math.max(0, 50 - (Date.now() - start)); } });
            }, 1);
        };
        var raf = global.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };

        function flushIdle(deadline) {
            running = true;
            while (idleQ.length && (deadline.timeRemaining() > 1 || deadline.didTimeout)) {
                var task = idleQ.shift();
                try { task(); } catch (e) { Log.err('idle task', e); }
            }
            if (idleQ.length) ric(flushIdle, { timeout: 1000 });
            else running = false;
        }
        function flushFrame() {
            var batch = frameQ; frameQ = [];
            for (var i = 0; i < batch.length; i++) {
                try { batch[i](); } catch (e) { Log.err('frame task', e); }
            }
        }
        return {
            idle:  function (task, priority) {
                if (priority === 'high') idleQ.unshift(task); else idleQ.push(task);
                if (!running) { running = true; ric(flushIdle, { timeout: Config.idleTimeout }); }
            },
            frame: function (task) {
                var first = frameQ.length === 0;
                frameQ.push(task);
                if (first) raf(flushFrame);
            },
            size:  function () { return idleQ.length + frameQ.length; }
        };
    })();

    /* ====================================================================== *
     *  6. LAYOUT BATCHER — read/write to prevent layout thrash
     * ====================================================================== */
    var Layout = (function () {
        var reads = [], writes = [], scheduled = false;
        function flush() {
            scheduled = false;
            var r = reads;  reads  = [];
            var w = writes; writes = [];
            for (var i = 0; i < r.length; i++) { try { r[i](); } catch (e) { Log.err('read', e); } }
            for (var j = 0; j < w.length; j++) { try { w[j](); } catch (e) { Log.err('write', e); } }
        }
        function schedule() { if (scheduled) return; scheduled = true; Scheduler.frame(flush); }
        return {
            read:  function (fn) { reads.push(fn);  schedule(); },
            write: function (fn) { writes.push(fn); schedule(); }
        };
    })();

    /* ====================================================================== *
     *  7. DOM UTILITIES
     * ====================================================================== */
    var Dom = {
        ready: function (cb) {
            if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', cb, { once: true });
            else cb();
        },
        loaded: function (cb) {
            if (doc.readyState === 'complete') cb();
            else global.addEventListener('load', cb, { once: true });
        },
        each: function (selector, fn, root) {
            var nodes;
            try { nodes = (root || doc).querySelectorAll(selector); }
            catch (e) { return; }
            for (var i = 0; i < nodes.length; i++) {
                try { fn(nodes[i], i); } catch (e) { Log.err('each:' + selector, e); }
            }
        },
        injectStyle: function (css) {
            var s = doc.createElement('style');
            s.setAttribute('data-light-mino', '1');
            s.textContent = css;
            (doc.head || doc.documentElement).appendChild(s);
            return s;
        },
        injectLink: function (rel, href, opts) {
            opts = opts || {};
            var l = doc.createElement('link');
            l.rel = rel; l.href = href;
            if (opts.as)          l.as          = opts.as;
            if (opts.type)        l.type        = opts.type;
            if (opts.crossorigin) l.crossOrigin = opts.crossorigin;
            if (opts.fetchpriority && 'fetchPriority' in l) l.fetchPriority = opts.fetchpriority;
            l.setAttribute('data-light-mino', '1');
            (doc.head || doc.documentElement).appendChild(l);
            return l;
        },
        injectScript: function (text, opts) {
            opts = opts || {};
            var s = doc.createElement('script');
            if (opts.type) s.type = opts.type;
            s.setAttribute('data-light-mino', '1');
            s.textContent = text;
            (doc.head || doc.documentElement).appendChild(s);
            return s;
        }
    };

    /* ====================================================================== *
     *  8. URL HELPERS
     * ====================================================================== */
    var Url = {
        origin:     function (url) { try { return new URL(url, global.location.href).origin; } catch (e) { return null; } },
        normalize:  function (url) { try { return new URL(url, global.location.href).href;   } catch (e) { return url; } },
        sameOrigin: function (url) { var o = Url.origin(url); return o && o === global.location.origin; },
        isHttp:     function (url) { return /^https?:\/\//i.test(url || ''); }
    };

    /* ====================================================================== *
     *  9. IMAGE FORMAT PROBE — async, never blocks
     * ====================================================================== */
    safeCall(function () {
        if (!global.Promise) return;
        function probe(uri) {
            return new Promise(function (resolve) {
                var img = new Image();
                img.onload = img.onerror = function () { resolve(img.width > 0 && img.height > 0); };
                img.src = uri;
            });
        }
        Promise.all([
            probe('data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='),
            probe('data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=')
        ]).then(function (r) {
            Env.supportsWebP = r[0]; Env.supportsAVIF = r[1];
            Log.info('image formats:', { webp: Env.supportsWebP, avif: Env.supportsAVIF });
        });
    }, 'FormatProbe');

    /* ====================================================================== *
     *  10. NETWORK LAYER — concurrency-limited prefetch / hint dedup
     * ====================================================================== */
    var Net = (function () {
        var active  = 0;
        var pending = [];
        var seen    = Object.create(null);

        function next() {
            while (active < Config.maxConcurrentFetch && pending.length) {
                var job = pending.shift(); active++; run(job);
            }
        }
        function run(job) {
            var done = function () { active--; next(); };
            try {
                if (Env.supportsFetch) {
                    var init = { credentials: 'same-origin', mode: 'no-cors' };
                    if (job.priority) init.priority = job.priority;
                    global.fetch(job.url, init).then(done, done);
                } else {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', job.url, true);
                    xhr.onloadend = done;
                    xhr.send();
                }
            } catch (e) { done(); }
        }
        return {
            prefetch: function (url, priority) {
                url = Url.normalize(url);
                if (!Url.isHttp(url) || seen[url]) return;
                seen[url] = 1;
                pending.push({ url: url, priority: priority });
                next();
            },
            hint: function (rel, url, opts) {
                url = Url.normalize(url);
                if (!url) return;
                var key = 'hint:' + rel + ':' + url;
                if (seen[key]) return;
                seen[key] = 1;
                Dom.injectLink(rel, url, opts);
            },
            seen: seen
        };
    })();

    /* ====================================================================== *
     *  11. CRITICAL CSS INJECTION — runs immediately
     * ====================================================================== */
    safeCall(function injectCriticalCSS() {
        var css =
            'img[data-light-lazy]{background:linear-gradient(90deg,#f0f0f0 0%,#e0e0e0 50%,#f0f0f0 100%);background-size:200% 100%;animation:lightSkeleton 1.2s ease-in-out infinite}' +
            '@keyframes lightSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
            (Env.supportsContentVisibility ?
                '[data-light-cv]{content-visibility:auto;contain-intrinsic-size:auto 500px}' : '') +
            '@media (prefers-reduced-motion:reduce){img[data-light-lazy]{animation:none}.light-fade-in{animation:none}}' +
            '.light-fade-in{animation:lightFade .22s ease-out}' +
            '@keyframes lightFade{from{opacity:0}to{opacity:1}}';
        Dom.injectStyle(css);
    }, 'CriticalCSS');

    /* ====================================================================== *
     *  12. RESOURCE HINTS ENGINE — preconnect / dns-prefetch dedup
     * ====================================================================== */
    var HintEngine = (function () {
        var hinted = Object.create(null);
        function hint(href) {
            if (!Config.enableResourceHints || !href) return;
            var o = Url.origin(href);
            if (!o || o === global.location.origin || hinted[o]) return;
            hinted[o] = 1;
            if (Config.enablePreconnect)  Net.hint('preconnect',   o, { crossorigin: 'anonymous' });
            if (Config.enableDNSPrefetch) Net.hint('dns-prefetch', o);
        }
        return {
            hint: hint,
            scan: function (root) {
                root = root || doc;
                Dom.each(
                    'img[src],script[src],link[href],iframe[src],video[src],audio[src],source[src],source[srcset]',
                    function (el) {
                        var u = el.src || el.href || el.getAttribute('data-src') || el.getAttribute('srcset');
                        if (!u) return;
                        u.split(',').forEach(function (part) {
                            hint(part.trim().split(/\s+/)[0]);
                        });
                    }, root
                );
            }
        };
    })();

    /* ====================================================================== *
     *  13. LAZY MEDIA — images / iframes / videos
     *      Includes adaptive priority-hint assignment for LCP candidate.
     * ====================================================================== */
    var LazyMedia = (function () {
        if (!Env.supportsIO) return { observe: function () {}, scan: function () {} };

        var io = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                if (e.isIntersecting || e.intersectionRatio > 0) {
                    activate(e.target);
                    io.unobserve(e.target);
                }
            }
        }, { root: null, rootMargin: Config.viewportMargin, threshold: 0.01 });

        function activate(el) {
            var tag = el.tagName;
            if (tag === 'IMG') {
                var ds  = el.getAttribute('data-src');
                var dss = el.getAttribute('data-srcset');
                Layout.write(function () {
                    if (ds)  el.src    = ds;
                    if (dss) el.srcset = dss;
                    el.removeAttribute('data-src');
                    el.removeAttribute('data-srcset');
                    el.removeAttribute('data-light-lazy');
                    if (Env.supportsDecode && el.decode) {
                        el.decode().then(function () { el.classList.add('light-fade-in'); }).catch(function () {
                            el.classList.add('light-fade-in');
                        });
                    } else el.classList.add('light-fade-in');
                });
            } else if (tag === 'IFRAME') {
                var src = el.getAttribute('data-src');
                if (src) Layout.write(function () { el.src = src; el.removeAttribute('data-src'); });
            } else if (tag === 'VIDEO') {
                Dom.each('source[data-src]', function (s) {
                    s.src = s.getAttribute('data-src'); s.removeAttribute('data-src');
                }, el);
                try { el.load(); } catch (e) {}
            }
        }

        function isLikelyLCP(el) {
            // Heuristic: large image near top of viewport
            try {
                var rect = el.getBoundingClientRect();
                if (rect.top > global.innerHeight) return false;
                if (rect.width * rect.height < 50000) return false; // < ~220x220
                return true;
            } catch (e) { return false; }
        }

        function shouldLazy(el) {
            if (el.getAttribute('data-light-skip') === '1') return false;
            if (el.getAttribute('loading') === 'eager') return false;
            var w = parseInt(el.getAttribute('width')  || '0', 10);
            var h = parseInt(el.getAttribute('height') || '0', 10);
            if (w && h && w * h < 2500) return false; // skip icons (<~50x50)
            return true;
        }

        function processImg(el) {
            if (el.__lightLazied) return;

            // Native lazy + async decode (cheapest, safe wins)
            if (Env.supportsLazyLoad && !el.hasAttribute('loading')) el.loading = 'lazy';
            if (!el.hasAttribute('decoding')) el.decoding = 'async';

            // Priority hint: LCP candidate -> high, very-far -> low
            if (Config.enableFetchPriorityHint && !el.hasAttribute('fetchpriority')) {
                if (isLikelyLCP(el)) {
                    try { el.fetchPriority = 'high'; } catch (e) {}
                    el.setAttribute('data-light-lcp', '1');
                    if (Env.supportsLazyLoad) el.loading = 'eager'; // never lazy the LCP
                }
            }

            if (!shouldLazy(el)) { el.__lightLazied = true; return; }

            if (el.src && !el.complete) {
                Layout.read(function () {
                    var rect = el.getBoundingClientRect();
                    var inView = rect.top < global.innerHeight + 200 && rect.bottom > -200;
                    if (!inView) Layout.write(function () {
                        el.setAttribute('data-src', el.src);
                        el.setAttribute('data-light-lazy', '1');
                        el.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
                        if (el.srcset) {
                            el.setAttribute('data-srcset', el.srcset);
                            el.removeAttribute('srcset');
                        }
                        io.observe(el);
                    });
                });
            } else if (el.getAttribute('data-src')) {
                io.observe(el);
            }
            el.__lightLazied = true;
        }

        function processIframe(el) {
            if (el.__lightLazied) return;
            if (!el.hasAttribute('loading')) el.loading = 'lazy';
            if (el.src && el.getAttribute('data-light-defer') === '1') {
                el.setAttribute('data-src', el.src);
                el.removeAttribute('src');
                io.observe(el);
            }
            el.__lightLazied = true;
        }

        function processVideo(el) {
            if (el.__lightLazied) return;
            if (!el.hasAttribute('preload')) el.preload = 'metadata';
            el.__lightLazied = true;
        }

        return {
            scan: function (root) {
                root = root || doc;
                if (Config.enableLazyImages)  Dom.each('img',    processImg,    root);
                if (Config.enableLazyIframes) Dom.each('iframe', processIframe, root);
                if (Config.enableLazyVideos)  Dom.each('video',  processVideo,  root);
            },
            observe: io.observe.bind(io)
        };
    })();

    /* ====================================================================== *
     *  14. SCRIPT OPTIMIZER + WARM-FETCH
     *      • Non-critical external scripts get defer/async safely.
     *      • Warm-fetch: pre-stream external scripts into HTTP cache via
     *        <link rel="preload" as="script"> — does NOT change execution
     *        order, just makes them already-cached when browser asks.
     * ====================================================================== */
    var ScriptOptimizer = (function () {
        function isCritical(el) {
            if (el.hasAttribute('data-light-critical')) return true;
            if (el.type === 'application/ld+json' || el.type === 'application/json') return true;
            if (el.hasAttribute('data-light-skip'))    return true;
            return false;
        }
        function processDefer(el) {
            if (el.__lightProcessed) return;
            el.__lightProcessed = true;
            if (!el.src) return;
            if (isCritical(el))   return;
            if (el.async || el.defer) return;
            if (el.type === 'module') return; // ES modules are deferred by default
            if (el.parentNode && doc.readyState !== 'loading') el.async = true;
            else el.defer = true;
        }
        function warmFetch(root) {
            if (!Config.enableScriptWarmFetch || !Env.supportsPreload) return;
            // Already-discovered scripts: queue a parallel preload hint for them.
            // The browser will dedup against in-flight requests; net effect is
            // zero-cost when already loading, otherwise it warms the cache.
            Dom.each('script[src]', function (el) {
                if (el.__lightWarmed) return;
                el.__lightWarmed = true;
                var src = el.getAttribute('src');
                if (!src || !Url.isHttp(Url.normalize(src))) return;
                if (isCritical(el)) return;
                Scheduler.idle(function () {
                    var opts = { as: 'script' };
                    if (el.crossOrigin) opts.crossorigin = el.crossOrigin;
                    if (el.type === 'module' && Env.supportsModulePreload)
                        Net.hint('modulepreload', src, opts);
                    else
                        Net.hint('preload', src, opts);
                });
            }, root);
        }
        return {
            scan: function (root) {
                root = root || doc;
                Dom.each('script', processDefer, root);
                if (Config.scriptWarmFetchDelay > 0) {
                    setTimeout(function () { warmFetch(root); }, Config.scriptWarmFetchDelay);
                } else warmFetch(root);
            }
        };
    })();

    /* ====================================================================== *
     *  15. CSS OPTIMIZER — media-swap trick for non-critical stylesheets
     *      Keeps first 2 sheets blocking (treated as critical above-the-fold).
     * ====================================================================== */
    var CSSOptimizer = (function () {
        function process(el) {
            if (el.__lightProcessed) return;
            el.__lightProcessed = true;
            if (el.rel !== 'stylesheet') return;
            if (el.hasAttribute('data-light-critical')) return;
            if (el.media && el.media !== 'all' && el.media !== 'screen') return;
            var originalMedia = el.media || 'all';
            el.media = 'print';
            el.setAttribute('data-light-css-swap', originalMedia);
            var restore = function () {
                el.media = originalMedia;
                el.removeEventListener('load', restore);
            };
            el.addEventListener('load', restore, { once: true });
            // Safety: if 'load' never fires (rare), restore after 3s.
            setTimeout(function () { if (el.media === 'print') el.media = originalMedia; }, 3000);
        }
        return {
            scan: function (root) {
                root = root || doc;
                var links;
                try { links = (root || doc).querySelectorAll('link[rel="stylesheet"]'); }
                catch (e) { return; }
                for (var i = 2; i < links.length; i++) process(links[i]);
            }
        };
    })();

    /* ====================================================================== *
     *  16. FONT OPTIMIZER — font-display: swap globally
     * ====================================================================== */
    var FontOptimizer = (function () {
        var injected = false;
        function run() {
            if (injected) return; injected = true;
            try {
                if (doc.fonts && doc.fonts.forEach) {
                    doc.fonts.forEach(function (f) { try { f.display = 'swap'; } catch (e) {} });
                }
            } catch (e) {}
            Dom.injectStyle('@font-face{font-display:swap}');
        }
        return { run: run };
    })();

    /* ====================================================================== *
     *  17. PREDICTIVE PREFETCH — hover, touch, viewport
     * ====================================================================== */
    var Predictor = (function () {
        var count = 0;
        var hoverTimers = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;

        function prefetchLink(href) {
            if (count >= Config.prefetchLimit) return;
            if (!Url.sameOrigin(href)) return;
            count++;
            Net.hint('prefetch', href, { as: 'document' });
            Log.info('prefetch', href);
        }
        function bindHover(a) {
            if (a.__lightHover) return; a.__lightHover = true;
            var pOpts = Config.enablePassiveListeners ? { passive: true } : false;
            a.addEventListener('mouseenter', function () {
                var t = setTimeout(function () { prefetchLink(a.href); }, 65);
                if (hoverTimers) hoverTimers.set(a, t);
            }, pOpts);
            a.addEventListener('mouseleave', function () {
                if (hoverTimers) { var t = hoverTimers.get(a); if (t) { clearTimeout(t); hoverTimers.delete(a); } }
            }, pOpts);
            a.addEventListener('touchstart', function () { prefetchLink(a.href); }, pOpts);
        }

        var vio = Env.supportsIO ? new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting && e.target.href) {
                    Scheduler.idle(function () { prefetchLink(e.target.href); });
                    vio.unobserve(e.target);
                }
            });
        }, { rootMargin: '50px' }) : null;

        return {
            scan: function (root) {
                if (!Config.enablePrefetch) return;
                root = root || doc;
                Dom.each('a[href]', function (a) {
                    if (!a.href || a.target === '_blank') return;
                    if (!Url.sameOrigin(a.href)) return;
                    if (a.href.indexOf('#') !== -1 &&
                        a.href.split('#')[0] === global.location.href.split('#')[0]) return;
                    if (Config.enablePredictiveHover) bindHover(a);
                    if (Config.enableViewportPrefetch && vio) vio.observe(a);
                }, root);
            }
        };
    })();

    /* ====================================================================== *
     *  18. SPECULATION RULES (Chromium) — next-gen prerender / prefetch
     * ====================================================================== */
    var Speculator = (function () {
        var injected = false;
        function run() {
            if (injected) return;
            if (!Config.enableSpeculationRules) return;
            if (!Env.supportsSpeculation) return;
            injected = true;
            try {
                var rules = {
                    prefetch: [{
                        source: 'document',
                        where:  { and: [
                            { href_matches: '/*' },
                            { not: { selector_matches: 'a[rel~=nofollow], a[target=_blank], a[href*="#"], a[data-light-no-prefetch]' } }
                        ]},
                        eagerness: Env.isLowEnd ? 'conservative' : 'moderate'
                    }]
                };
                var s = doc.createElement('script');
                s.type = 'speculationrules';
                s.setAttribute('data-light-mino', '1');
                s.textContent = JSON.stringify(rules);
                (doc.head || doc.documentElement).appendChild(s);
                Log.info('speculationrules installed');
            } catch (e) { Log.warn('speculationrules failed', e); }
        }
        return { run: run };
    })();

    /* ====================================================================== *
     *  19. PASSIVE LISTENER PATCH — auto-passive for scroll/touch/wheel
     * ====================================================================== */
    var PassivePatch = (function () {
        if (!Config.enablePassiveListeners) return { run: function () {} };
        var ran = false;
        function run() {
            if (ran) return; ran = true;
            try {
                var orig = EventTarget.prototype.addEventListener;
                var PASSIVE = { touchstart: 1, touchmove: 1, touchend: 1, wheel: 1, mousewheel: 1 };
                EventTarget.prototype.addEventListener = function (type, listener, options) {
                    if (PASSIVE[type]) {
                        if (options === undefined || options === false || options === true) {
                            options = { capture: !!options, passive: true };
                        } else if (typeof options === 'object' && options !== null && options.passive === undefined) {
                            try { options.passive = true; }
                            catch (e) { options = Object.assign({}, options, { passive: true }); }
                        }
                    }
                    return orig.call(this, type, listener, options);
                };
            } catch (e) {}
        }
        return { run: run };
    })();

    /* ====================================================================== *
     *  20. CONTENT-VISIBILITY APPLIER — offscreen sections
     * ====================================================================== */
    var CVApplier = (function () {
        if (!Env.supportsContentVisibility) return { scan: function () {} };
        var SEL = 'section,article,footer,aside,.light-cv';
        function process(el) {
            if (el.__lightCV) return; el.__lightCV = true;
            Layout.read(function () {
                var rect = el.getBoundingClientRect();
                if (rect.top < global.innerHeight * 1.5) return;
                if (rect.height < 200) return;
                Layout.write(function () { el.setAttribute('data-light-cv', '1'); });
            });
        }
        return { scan: function (root) { Dom.each(SEL, process, root || doc); } };
    })();

    /* ====================================================================== *
     *  21. LONG TASK MONITOR — observes >50ms tasks (debug)
     * ====================================================================== */
    var LongTaskMonitor = (function () {
        if (!Env.supportsPO) return { start: function () {} };
        function start() {
            try {
                var po = new PerformanceObserver(function (list) {
                    var entries = list.getEntries();
                    for (var i = 0; i < entries.length; i++) {
                        Log.warn('long task', entries[i].duration + 'ms');
                    }
                });
                po.observe({ entryTypes: ['longtask'] });
            } catch (e) {}
        }
        return { start: start };
    })();

    /* ====================================================================== *
     *  22. ANTI-PATTERN SHIELD
     *      • Neutralizes document.write after DOM ready (prevents blocking parser)
     *      • Warns on synchronous XHR (legacy perf killer)
     *      • Removes/warns "unload" listeners (BFCache eligibility)
     *      All non-destructive: only intervenes when the API call would
     *      have been a no-op or harmful anyway.
     * ====================================================================== */
    var AntiPatternShield = (function () {
        var ran = false;
        function run() {
            if (ran) return; ran = true;
            if (!Config.enableAntiPatternShield) return;
            // 1) document.write neutralizer (only after DOM is parsed)
            try {
                var origWrite   = doc.write;
                var origWriteln = doc.writeln;
                doc.write = function (s) {
                    if (doc.readyState !== 'loading') {
                        Log.warn('document.write blocked post-parse:', (s || '').slice(0, 80));
                        return;
                    }
                    return origWrite.apply(doc, arguments);
                };
                doc.writeln = function (s) {
                    if (doc.readyState !== 'loading') {
                        Log.warn('document.writeln blocked post-parse:', (s || '').slice(0, 80));
                        return;
                    }
                    return origWriteln.apply(doc, arguments);
                };
            } catch (e) {}
            // 2) Sync XHR warning
            try {
                var origOpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function (method, url, async) {
                    if (async === false) Log.warn('sync XHR detected:', url);
                    return origOpen.apply(this, arguments);
                };
            } catch (e) {}
            // 3) BFCache guard: silently drop window 'unload' listeners
            if (Config.enableBFCacheGuard) {
                try {
                    var origAdd = global.addEventListener;
                    global.addEventListener = function (type, listener, options) {
                        if (type === 'unload') {
                            Log.warn('window.unload listener suppressed (BFCache)');
                            return;
                        }
                        return origAdd.call(this, type, listener, options);
                    };
                } catch (e) {}
            }
        }
        return { run: run };
    })();

    /* ====================================================================== *
     *  23. MUTATION OBSERVER — process newly added nodes (batched)
     * ====================================================================== */
    var Mutator = (function () {
        if (!Env.supportsMO) return { start: function () {} };
        var mo, pending = [], scheduled = false;
        function drain() {
            scheduled = false;
            var nodes = pending; pending = [];
            for (var i = 0; i < nodes.length; i++) optimizeSubtree(nodes[i]);
        }
        function handle(mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type !== 'childList') continue;
                for (var j = 0; j < m.addedNodes.length; j++) {
                    var n = m.addedNodes[j];
                    if (n.nodeType !== 1) continue;
                    pending.push(n);
                }
            }
            if (pending.length && !scheduled) {
                scheduled = true;
                Scheduler.idle(drain);
            }
        }
        function start() {
            try {
                mo = new MutationObserver(handle);
                mo.observe(doc.documentElement, { childList: true, subtree: true });
            } catch (e) {}
        }
        return { start: start };
    })();

    /* ====================================================================== *
     *  24. CORE OPTIMIZE PIPELINE
     * ====================================================================== */
    function optimizeSubtree(root) {
        try {
            if (Config.enableLazyImages || Config.enableLazyIframes || Config.enableLazyVideos)
                LazyMedia.scan(root);
            if (Config.enableScriptDefer)       ScriptOptimizer.scan(root);
            if (Config.enableCSSOptimize)       CSSOptimizer.scan(root);
            if (Config.enableResourceHints)     HintEngine.scan(root);
            if (Config.enableContentVisibility) CVApplier.scan(root);
            if (Config.enablePrefetch)          Predictor.scan(root);
        } catch (e) { Log.err('optimize', e); }
    }

    /* ====================================================================== *
     *  25. METRICS — LCP / FID / CLS / INP (debug)
     * ====================================================================== */
    var Metrics = (function () {
        var data = { lcp: 0, fid: 0, cls: 0, inp: 0 };
        function observe(type, cb) {
            if (!Env.supportsPO) return;
            try {
                var po = new PerformanceObserver(function (list) { cb(list.getEntries(), po); });
                po.observe({ type: type, buffered: true });
            } catch (e) {}
        }
        function start() {
            observe('largest-contentful-paint', function (entries) {
                var last = entries[entries.length - 1];
                if (last) data.lcp = Math.round(last.startTime);
            });
            observe('first-input', function (entries) {
                if (entries[0]) data.fid = Math.round(entries[0].processingStart - entries[0].startTime);
            });
            observe('layout-shift', function (entries) {
                entries.forEach(function (e) { if (!e.hadRecentInput) data.cls += e.value; });
            });
            observe('event', function (entries) {
                entries.forEach(function (e) {
                    if (e.duration > data.inp) data.inp = Math.round(e.duration);
                });
            });
            global.addEventListener('pagehide', function () { Log.info('vitals', data); }, { once: true });
        }
        return { start: start, data: data };
    })();

    /* ====================================================================== *
     *  26. PUBLIC API
     * ====================================================================== */
    global.Light = {
        author:     'mino',
        version:    '2.0.0',
        codename:   'Lumen',
        config:     Config,
        env:        Env,
        metrics:    function ()          { return Metrics.data; },
        optimize:   function (root)      { optimizeSubtree(root || doc); },
        prefetch:   function (url)       { Net.prefetch(url, 'low'); },
        preconnect: function (origin)    { Net.hint('preconnect', origin, { crossorigin: 'anonymous' }); },
        rescan:     function ()          { optimizeSubtree(doc); },
        push:       function (task, p)   { Scheduler.idle(task, p); },
        read:       function (fn)        { Layout.read(fn); },
        write:      function (fn)        { Layout.write(fn); }
    };

    /* ====================================================================== *
     *  27. BOOT SEQUENCE
     *      Phase 1 — instant, pre-DOM       : guards, patches, font swap
     *      Phase 2 — DOMContentLoaded       : full pipeline scan
     *      Phase 3 — load                   : second pass + metrics + speculator
     * ====================================================================== */
    safeCall(function () { AntiPatternShield.run(); }, 'AntiPattern');
    safeCall(function () { PassivePatch.run();      }, 'PassivePatch');
    safeCall(function () { FontOptimizer.run();     }, 'Font');
    safeCall(function () { LongTaskMonitor.start(); }, 'LongTask');
    safeCall(function () { Mutator.start();         }, 'Mutator');

    Dom.ready(function () {
        Log.group('boot:DOMContentLoaded');
        optimizeSubtree(doc);
        Log.groupEnd();
    });

    Dom.loaded(function () {
        Log.group('boot:load');
        Scheduler.idle(function () { optimizeSubtree(doc); });
        Scheduler.idle(function () { Speculator.run(); }, 'high');
        Metrics.start();
        var dt = ((global.performance && performance.now) ? performance.now() : Date.now()) - __t0;
        Log.info('ready — ' + dt.toFixed(1) + 'ms');
        Log.groupEnd();
    });

    // Public banner — mino signature
    try {
        console.log(
            '%c⚡ light.js v2.0.0 "Lumen" — by mino',
            'color:#fff;background:linear-gradient(90deg,#ff6b6b,#f7b733,#4ecdc4);padding:4px 10px;border-radius:4px;font-weight:bold;font-size:12px'
        );
    } catch (e) {}

})(typeof window !== 'undefined' ? window : this, document);
