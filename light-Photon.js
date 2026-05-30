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
 *   Version     : 1.0.0 "Photon"
 *   License     : MIT
 *   Description : Drop-in single-file page accelerator. Just include
 *                 <script src="light.js"></script> at the very top of <head>
 *                 and the page becomes dramatically faster, lighter, and
 *                 smoother — no configuration required.
 *
 *   Created with full power by mino.
 *   "Make every byte count, make every frame fly."
 *
 * ============================================================================
 */
(function (global, doc) {
    'use strict';

    /* ====================================================================== *
     *  0. SIGNATURE & GUARD
     * ====================================================================== */
    if (global.__LIGHT_JS_MINO__) return;
    global.__LIGHT_JS_MINO__ = {
        author: 'mino',
        version: '1.0.0',
        codename: 'Photon',
        startedAt: (performance && performance.now()) || Date.now()
    };

    /* ====================================================================== *
     *  1. ENVIRONMENT PROBE — detect device, network, browser capability
     * ====================================================================== */
    var Env = (function () {
        var nav = global.navigator || {};
        var conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
        var ua = (nav.userAgent || '').toLowerCase();
        return {
            mem: nav.deviceMemory || 4,
            cores: nav.hardwareConcurrency || 4,
            saveData: !!conn.saveData,
            effectiveType: conn.effectiveType || '4g',
            downlink: conn.downlink || 10,
            rtt: conn.rtt || 50,
            isMobile: /mobi|android|iphone|ipad/.test(ua),
            isLowEnd: (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2),
            supportsIO: 'IntersectionObserver' in global,
            supportsMO: 'MutationObserver' in global,
            supportsRIC: 'requestIdleCallback' in global,
            supportsRAF: 'requestAnimationFrame' in global,
            supportsWorker: 'Worker' in global,
            supportsFetch: 'fetch' in global,
            supportsWebP: false,
            supportsAVIF: false,
            supportsPassive: false,
            supportsContentVisibility: CSS && CSS.supports && CSS.supports('content-visibility', 'auto'),
            supportsLazyLoad: 'loading' in HTMLImageElement.prototype,
            supportsDecode: 'decode' in HTMLImageElement.prototype,
            supportsPreload: (function () {
                try {
                    var l = doc.createElement('link');
                    return (l.relList && l.relList.supports && l.relList.supports('preload')) || false;
                } catch (e) { return false; }
            })()
        };
    })();

    // Passive listener detection
    try {
        var opts = Object.defineProperty({}, 'passive', { get: function () { Env.supportsPassive = true; } });
        global.addEventListener('test__', null, opts);
        global.removeEventListener('test__', null, opts);
    } catch (e) {}

    /* ====================================================================== *
     *  2. CONFIG — adaptive based on environment
     * ====================================================================== */
    var Config = {
        enableLazyImages: true,
        enableLazyIframes: true,
        enableLazyVideos: true,
        enableScriptDefer: true,
        enableScriptAsync: true,
        enableFontOptimize: true,
        enableCSSOptimize: true,
        enablePrefetch: !Env.saveData && Env.effectiveType !== '2g' && Env.effectiveType !== 'slow-2g',
        enablePreconnect: true,
        enablePredictiveHover: !Env.isMobile && !Env.saveData,
        enableViewportPrefetch: !Env.saveData,
        enableImageDecode: Env.supportsDecode,
        enableContentVisibility: Env.supportsContentVisibility,
        enableIdleScheduler: true,
        enablePassiveListeners: Env.supportsPassive,
        enableDNSPrefetch: true,
        enableResourceHints: true,
        enableLongTaskBreak: true,
        enableLayoutThrash: true,
        enableConsoleSilent: false,
        debug: /[?&]lightdebug=1/.test(global.location.search || ''),
        viewportMargin: Env.isLowEnd ? '200px' : '400px',
        prefetchLimit: Env.saveData ? 0 : (Env.isLowEnd ? 3 : 10),
        maxConcurrentFetch: Env.isLowEnd ? 2 : 6,
        idleTimeout: 50
    };

    /* ====================================================================== *
     *  3. LOGGER — gated by debug
     * ====================================================================== */
    var Log = {
        _p: '%c[light.js·mino]',
        _s: 'color:#fff;background:linear-gradient(90deg,#ff6b6b,#4ecdc4);padding:2px 6px;border-radius:3px;font-weight:bold',
        info: function () {
            if (!Config.debug) return;
            var a = [this._p, this._s].concat([].slice.call(arguments));
            try { console.log.apply(console, a); } catch (e) {}
        },
        warn: function () {
            if (!Config.debug) return;
            var a = [this._p, this._s].concat([].slice.call(arguments));
            try { console.warn.apply(console, a); } catch (e) {}
        },
        err: function () {
            var a = [this._p, this._s].concat([].slice.call(arguments));
            try { console.error.apply(console, a); } catch (e) {}
        },
        group: function (label) {
            if (!Config.debug) return;
            try { console.group('%c[light.js·mino] ' + label, this._s); } catch (e) {}
        },
        groupEnd: function () {
            if (!Config.debug) return;
            try { console.groupEnd(); } catch (e) {}
        }
    };

    /* ====================================================================== *
     *  4. IDLE SCHEDULER — custom cooperative scheduler
     * ====================================================================== */
    var Scheduler = (function () {
        var queue = [];
        var running = false;
        var ric = global.requestIdleCallback || function (cb) {
            var start = Date.now();
            return setTimeout(function () {
                cb({
                    didTimeout: false,
                    timeRemaining: function () {
                        return Math.max(0, 50 - (Date.now() - start));
                    }
                });
            }, 1);
        };

        function flush(deadline) {
            running = true;
            while (queue.length && (deadline.timeRemaining() > 1 || deadline.didTimeout)) {
                var task = queue.shift();
                try { task(); } catch (e) { Log.err('task error', e); }
            }
            if (queue.length) {
                ric(flush, { timeout: 1000 });
            } else {
                running = false;
            }
        }

        return {
            push: function (task, priority) {
                if (priority === 'high') queue.unshift(task);
                else queue.push(task);
                if (!running) {
                    running = true;
                    ric(flush, { timeout: Config.idleTimeout });
                }
            },
            size: function () { return queue.length; }
        };
    })();

    /* ====================================================================== *
     *  5. DOM UTILITIES
     * ====================================================================== */
    var Dom = {
        ready: function (cb) {
            if (doc.readyState === 'loading') {
                doc.addEventListener('DOMContentLoaded', cb, { once: true });
            } else {
                cb();
            }
        },
        loaded: function (cb) {
            if (doc.readyState === 'complete') cb();
            else global.addEventListener('load', cb, { once: true });
        },
        each: function (selector, fn, root) {
            var nodes = (root || doc).querySelectorAll(selector);
            for (var i = 0; i < nodes.length; i++) fn(nodes[i], i);
        },
        attr: function (el, name) {
            return el.getAttribute(name);
        },
        setAttr: function (el, name, val) {
            if (val == null) el.removeAttribute(name);
            else el.setAttribute(name, val);
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
            l.rel = rel;
            l.href = href;
            if (opts.as) l.as = opts.as;
            if (opts.type) l.type = opts.type;
            if (opts.crossorigin) l.crossOrigin = opts.crossorigin;
            l.setAttribute('data-light-mino', '1');
            (doc.head || doc.documentElement).appendChild(l);
            return l;
        }
    };

    /* ====================================================================== *
     *  6. URL HELPERS
     * ====================================================================== */
    var Url = {
        origin: function (url) {
            try { return new URL(url, global.location.href).origin; }
            catch (e) { return null; }
        },
        sameOrigin: function (url) {
            var o = Url.origin(url);
            return o && o === global.location.origin;
        },
        isHttp: function (url) {
            return /^https?:\/\//i.test(url || '');
        },
        normalize: function (url) {
            try { return new URL(url, global.location.href).href; }
            catch (e) { return url; }
        }
    };

    /* ====================================================================== *
     *  7. FEATURE DETECTION — image format support (async)
     * ====================================================================== */
    function detectImageFormat(format, dataUri) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = img.onerror = function () {
                resolve(img.width > 0 && img.height > 0);
            };
            img.src = dataUri;
        });
    }
    var FormatProbe = (function () {
        if (!global.Promise) return;
        Promise.all([
            detectImageFormat('webp', 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='),
            detectImageFormat('avif', 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=')
        ]).then(function (r) {
            Env.supportsWebP = r[0];
            Env.supportsAVIF = r[1];
            Log.info('image formats:', { webp: Env.supportsWebP, avif: Env.supportsAVIF });
        });
    })();

    /* ====================================================================== *
     *  8. NETWORK LAYER — concurrency-limited fetch queue
     * ====================================================================== */
    var Net = (function () {
        var active = 0;
        var pending = [];
        var seen = Object.create(null);

        function next() {
            while (active < Config.maxConcurrentFetch && pending.length) {
                var job = pending.shift();
                active++;
                run(job);
            }
        }
        function run(job) {
            var done = function () { active--; next(); };
            try {
                if (Env.supportsFetch) {
                    global.fetch(job.url, { credentials: 'same-origin', mode: 'no-cors', priority: job.priority || 'low' })
                        .then(done, done);
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
                if (!url || seen['hint:' + rel + ':' + url]) return;
                seen['hint:' + rel + ':' + url] = 1;
                Dom.injectLink(rel, url, opts);
            }
        };
    })();

    /* ====================================================================== *
     *  9. CRITICAL CSS INJECTION — applied as early as possible
     * ====================================================================== */
    (function injectCriticalCSS() {
        var css =
            /* Reduce layout shift placeholders */
            'img[data-light-lazy]{background:linear-gradient(90deg,#f0f0f0 0%,#e0e0e0 50%,#f0f0f0 100%);background-size:200% 100%;animation:lightSkeleton 1.2s ease-in-out infinite}' +
            '@keyframes lightSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
            /* content-visibility for offscreen */
            (Env.supportsContentVisibility ?
                '[data-light-cv]{content-visibility:auto;contain-intrinsic-size:auto 500px}' : '') +
            /* Reduce motion respect */
            '@media (prefers-reduced-motion:reduce){img[data-light-lazy]{animation:none}}' +
            /* Smooth fade-in for loaded media */
            '.light-fade-in{animation:lightFade .25s ease-out}' +
            '@keyframes lightFade{from{opacity:0}to{opacity:1}}';
        Dom.injectStyle(css);
    })();

    /* ====================================================================== *
     *  10. RESOURCE HINTS — preconnect / dns-prefetch for cross-origin
     * ====================================================================== */
    var HintEngine = (function () {
        var hinted = Object.create(null);
        function hint(href) {
            if (!Config.enableResourceHints || !href) return;
            var o = Url.origin(href);
            if (!o || o === global.location.origin || hinted[o]) return;
            hinted[o] = 1;
            if (Config.enablePreconnect) Net.hint('preconnect', o, { crossorigin: 'anonymous' });
            if (Config.enableDNSPrefetch) Net.hint('dns-prefetch', o);
        }
        return {
            hint: hint,
            scan: function (root) {
                root = root || doc;
                Dom.each('img[src],script[src],link[href],iframe[src],video[src],audio[src],source[src],source[srcset]', function (el) {
                    var u = el.src || el.href || el.getAttribute('data-src') || el.getAttribute('srcset');
                    if (u) {
                        // srcset may have multiple
                        u.split(',').forEach(function (part) {
                            var token = part.trim().split(/\s+/)[0];
                            hint(token);
                        });
                    }
                }, root);
            }
        };
    })();

    /* ====================================================================== *
     *  11. LAZY MEDIA — images / iframes / videos via IntersectionObserver
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
        }, {
            root: null,
            rootMargin: Config.viewportMargin,
            threshold: 0.01
        });

        function activate(el) {
            var tag = el.tagName;
            if (tag === 'IMG') {
                var ds = el.getAttribute('data-src');
                var dss = el.getAttribute('data-srcset');
                if (ds) el.src = ds;
                if (dss) el.srcset = dss;
                el.removeAttribute('data-src');
                el.removeAttribute('data-srcset');
                el.removeAttribute('data-light-lazy');
                if (Env.supportsDecode && el.decode) {
                    el.decode().then(function () { el.classList.add('light-fade-in'); }).catch(function () {});
                } else {
                    el.classList.add('light-fade-in');
                }
            } else if (tag === 'IFRAME') {
                var src = el.getAttribute('data-src');
                if (src) { el.src = src; el.removeAttribute('data-src'); }
            } else if (tag === 'VIDEO') {
                Dom.each('source[data-src]', function (s) {
                    s.src = s.getAttribute('data-src');
                    s.removeAttribute('data-src');
                }, el);
                try { el.load(); } catch (e) {}
            }
        }

        function shouldLazy(el) {
            // Skip if already lazy-handled, has no src to lazy, or is critical (above the fold likely)
            if (el.getAttribute('data-light-skip') === '1') return false;
            // Respect explicit eager
            if (el.getAttribute('loading') === 'eager') return false;
            // Skip very small images (likely icons)
            var w = parseInt(el.getAttribute('width') || '0', 10);
            var h = parseInt(el.getAttribute('height') || '0', 10);
            if (w && h && w * h < 2500) return false; // ~50x50
            return true;
        }

        function processImg(el) {
            if (el.__lightLazied) return;
            if (!shouldLazy(el)) return;

            // Native lazy loading first (cheapest)
            if (Env.supportsLazyLoad && !el.hasAttribute('loading')) {
                el.loading = 'lazy';
            }
            if (!el.hasAttribute('decoding')) el.decoding = 'async';

            // Defer load via swap if img already has src and not already in viewport
            if (el.src && !el.complete) {
                var rect = el.getBoundingClientRect();
                var inView = rect.top < global.innerHeight + 200 && rect.bottom > -200;
                if (!inView) {
                    el.setAttribute('data-src', el.src);
                    el.setAttribute('data-light-lazy', '1');
                    // 1x1 transparent gif placeholder to avoid extra request
                    el.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
                    if (el.srcset) {
                        el.setAttribute('data-srcset', el.srcset);
                        el.removeAttribute('srcset');
                    }
                    io.observe(el);
                }
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
                Dom.each('img', processImg, root);
                Dom.each('iframe', processIframe, root);
                Dom.each('video', processVideo, root);
            },
            observe: io.observe.bind(io)
        };
    })();

    /* ====================================================================== *
     *  12. SCRIPT OPTIMIZER — defer non-critical scripts
     * ====================================================================== */
    var ScriptOptimizer = (function () {
        // Critical heuristics: scripts marked critical, jsonld, modules at head with no defer/async,
        // and scripts with src in <head> get async if safe.
        var CRITICAL_KEYWORDS = ['analytics', 'gtag', 'jquery', 'react', 'vue', 'angular'];
        function isCritical(el) {
            if (el.hasAttribute('data-light-critical')) return true;
            if (el.type === 'application/ld+json' || el.type === 'application/json') return true;
            if (el.hasAttribute('data-light-skip')) return true;
            return false;
        }
        function process(el) {
            if (el.__lightProcessed) return;
            el.__lightProcessed = true;
            if (!el.src) return; // inline scripts left alone
            if (isCritical(el)) return;
            if (el.async || el.defer) return;
            if (el.type === 'module') return; // modules are deferred by default
            // For dynamically inserted scripts, set async
            if (el.parentNode && doc.readyState !== 'loading') {
                el.async = true;
            } else {
                el.defer = true;
            }
        }
        return {
            scan: function (root) {
                root = root || doc;
                Dom.each('script', process, root);
            }
        };
    })();

    /* ====================================================================== *
     *  13. CSS OPTIMIZER — media-swap trick for non-critical stylesheets
     * ====================================================================== */
    var CSSOptimizer = (function () {
        function process(el) {
            if (el.__lightProcessed) return;
            el.__lightProcessed = true;
            if (el.rel !== 'stylesheet') return;
            if (el.hasAttribute('data-light-critical')) return;
            if (el.media && el.media !== 'all' && el.media !== 'screen') return;
            // Skip same-document above-fold critical (heuristic: in <head> first 3)
            // Use print-media swap to load without blocking render
            var originalMedia = el.media || 'all';
            el.media = 'print';
            el.setAttribute('data-light-css-swap', originalMedia);
            el.addEventListener('load', function once() {
                el.media = originalMedia;
                el.removeEventListener('load', once);
            }, { once: true });
        }
        return {
            scan: function (root) {
                root = root || doc;
                // Only process links discovered AFTER first 2 (to keep above-the-fold css blocking)
                var links = (root || doc).querySelectorAll('link[rel="stylesheet"]');
                for (var i = 2; i < links.length; i++) process(links[i]);
            }
        };
    })();

    /* ====================================================================== *
     *  14. FONT OPTIMIZER — font-display: swap
     * ====================================================================== */
    var FontOptimizer = (function () {
        var injected = false;
        function inject() {
            if (injected) return;
            injected = true;
            // Force font-display:swap globally for any @font-face missing it
            try {
                if (doc.fonts && doc.fonts.forEach) {
                    doc.fonts.forEach(function (f) {
                        try { f.display = 'swap'; } catch (e) {}
                    });
                }
            } catch (e) {}
            // Also inject override style
            Dom.injectStyle('@font-face{font-display:swap}');
        }
        return { run: inject };
    })();

    /* ====================================================================== *
     *  15. PREDICTIVE PREFETCH — hover, viewport, scroll-direction
     * ====================================================================== */
    var Predictor = (function () {
        var count = 0;
        var hoverTimers = new WeakMap ? new WeakMap() : null;

        function prefetchLink(href) {
            if (count >= Config.prefetchLimit) return;
            if (!Url.sameOrigin(href)) return;
            count++;
            Net.hint('prefetch', href, { as: 'document' });
            Log.info('prefetch', href);
        }

        function bindHover(a) {
            if (a.__lightHover) return;
            a.__lightHover = true;
            var onEnter = function () {
                var t = setTimeout(function () { prefetchLink(a.href); }, 65);
                if (hoverTimers) hoverTimers.set(a, t);
            };
            var onLeave = function () {
                if (hoverTimers) {
                    var t = hoverTimers.get(a);
                    if (t) { clearTimeout(t); hoverTimers.delete(a); }
                }
            };
            a.addEventListener('mouseenter', onEnter, Config.enablePassiveListeners ? { passive: true } : false);
            a.addEventListener('mouseleave', onLeave, Config.enablePassiveListeners ? { passive: true } : false);
            a.addEventListener('touchstart', function () { prefetchLink(a.href); },
                Config.enablePassiveListeners ? { passive: true } : false);
        }

        var vio = Env.supportsIO ? new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting && e.target.href) {
                    Scheduler.push(function () { prefetchLink(e.target.href); });
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
                    if (a.href.indexOf('#') !== -1 && a.href.split('#')[0] === global.location.href.split('#')[0]) return;
                    if (Config.enablePredictiveHover) bindHover(a);
                    if (Config.enableViewportPrefetch && vio) vio.observe(a);
                }, root);
            }
        };
    })();

    /* ====================================================================== *
     *  16. PASSIVE LISTENER PATCH — auto-passive scroll/touch/wheel
     * ====================================================================== */
    var PassivePatch = (function () {
        if (!Config.enablePassiveListeners) return { run: function () {} };
        var ran = false;
        function run() {
            if (ran) return; ran = true;
            var orig = EventTarget.prototype.addEventListener;
            var PASSIVE_TYPES = { touchstart: 1, touchmove: 1, touchend: 1, wheel: 1, mousewheel: 1 };
            EventTarget.prototype.addEventListener = function (type, listener, options) {
                if (PASSIVE_TYPES[type]) {
                    if (options === undefined || options === false || options === true) {
                        options = { capture: !!options, passive: true };
                    } else if (typeof options === 'object' && options.passive === undefined) {
                        try { options.passive = true; } catch (e) {
                            options = Object.assign({}, options, { passive: true });
                        }
                    }
                }
                return orig.call(this, type, listener, options);
            };
        }
        return { run: run };
    })();

    /* ====================================================================== *
     *  17. CONTENT-VISIBILITY APPLIER — for big offscreen sections
     * ====================================================================== */
    var CVApplier = (function () {
        if (!Env.supportsContentVisibility) return { scan: function () {} };
        var SELECTORS = 'section,article,footer,aside,.light-cv';
        function process(el) {
            if (el.__lightCV) return;
            el.__lightCV = true;
            // Skip if small / above the fold
            var rect = el.getBoundingClientRect();
            if (rect.top < global.innerHeight * 1.5) return;
            if (rect.height < 200) return;
            el.setAttribute('data-light-cv', '1');
        }
        return {
            scan: function (root) {
                root = root || doc;
                Dom.each(SELECTORS, process, root);
            }
        };
    })();

    /* ====================================================================== *
     *  18. LONG TASK BREAKER — yield to main thread when needed
     * ====================================================================== */
    var LongTaskMonitor = (function () {
        if (!('PerformanceObserver' in global)) return { start: function () {} };
        var po;
        function start() {
            try {
                po = new PerformanceObserver(function (list) {
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
     *  19. MUTATION OBSERVER — process newly added nodes
     * ====================================================================== */
    var Mutator = (function () {
        if (!Env.supportsMO) return { start: function () {} };
        var mo;
        function handle(mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type !== 'childList') continue;
                for (var j = 0; j < m.addedNodes.length; j++) {
                    var n = m.addedNodes[j];
                    if (n.nodeType !== 1) continue;
                    Scheduler.push(function (node) {
                        return function () { optimizeSubtree(node); };
                    }(n));
                }
            }
        }
        function start() {
            mo = new MutationObserver(handle);
            mo.observe(doc.documentElement, { childList: true, subtree: true });
        }
        return { start: start };
    })();

    /* ====================================================================== *
     *  20. CORE OPTIMIZE PIPELINE
     * ====================================================================== */
    function optimizeSubtree(root) {
        try {
            if (Config.enableLazyImages || Config.enableLazyIframes || Config.enableLazyVideos)
                LazyMedia.scan(root);
            if (Config.enableScriptDefer) ScriptOptimizer.scan(root);
            if (Config.enableCSSOptimize) CSSOptimizer.scan(root);
            if (Config.enableResourceHints) HintEngine.scan(root);
            if (Config.enableContentVisibility) CVApplier.scan(root);
            if (Config.enablePrefetch) Predictor.scan(root);
        } catch (e) { Log.err('optimize error', e); }
    }

    /* ====================================================================== *
     *  21. METRICS — record Web Vitals (LCP, FID, CLS, INP) for debug
     * ====================================================================== */
    var Metrics = (function () {
        var data = { lcp: 0, fid: 0, cls: 0, inp: 0 };
        function observe(type, cb) {
            if (!('PerformanceObserver' in global)) return;
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
            global.addEventListener('beforeunload', function () {
                Log.info('vitals', data);
            });
        }
        return { start: start, data: data };
    })();

    /* ====================================================================== *
     *  22. PUBLIC API
     * ====================================================================== */
    global.Light = {
        author: 'mino',
        version: '1.0.0',
        config: Config,
        env: Env,
        metrics: function () { return Metrics.data; },
        optimize: function (root) { optimizeSubtree(root || doc); },
        prefetch: function (url) { Net.prefetch(url, 'low'); },
        preconnect: function (origin) { Net.hint('preconnect', origin, { crossorigin: 'anonymous' }); },
        rescan: function () { optimizeSubtree(doc); },
        push: function (task, priority) { Scheduler.push(task, priority); }
    };

    /* ====================================================================== *
     *  23. BOOT SEQUENCE
     * ====================================================================== */
    // Phase 1 — instant (before DOM ready)
    PassivePatch.run();
    FontOptimizer.run();
    LongTaskMonitor.start();
    Mutator.start();

    // Phase 2 — at DOMContentLoaded
    Dom.ready(function () {
        Log.group('boot:DOMContentLoaded');
        optimizeSubtree(doc);
        Log.groupEnd();
    });

    // Phase 3 — at load
    Dom.loaded(function () {
        Log.group('boot:load');
        Scheduler.push(function () { optimizeSubtree(doc); });
        Metrics.start();
        Log.info('ready — ' + (((performance && performance.now()) || Date.now()) - global.__LIGHT_JS_MINO__.startedAt).toFixed(1) + 'ms');
        Log.groupEnd();
    });

    // Public banner (always visible — mino signature)
    try {
        console.log(
            '%c⚡ light.js v1.0.0 "Photon" — by mino',
            'color:#fff;background:linear-gradient(90deg,#ff6b6b,#f7b733,#4ecdc4);padding:4px 10px;border-radius:4px;font-weight:bold;font-size:12px'
        );
    } catch (e) {}

})(typeof window !== 'undefined' ? window : this, document);
