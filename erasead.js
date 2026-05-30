/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                                                                          ║
 * ║                        E R A S E A D . J S                               ║
 * ║                                                                          ║
 * ║              The Ultimate Universal Ad Annihilator                       ║
 * ║              ─────────────────────────────────────                       ║
 * ║                                                                          ║
 * ║              ✦  Author  : Mino                                           ║
 * ║              ✦  Version : 3.0.0 "Singularity"                            ║
 * ║              ✦  License : MIT (Free for All Humanity)                    ║
 * ║              ✦  Motto   : "No Ad Shall Pass. No Layout Shall Break."     ║
 * ║                                                                          ║
 * ║   Inspired by — and engineered to surpass — AdGuard, uBlock Origin,      ║
 * ║   Brave Shields, Pi-hole, and every ad-blocker that came before.         ║
 * ║                                                                          ║
 * ║   Drop-in usage:                                                         ║
 * ║       <script src="erasead.js"></script>   ← place FIRST in <head>       ║
 * ║                                                                          ║
 * ║   Zero dependencies. Zero config. Pure annihilation.                     ║
 * ║                                                                          ║
 * ║                              ── Made by Mino ──                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

(function EraseAdSingularity(globalScope) {
    'use strict';

    /* ════════════════════════════════════════════════════════════════════════
     *  0. SAFETY GUARD - 多重実行防止 & 環境検証
     * ════════════════════════════════════════════════════════════════════════ */
    if (globalScope.__ERASEAD_MINO_LOADED__) return;
    Object.defineProperty(globalScope, '__ERASEAD_MINO_LOADED__', {
        value: true, writable: false, configurable: false, enumerable: false
    });

    const SIGNATURE = '[EraseAd by Mino]';
    const VERSION   = '3.0.0';
    const SILENT    = true;   // true → ログ非表示 / false → デバッグログ表示
    const log = (...a) => { if (!SILENT) try { console.log(SIGNATURE, ...a); } catch(_){} };
    const warn= (...a) => { if (!SILENT) try { console.warn(SIGNATURE, ...a); } catch(_){} };

    log('Booting v' + VERSION + ' — Singularity Engine engaged.');

    /* ════════════════════════════════════════════════════════════════════════
     *  1. FILTER DATABASE - 広告ドメイン・パス・キーワードの巨大辞書
     * ════════════════════════════════════════════════════════════════════════ */
    const AD_HOST_PATTERNS = [
        // ── Google ad / tracking family
        'doubleclick.net','googlesyndication.com','googleadservices.com',
        'googletagservices.com','googletagmanager.com','google-analytics.com',
        'adservice.google.','partner.googleadservices.com','pagead2.googlesyndication.com',
        'tpc.googlesyndication.com','imasdk.googleapis.com','adsense.google.com',
        // ── Meta / Facebook
        'connect.facebook.net','facebook.com/tr','fbcdn.net/ads','an.facebook.com',
        // ── Amazon ad
        'amazon-adsystem.com','adsystem.amazon.','aax.amazon-adsystem.com',
        // ── Microsoft / Bing
        'bat.bing.com','ads.microsoft.com','clarity.ms',
        // ── Yahoo / Verizon
        'ads.yahoo.com','adserver.yahoo.com','analytics.yahoo.com','yads.yahoo.co.jp',
        'yimg.jp/images/listing','yads.c.yimg.jp',
        // ── Twitter / X
        'ads-twitter.com','analytics.twitter.com','static.ads-twitter.com',
        // ── TikTok / ByteDance
        'analytics.tiktok.com','ads.tiktok.com','business-api.tiktok.com',
        // ── ad-tech SSP/DSP/exchange
        'criteo.com','criteo.net','adnxs.com','rubiconproject.com','pubmatic.com',
        'openx.net','adform.net','taboola.com','outbrain.com','revcontent.com',
        'mgid.com','adroll.com','adcolony.com','adsrvr.org','adsafeprotected.com',
        'moatads.com','scorecardresearch.com','quantserve.com','quantcount.com',
        'chartbeat.com','newrelic.com/browser','segment.io','mixpanel.com',
        'hotjar.com','crazyegg.com','optimizely.com','mouseflow.com','fullstory.com',
        'amplitude.com','heap.io','kissmetrics.com','clicktale.net',
        // ── Japanese ad networks
        'i-mobile.co.jp','microad.jp','microad.net','fout.jp','fluct.jp','geniee.co.jp',
        'logly.co.jp','popin.cc','smartnews-ads.com','adfully.jp','adingo.jp',
        'pinpoint-jp.com','impact-ad.jp','imobile.co.jp','rakuten-ad.com',
        'cyberagent.co.jp/ad','adstir.com','nend.net','medibaad.com',
        // ── pop / mining / shady
        'popads.net','popcash.net','propellerads.com','adcash.com','exoclick.com',
        'juicyads.com','trafficjunky.net','plugrush.com','coinhive.com','crypto-loot.com',
        'jsecoin.com','coin-have.com','mineralt.io','coinimp.com','webmine.cz',
        // ── misc trackers
        'branch.io','appsflyer.com','adjust.com','kochava.com','tapad.com',
        'demdex.net','everesttech.net','omtrdc.net','sitestat.com','sitemeter.com',
        'addthis.com','sharethis.com','disqus.com/embed','intercom.io','drift.com',
        'zendesk.com/embeddable','tealium.com','tealiumiq.com','tiqcdn.com',
        // ── video ad SDK
        'innovid.com','spotxchange.com','spotx.tv','smartadserver.com','freewheel.tv',
        'tremorhub.com','vidible.tv','sundaysky.com',
        // ── header bidding
        'prebid.org','prebid-server','aps.amazon-adsystem.com','indexww.com',
        'casalemedia.com','sovrn.com','contextweb.com','gumgum.com','sharethrough.com',
        // ── generic patterns
        'ads.','/ads/','/ad/','/advert','/adserver','/adsystem','/adservice','/adframe',
        '/banner','/sponsor','/promoted','/affiliate','/tracking','/telemetry','/beacon',
        '/pixel','/analytic','/metrics','/collect?','/log?','/stat?'
    ];

    const AD_KEYWORD_PATTERNS = [
        // class / id / attribute kewords
        'advertis','ad-banner','ad-container','ad-wrapper','ad-slot','ad-unit','ad-block',
        'adsbox','adsbygoogle','ad-placeholder','ad-content','ad-frame','ad-zone','ad-region',
        'sponsored','sponsor-','promoted','promo-banner','banner-ad','top-ad','side-ad',
        'sidebar-ad','footer-ad','header-ad','inline-ad','sticky-ad','floating-ad',
        'overlay-ad','popup-ad','interstitial','native-ad','recommend-ad','outbrain','taboola',
        'gpt-ad','dfp-ad','google_ads','googlead','doubleclick','prebid','pubads',
        'criteo','adsense','adnxs','ad-iframe','ad-script','ad-image','ad-video',
        '広告','スポンサー','プロモーション','ＰＲ','ピーアール'
    ];

    const ALLOW_HOSTS = [
        // 自ホスト誤検知防止（必要に応じてユーザーが拡張可）
    ];

    /* 高速判定用キャッシュ */
    const _hostRegex = new RegExp(
        AD_HOST_PATTERNS.map(s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),
        'i'
    );
    const _keywordRegex = new RegExp(
        AD_KEYWORD_PATTERNS.map(s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),
        'i'
    );
    const isAdUrl = (url) => {
        if (!url || typeof url !== 'string') return false;
        if (ALLOW_HOSTS.some(h => url.includes(h))) return false;
        return _hostRegex.test(url);
    };
    const isAdToken = (str) => str && _keywordRegex.test(String(str));

    /* ════════════════════════════════════════════════════════════════════════
     *  2. CSS COSMETIC FILTER - 即時注入で広告枠を不可視化（レイアウト保持）
     * ════════════════════════════════════════════════════════════════════════ */
    const COSMETIC_SELECTORS = [
        'iframe[src*="doubleclick"]','iframe[src*="googlesyndication"]',
        'iframe[src*="googleadservices"]','iframe[src*="adservice"]',
        'iframe[src*="amazon-adsystem"]','iframe[src*="criteo"]','iframe[src*="adnxs"]',
        'iframe[src*="taboola"]','iframe[src*="outbrain"]','iframe[src*="pubmatic"]',
        'iframe[src*="rubiconproject"]','iframe[src*="openx"]','iframe[src*="adform"]',
        'iframe[id*="google_ads"]','iframe[id^="aswift_"]','iframe[id^="ad_iframe"]',
        'iframe[name^="google_ads"]','iframe[name^="aswift_"]',
        'ins.adsbygoogle','ins[class*="adsbygoogle"]','div[id^="div-gpt-ad"]',
        'div[id^="google_ads_"]','div[id^="ad-"]','div[id$="-ad"]','div[id*="-ads-"]',
        'div[class^="ad-"]','div[class$="-ad"]','div[class*=" ad-"]','div[class*="-ads "]',
        'div[class*="advert"]','div[class*="Advert"]','div[class*="sponsor"]',
        'div[class*="Sponsor"]','div[class*="promoted"]','div[class*="Promoted"]',
        'div[data-ad]','div[data-ad-client]','div[data-ad-slot]','div[data-ad-unit]',
        'div[data-google-query-id]','div[data-adunit]','div[data-ad-format]',
        'aside[class*="ad-"]','aside[class*="advert"]','aside[class*="sponsor"]',
        'section[class*="ad-"]','section[class*="advert"]','section[class*="sponsor"]',
        'a[href*="doubleclick.net"]','a[href*="googleadservices"]','a[href*="adservice"]',
        'a[onmousedown*="googleadservices"]','a[ping*="doubleclick"]',
        '[id*="taboola"]','[id*="outbrain"]','[class*="taboola"]','[class*="outbrain"]',
        '[class*="trc_related"]','[class*="OUTBRAIN"]',
        // sticky / overlay
        '[class*="sticky-ad"]','[class*="floating-ad"]','[class*="overlay-ad"]',
        '[class*="interstitial"]','[class*="popup-ad"]','[class*="modal-ad"]',
        // 日本語サイト
        '[class*="広告"]','[id*="広告"]','[class*="ＰＲ"]','[id*="ＰＲ"]'
    ];

    function injectCosmeticCSS() {
        const css = `
            ${COSMETIC_SELECTORS.join(',\n')} {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                width: 0 !important;
                height: 0 !important;
                min-width: 0 !important;
                min-height: 0 !important;
                max-width: 0 !important;
                max-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -99999px !important;
                top: -99999px !important;
                z-index: -2147483648 !important;
            }
            /* 「広告ブロック検知」用おとり要素：見えるけど画面外 */
            .adsbox, .ad-placement, #ad-banner-decoy {
                display: block !important;
                width: 1px !important;
                height: 1px !important;
                position: absolute !important;
                left: -10000px !important;
                opacity: 0.01 !important;
            }
            /* スクロール抑止解除（ポップアップ広告がbodyロックする対策） */
            html.ad-blocked, body.ad-blocked,
            html[style*="overflow: hidden"][data-ad-locked],
            body[style*="overflow: hidden"][data-ad-locked] {
                overflow: auto !important;
                position: static !important;
            }
        `;
        try {
            const style = document.createElement('style');
            style.id = 'erasead-mino-cosmetic';
            style.type = 'text/css';
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
            log('Cosmetic CSS injected (' + COSMETIC_SELECTORS.length + ' rules).');
        } catch(e) { warn('Cosmetic injection failed:', e); }
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  3. NETWORK INTERCEPTION - fetch / XHR / WebSocket / sendBeacon
     * ════════════════════════════════════════════════════════════════════════ */
    function patchNetwork() {
        // --- fetch ---
        if (globalScope.fetch) {
            const _fetch = globalScope.fetch.bind(globalScope);
            globalScope.fetch = function(input, init) {
                try {
                    const url = (typeof input === 'string') ? input
                              : (input && input.url) ? input.url : '';
                    if (isAdUrl(url)) {
                        log('fetch blocked:', url);
                        return Promise.resolve(new Response('', {
                            status: 204, statusText: 'No Content (EraseAd)'
                        }));
                    }
                } catch(_) {}
                return _fetch(input, init);
            };
        }

        // --- XMLHttpRequest ---
        if (globalScope.XMLHttpRequest) {
            const XHR = globalScope.XMLHttpRequest.prototype;
            const _open = XHR.open;
            const _send = XHR.send;
            XHR.open = function(method, url) {
                this.__erasead_url = url;
                this.__erasead_block = isAdUrl(url);
                return _open.apply(this, arguments);
            };
            XHR.send = function(body) {
                if (this.__erasead_block) {
                    log('XHR blocked:', this.__erasead_url);
                    // ダミー完了状態にする
                    Object.defineProperty(this,'readyState',{value:4,configurable:true});
                    Object.defineProperty(this,'status',    {value:204,configurable:true});
                    Object.defineProperty(this,'response',  {value:'',configurable:true});
                    Object.defineProperty(this,'responseText',{value:'',configurable:true});
                    setTimeout(() => {
                        try { this.onreadystatechange && this.onreadystatechange(); } catch(_){}
                        try { this.onload && this.onload(); } catch(_){}
                    }, 0);
                    return;
                }
                return _send.apply(this, arguments);
            };
        }

        // --- WebSocket (広告系シグナリングをブロック) ---
        if (globalScope.WebSocket) {
            const _WS = globalScope.WebSocket;
            globalScope.WebSocket = new Proxy(_WS, {
                construct(target, args) {
                    const url = args[0] || '';
                    if (isAdUrl(url)) {
                        log('WebSocket blocked:', url);
                        // ダミーオブジェクトを返す
                        return {
                            url, readyState: 3, send(){}, close(){},
                            addEventListener(){}, removeEventListener(){},
                            onopen:null,onmessage:null,onerror:null,onclose:null
                        };
                    }
                    return new target(...args);
                }
            });
        }

        // --- sendBeacon (Analytics の最終手段) ---
        if (globalScope.navigator && navigator.sendBeacon) {
            const _beacon = navigator.sendBeacon.bind(navigator);
            navigator.sendBeacon = function(url, data) {
                if (isAdUrl(url)) {
                    log('Beacon blocked:', url);
                    return true; // 成功と偽装
                }
                return _beacon(url, data);
            };
        }

        log('Network interceptors armed.');
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  4. DOM SANITIZER - 既存ノード & MutationObserver で動的広告を即削除
     * ════════════════════════════════════════════════════════════════════════ */
    function nodeLooksLikeAd(node) {
        if (!node || node.nodeType !== 1) return false;
        try {
            // タグ別チェック
            const tag = node.tagName;
            if (tag === 'IFRAME' || tag === 'EMBED' || tag === 'OBJECT') {
                const src = node.src || node.getAttribute('src') || '';
                if (isAdUrl(src)) return true;
            }
            if (tag === 'SCRIPT') {
                const src = node.src || '';
                if (isAdUrl(src)) return true;
                const code = node.textContent || '';
                if (code.length < 50000 && isAdToken(code) && /\b(adsbygoogle|googletag|pbjs|criteo|outbrain|taboola)\b/i.test(code)) return true;
            }
            if (tag === 'IMG') {
                const src = node.src || '';
                if (isAdUrl(src)) return true;
            }
            if (tag === 'LINK') {
                const href = node.href || '';
                if (isAdUrl(href)) return true;
            }
            if (tag === 'INS' && /adsbygoogle/i.test(node.className || '')) return true;

            // 属性チェック
            const id = node.id || '';
            const cls = (typeof node.className === 'string') ? node.className
                      : (node.className && node.className.baseVal) || '';
            if (isAdToken(id) || isAdToken(cls)) return true;

            // data-* 属性
            if (node.hasAttribute) {
                if (node.hasAttribute('data-ad') ||
                    node.hasAttribute('data-ad-client') ||
                    node.hasAttribute('data-ad-slot') ||
                    node.hasAttribute('data-google-query-id') ||
                    node.hasAttribute('data-adunit')) return true;
            }
        } catch(_) {}
        return false;
    }

    function neutralize(node) {
        try {
            // レイアウト崩壊を避けるため、削除ではなく「無音プレースホルダ化」
            const tag = node.tagName;
            if (tag === 'SCRIPT' || tag === 'LINK') {
                node.parentNode && node.parentNode.removeChild(node);
                return;
            }
            // ブロック要素は0サイズ非表示に
            node.setAttribute('data-erased-by-mino','1');
            const s = node.style;
            s.setProperty('display','none','important');
            s.setProperty('visibility','hidden','important');
            s.setProperty('width','0','important');
            s.setProperty('height','0','important');
            s.setProperty('opacity','0','important');
            s.setProperty('pointer-events','none','important');
            // 内容を空に
            try { node.innerHTML = ''; } catch(_){}
            try { if (node.src) node.src = 'about:blank'; } catch(_){}
        } catch(_) {}
    }

    function sweepRoot(root) {
        if (!root || !root.querySelectorAll) return;
        let removed = 0;
        // セレクタ一括スキャン
        try {
            const matches = root.querySelectorAll(COSMETIC_SELECTORS.join(','));
            matches.forEach(n => { neutralize(n); removed++; });
        } catch(_) {}
        // 個別タグスキャン（属性ベース）
        try {
            const all = root.querySelectorAll('iframe,script,ins,embed,object,img,link,div,aside,section');
            all.forEach(n => { if (nodeLooksLikeAd(n)) { neutralize(n); removed++; } });
        } catch(_) {}
        if (removed) log('Swept', removed, 'ad node(s).');
    }

    function startObserver() {
        const target = document.documentElement || document.body;
        if (!target) return;
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.type === 'childList') {
                    m.addedNodes && m.addedNodes.forEach(n => {
                        if (n.nodeType !== 1) return;
                        if (nodeLooksLikeAd(n)) { neutralize(n); return; }
                        // 子孫もスキャン
                        if (n.querySelectorAll) sweepRoot(n);
                    });
                } else if (m.type === 'attributes') {
                    if (nodeLooksLikeAd(m.target)) neutralize(m.target);
                }
            }
        });
        observer.observe(target, {
            childList: true, subtree: true,
            attributes: true, attributeFilter: ['src','href','class','id','data-ad','data-ad-client']
        });
        log('MutationObserver online.');
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  5. API NEUTRALIZATION - 広告SDKのグローバルAPIを無効化
     * ════════════════════════════════════════════════════════════════════════ */
    function neutralizeAdAPIs() {
        const noop  = function(){};
        const noopP = function(){ return Promise.resolve(); };
        const stubArray = (function(){ const a=[]; a.push=function(){return a.length;}; return a; })();

        const STUBS = {
            // Google
            adsbygoogle: stubArray,
            googletag:   { cmd: stubArray, pubads: ()=>({addEventListener:noop,refresh:noop,setTargeting:noop,enableSingleRequest:noop,collapseEmptyDivs:noop,disableInitialLoad:noop}),
                           enableServices: noop, defineSlot: ()=>({addService:noop,setTargeting:noop}),
                           display: noop, destroySlots: noop, sizeMapping: ()=>({addSize:function(){return this;},build:noop}) },
            // GA / GTM
            ga: noop, gtag: noop, dataLayer: stubArray, _gaq: stubArray,
            // Facebook
            fbq: noop, _fbq: noop,
            // Twitter
            twq: noop,
            // TikTok
            ttq: { track: noop, page: noop, identify: noop, instance: noop, load: noop },
            // Yandex
            ym: noop,
            // Adobe
            s_gi: noop, _satellite: { track: noop, getVisitorId: noop, pageBottom: noop },
            // Hotjar
            hj: noop, _hjSettings: {},
            // Mixpanel
            mixpanel: { init: noop, track: noop, identify: noop, people: { set: noop } },
            // Segment
            analytics: Object.assign([], { track: noop, page: noop, identify: noop, ready: noop, load: noop }),
            // Optimizely
            optimizely: stubArray,
            // Header bidding
            pbjs: { que: stubArray, cmd: stubArray, getHighestCpmBids: ()=>[], requestBids: noop, setConfig: noop, addAdUnits: noop },
            apstag: { init: noop, fetchBids: function(_,cb){ try{cb&&cb([]);}catch(_){} }, setDisplayBids: noop, targetingKeys: ()=>[] },
            // Criteo / Taboola / Outbrain
            Criteo: { events: stubArray, PassbackTag: noop, DisplayAd: noop },
            _taboola: stubArray,
            OBR: { extern: { researchWidget: noop, callRecs: noop } },
            // Mining
            CoinHive: { Anonymous: function(){ return {start:noop,stop:noop,on:noop}; }, User: function(){ return {start:noop,stop:noop,on:noop}; } },
            CryptoLoot: { Anonymous: function(){ return {start:noop,stop:noop}; } }
        };

        for (const key in STUBS) {
            try {
                Object.defineProperty(globalScope, key, {
                    value: STUBS[key],
                    writable: true,       // 後から書き換え試行が来てもエラーにしない
                    configurable: true
                });
            } catch(_) {
                try { globalScope[key] = STUBS[key]; } catch(_){}
            }
        }
        log('Ad SDK globals stubbed (' + Object.keys(STUBS).length + ').');
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  6. ANTI-ANTI-ADBLOCK - 「広告ブロッカー検出」を欺くおとり生成
     * ════════════════════════════════════════════════════════════════════════ */
    function deployDecoys() {
        try {
            const make = (tag, attrs) => {
                const el = document.createElement(tag);
                Object.assign(el, attrs);
                // 検知スクリプトは offsetHeight / clientHeight を見るので「存在するけど見えない」状態を作る
                el.style.cssText = 'position:absolute!important;left:-99999px!important;top:-99999px!important;width:1px!important;height:1px!important;opacity:0.001!important;';
                return el;
            };
            const decoys = [
                make('div', { id:'ad-banner', className:'adsbox ad-banner ad-placement ads ad' }),
                make('div', { id:'ads',       className:'adsbygoogle' }),
                make('ins', { className:'adsbygoogle adsbygoogle-noablate' })
            ];
            const attach = () => {
                if (!document.body) return setTimeout(attach, 50);
                decoys.forEach(d => { try { document.body.appendChild(d); } catch(_){} });
                // offsetHeight を偽装（>0 を返す）
                decoys.forEach(d => {
                    try {
                        Object.defineProperty(d,'offsetHeight',{get:()=>10,configurable:true});
                        Object.defineProperty(d,'offsetWidth' ,{get:()=>10,configurable:true});
                        Object.defineProperty(d,'clientHeight',{get:()=>10,configurable:true});
                        Object.defineProperty(d,'clientWidth' ,{get:()=>10,configurable:true});
                    } catch(_){}
                });
                log('Anti-adblock decoys deployed.');
            };
            attach();
        } catch(e) { warn('Decoy deploy failed:', e); }
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  7. POPUP / NEW-TAB SUPPRESSION
     * ════════════════════════════════════════════════════════════════════════ */
    function suppressPopups() {
        try {
            const _open = globalScope.open;
            globalScope.open = function(url) {
                if (!url || isAdUrl(url)) {
                    log('window.open blocked:', url);
                    return null;
                }
                // ユーザー操作起点かどうかを推定
                return _open.apply(this, arguments);
            };
            // beforeunload による離脱阻害を弱化
            globalScope.addEventListener('beforeunload', e => {
                try { e.stopImmediatePropagation && e.stopImmediatePropagation(); } catch(_){}
            }, true);
            log('Popup suppression enabled.');
        } catch(_) {}
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  8. SCRIPT-INSERTION GUARD - createElement('script') を監視
     * ════════════════════════════════════════════════════════════════════════ */
    function guardScriptInsertion() {
        try {
            const _createElement = document.createElement.bind(document);
            document.createElement = function(tag) {
                const el = _createElement.apply(this, arguments);
                if (!tag || typeof tag !== 'string') return el;
                const t = tag.toLowerCase();
                if (t === 'script' || t === 'iframe' || t === 'img' || t === 'link') {
                    try {
                        const origSetAttr = el.setAttribute.bind(el);
                        el.setAttribute = function(name, value) {
                            if ((name === 'src' || name === 'href') && isAdUrl(value)) {
                                log('createElement('+t+') src blocked:', value);
                                return; // 何もしない
                            }
                            return origSetAttr(name, value);
                        };
                        // src プロパティセッタも監視
                        let _src = '';
                        try {
                            Object.defineProperty(el, 'src', {
                                configurable: true,
                                get(){ return _src; },
                                set(v){
                                    if (isAdUrl(v)) { log('src setter blocked:', v); return; }
                                    _src = v;
                                    origSetAttr('src', v);
                                }
                            });
                        } catch(_) {}
                    } catch(_) {}
                }
                return el;
            };
            log('createElement guard installed.');
        } catch(_) {}
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  9. COOKIE / STORAGE TRACKER WIPE
     * ════════════════════════════════════════════════════════════════════════ */
    function wipeTrackerStorage() {
        const TRACKER_KEYS = [
            '_ga','_gid','_gat','_gcl_au','_fbp','_fbc','_uetsid','_uetvid',
            'IDE','test_cookie','NID','SID','HSID','APISID','SAPISID','__gads','__gpi',
            'AID','TAID','_pinterest_sess','_pin_unauth','MUID','MR','SRM_B',
            'criteo','outbrain_cid','taboola_uid','adroll','mp_','amplitude','hj','optimizely'
        ];
        const test = (k) => TRACKER_KEYS.some(t => k.toLowerCase().includes(t.toLowerCase()));
        try {
            document.cookie.split(';').forEach(c => {
                const name = c.split('=')[0].trim();
                if (test(name)) {
                    document.cookie = name + '=; expires=Thu,01 Jan 1970 00:00:00 GMT; path=/';
                    try { document.cookie = name + '=; expires=Thu,01 Jan 1970 00:00:00 GMT; path=/; domain=.' + location.hostname; } catch(_){}
                }
            });
        } catch(_){}
        try {
            for (const k of Object.keys(localStorage))   if (test(k)) localStorage.removeItem(k);
            for (const k of Object.keys(sessionStorage)) if (test(k)) sessionStorage.removeItem(k);
        } catch(_){}
        log('Tracker cookies/storage wiped.');
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  10. CSP-INDEPENDENT META TAG - 広告ドメインへの接続を最初から拒否
     * ════════════════════════════════════════════════════════════════════════ */
    // 注: 既存サイトCSPを破壊しないよう、追加CSPは入れない方針。
    //     代わりに <link rel="preconnect"> 等で先回りした接続は dns-prefetch を無効化。
    function disableAdPrefetch() {
        try {
            document.querySelectorAll('link[rel="preconnect"],link[rel="dns-prefetch"],link[rel="prefetch"],link[rel="preload"]')
                .forEach(l => { if (isAdUrl(l.href)) l.parentNode && l.parentNode.removeChild(l); });
        } catch(_){}
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  11. VIDEO PRE-ROLL SKIPPER (YouTube/Vimeo風 player の広告自動スキップ)
     * ════════════════════════════════════════════════════════════════════════ */
    function autoSkipVideoAds() {
        const TICK = 500;
        setInterval(() => {
            try {
                // YouTube
                const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
                if (skipBtn) skipBtn.click();
                const adShowing = document.querySelector('.ad-showing, .ytp-ad-player-overlay');
                if (adShowing) {
                    const v = document.querySelector('video');
                    if (v && isFinite(v.duration)) { try { v.currentTime = v.duration; v.playbackRate = 16; } catch(_){} }
                }
                // 汎用 "close ad" ボタン
                document.querySelectorAll('button[aria-label*="広告" i],button[aria-label*="ad" i],button[class*="close-ad" i]')
                    .forEach(b => { try { b.click(); } catch(_){} });
            } catch(_) {}
        }, TICK);
        log('Video ad auto-skipper running.');
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  12. SCROLL / OVERFLOW RECOVERY - 広告解除後のレイアウト復旧
     * ════════════════════════════════════════════════════════════════════════ */
    function recoverLayout() {
        const fix = () => {
            try {
                const html = document.documentElement, body = document.body;
                if (!html || !body) return;
                const hStyle = getComputedStyle(html), bStyle = getComputedStyle(body);
                if (hStyle.overflow === 'hidden' || bStyle.overflow === 'hidden') {
                    html.style.setProperty('overflow','auto','important');
                    body.style.setProperty('overflow','auto','important');
                }
                if (bStyle.position === 'fixed') body.style.setProperty('position','static','important');
                // 巨大オーバーレイ（インタースティシャル広告）を検出して除去
                document.querySelectorAll('div,section,aside').forEach(el => {
                    try {
                        const cs = getComputedStyle(el);
                        if ((cs.position === 'fixed' || cs.position === 'sticky') &&
                            parseInt(cs.zIndex,10) > 9999 &&
                            el.offsetWidth >= window.innerWidth * 0.7 &&
                            el.offsetHeight >= window.innerHeight * 0.7) {
                            const txt = (el.innerText || '').slice(0,200);
                            if (/広告|ad|sponsor|promo|登録|subscribe/i.test(txt) || el.querySelector('iframe,ins')) {
                                neutralize(el);
                            }
                        }
                    } catch(_){}
                });
            } catch(_){}
        };
        setInterval(fix, 1000);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  13. BOOT SEQUENCE - 全モジュール起動
     * ════════════════════════════════════════════════════════════════════════ */
    function boot() {
        try { neutralizeAdAPIs();      } catch(e){ warn('neutralizeAdAPIs',e); }
        try { patchNetwork();           } catch(e){ warn('patchNetwork',e); }
        try { guardScriptInsertion();   } catch(e){ warn('guardScriptInsertion',e); }
        try { suppressPopups();         } catch(e){ warn('suppressPopups',e); }
        try { injectCosmeticCSS();      } catch(e){ warn('injectCosmeticCSS',e); }
        try { disableAdPrefetch();      } catch(e){ warn('disableAdPrefetch',e); }

        const onReady = () => {
            try { sweepRoot(document);   } catch(e){ warn('sweepRoot',e); }
            try { startObserver();        } catch(e){ warn('startObserver',e); }
            try { deployDecoys();         } catch(e){ warn('deployDecoys',e); }
            try { wipeTrackerStorage();   } catch(e){ warn('wipeTrackerStorage',e); }
            try { autoSkipVideoAds();     } catch(e){ warn('autoSkipVideoAds',e); }
            try { recoverLayout();        } catch(e){ warn('recoverLayout',e); }
            log('All subsystems online. Signed: Mino.');
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady, { once: true });
        } else {
            onReady();
        }
        // load 後にもう一度掃除
        globalScope.addEventListener('load', () => {
            try { sweepRoot(document); } catch(_){}
            try { wipeTrackerStorage(); } catch(_){}
        }, { once: true });
    }

    boot();

    /* ════════════════════════════════════════════════════════════════════════
     *  14. PUBLIC API (任意で外部から制御可能)
     * ════════════════════════════════════════════════════════════════════════ */
    Object.defineProperty(globalScope, 'EraseAd', {
        value: Object.freeze({
            author: 'Mino',
            version: VERSION,
            sweep: () => sweepRoot(document),
            isAdUrl,
            isAdToken
        }),
        writable: false, configurable: false, enumerable: false
    });

})(typeof window !== 'undefined' ? window : this);

