/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                                                                          ║
 * ║                   E R A S E A D . J S   ―  R E B O R N                   ║
 * ║                                                                          ║
 * ║              The Surgical Universal Ad Annihilator                       ║
 * ║              ─────────────────────────────────────                       ║
 * ║                                                                          ║
 * ║   ✦ Version  : 4.0.0 "Scalpel"                                           ║
 * ║   ✦ License  : MIT                                                       ║
 * ║   ✦ Motto    : "Remove ads. Touch nothing else."                         ║
 * ║                                                                          ║
 * ║   設計哲学（v3.0からの転換）:                                            ║
 * ║     1. 「広告を消す」より先に「ページを壊さない」を最優先                ║
 * ║     2. 曖昧なパターンマッチは原則禁止 (substring match 厳格化)           ║
 * ║     3. ネイティブAPIへの大規模パッチを廃止 (createElement/fetch 等)      ║
 * ║     4. CSSは「広告に確実なシグナルがある要素のみ」をhide                 ║
 * ║     5. レイアウト破壊系プロパティ（position絶対化, pointer-events伝播）  ║
 * ║        は親→子へ波及しない形で適用                                       ║
 * ║     6. overflow強制解除はせず、明示的なad-locked判定時のみ              ║
 * ║     7. localStorage / Cookie には触れない (ログイン消失防止)             ║
 * ║     8. すべての処理を try/catch で完全防御。例外が出てもページは無傷     ║
 * ║                                                                          ║
 * ║   使用方法:                                                              ║
 * ║     <script src="erasead.js"></script>  を <head> の先頭に配置するか、   ║
 * ║     ブックマークレット / Tampermonkey で document-start に注入。         ║
 * ║                                                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
(function EraseAdScalpel() {
    'use strict';

    // ─── 多重実行ガード ─────────────────────────────────────────────────────
    try {
        if (window.__ERASEAD_SCALPEL_LOADED__) return;
        Object.defineProperty(window, '__ERASEAD_SCALPEL_LOADED__', {
            value: '4.0.0', writable: false, configurable: false, enumerable: false
        });
    } catch (_) { /* defineProperty失敗時もブロック処理は続行 */ }

    // ─── 安全なログ（本番ではnoop。デバッグ時は LOG=true に） ───────────────
    const LOG = false;
    const log  = LOG ? (...a) => { try { console.log('[EraseAd]', ...a); } catch(_){} } : () => {};
    const warn = LOG ? (...a) => { try { console.warn('[EraseAd]', ...a); } catch(_){} } : () => {};

    // ─── すべてを包む安全実行ヘルパー ───────────────────────────────────────
    const safe = (fn, label) => {
        try { return fn(); }
        catch (e) { warn('safe-catch:', label, e); return undefined; }
    };

    // ─── ホワイトリスト（このホストでは何もしない） ─────────────────────────
    // 自サイトや特定サイトを除外したい場合はここに追加
    const ALLOW_HOSTS = new Set([
        // 'example.com',
    ]);
    try {
        if (ALLOW_HOSTS.has(location.hostname)) {
            log('Host allowlisted, skipping:', location.hostname);
            return;
        }
    } catch (_) {}

    // ─── 偽陽性ガード: これらの語を含む class/id は絶対に触らない ────────────
    // (header, address, admin, load, gradient, shadow, modal, dialog, ...)
    const FALSE_POSITIVE_GUARD = /(?:^|[-_ ])(?:header|head|address|admin|administrator|administration|loader|loading|download|upload|upgrade|gradient|shadow|shadowbox|modal(?!-ad)|dialog|drawer|sidebar(?!-ad)|navbar(?!-ad)|menu|content|article|comment|reply|reaction|read|reader|reading|readme|adapter|adaptive|adapt|adopt|adopted|adoption|adolescent|adore|advance|advanced|advantage|adventure|adjacent|adjective|adjust|admire|admission|admit|adopt|adult|radar|gladly|sadly|badly|madly|paddle|saddle|ladder|leader|header|reader|grader|trader|adagio|adamant|adieu|adios|cascade|facade|nomad|salad|squad|brigade|decade|made|trade|grade|blade|spade|shade|wade|fade|aide|abide|aside|outside|inside|guide|ride|side|wide|hide|tide|provide|divide|reside|preside|decide|coincide|advice|advise|adverb|address|adhere|adieu|adjust|advoc|loadable|reloaded|preload|payload|onload|workload|airline|adapter)(?:$|[-_ ])/i;

    const isFalsePositive = (str) => {
        if (!str || typeof str !== 'string') return false;
        return FALSE_POSITIVE_GUARD.test(str);
    };

    // ─── 厳格な広告判定キーワード（境界付きトークン） ──────────────────────
    // word-boundary を意識し、ad単独ではなく ad-/ad_/_ad/-ad のみ許容
    const STRICT_AD_TOKENS = [
        // 明確な広告キーワード（部分一致でもまず誤爆しない）
        'adsbygoogle', 'adsense', 'doubleclick', 'googlesyndication',
        'googleadservices', 'googletagservices', 'googletagmanager',
        'amazon-adsystem', 'amazonadsystem',
        'criteo', 'taboola', 'outbrain', 'pubmatic', 'rubiconproject',
        'openx', 'adform', 'adnxs', 'adsrvr', 'adsafeprotected',
        'moatads', 'scorecardresearch', 'quantserve', 'chartbeat',
        'prebid', 'pbjs', 'aps_csm', 'permutive', 'liveramp',
        'sponsoredads', 'sponsored-ad', 'sponsoredad',
        // -ad-, _ad_, /ad/ パターン
        'div-gpt-ad', 'gpt-ad-', 'google_ads_', 'google-ads-',
        'ad-banner', 'ad-container', 'ad-wrapper', 'ad-slot',
        'ad-unit', 'ad-block', 'ad-placement', 'ad-frame',
        'ad-iframe', 'ad-footer', 'ad-header', 'ad-sidebar',
        'banner-ad', 'sidebar-ad', 'footer-ad', 'header-ad',
        'sticky-ad', 'floating-ad', 'overlay-ad', 'popup-ad',
        'inline-ad', 'native-ad', 'video-ad', 'preroll-ad',
        'sponsored-content', 'sponsored-post', 'sponsored-link',
        'aswift_', 'aswift-'
    ];

    // 安全に正規表現化
    const _escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const STRICT_AD_REGEX = new RegExp(
        '(?:' + STRICT_AD_TOKENS.map(_escapeRe).join('|') + ')',
        'i'
    );

    const isStrictAdToken = (str) => {
        if (!str || typeof str !== 'string') return false;
        if (isFalsePositive(str)) return false;
        return STRICT_AD_REGEX.test(str);
    };

    // ─── 広告ネットワークドメイン（URL用） ─────────────────────────────────
    const AD_NETWORK_DOMAINS = [
        'doubleclick.net',
        'googlesyndication.com',
        'googleadservices.com',
        'googletagservices.com',
        'googletagmanager.com/gtag/js',     // GTM本体は別途、計測ピクセルだけブロック
        'google-analytics.com/r/collect',
        'amazon-adsystem.com',
        'adservice.google.',
        'pagead2.googlesyndication.com',
        'partner.googleadservices.com',
        'tpc.googlesyndication.com',
        'securepubads.g.doubleclick.net',
        'criteo.com', 'criteo.net',
        'taboola.com', 'trc.taboola.com',
        'outbrain.com', 'widgets.outbrain.com',
        'pubmatic.com',
        'rubiconproject.com',
        'openx.net',
        'adform.net',
        'adnxs.com',
        'adsrvr.org',
        'adsafeprotected.com',
        'moatads.com',
        'scorecardresearch.com',
        'quantserve.com',
        'zedo.com',
        'media.net',
        'yieldmo.com',
        'sharethrough.com',
        'indexexchange.com',
        'casalemedia.com',
        'smartadserver.com',
        'contextweb.com',
        'bidswitch.net',
        '3lift.com',
        'pagefair.com'
    ];

    const isAdUrl = (url) => {
        if (!url || typeof url !== 'string') return false;
        const u = url.toLowerCase();
        for (let i = 0; i < AD_NETWORK_DOMAINS.length; i++) {
            if (u.indexOf(AD_NETWORK_DOMAINS[i]) !== -1) return true;
        }
        return false;
    };

    // ═════════════════════════════════════════════════════════════════════════
    // 1. COSMETIC CSS  (最も慎重な部分 — ページ崩壊の主犯)
    // ═════════════════════════════════════════════════════════════════════════
    //
    // v3.0との違い:
    //   ✗ div[data-ad"]  ← 構文エラー   →  正しく div[data-ad] に
    //   ✗ [class*="interstitial"]       →  削除（モーダル巻き添えのため）
    //   ✗ [class*="広告"] (どこでも一致) →  境界付きに限定
    //   ✗ position:absolute + left:-99999px →  display:none のみで充分
    //   ✗ pointer-events:none           →  子要素クリック不能化、削除
    //   ✓ 「広告であることが確実」な属性パターンのみに絞り込み
    //
    const COSMETIC_SELECTORS = [
        // ── Google AdSense / GPT (最も確実) ──
        'ins.adsbygoogle',
        'ins[data-ad-client]',
        'ins[data-ad-slot]',
        'iframe[id^="google_ads_iframe"]',
        'iframe[id^="aswift_"]',
        'iframe[name^="google_ads_iframe"]',
        'iframe[name^="aswift_"]',
        'div[id^="div-gpt-ad-"]',
        'div[id^="google_ads_div"]',
        'div[id^="gpt-ad-"]',
        'div[data-google-query-id]',
        'div[data-ad-client][data-ad-slot]',

        // ── Doubleclick / その他広告iframe (src完全限定) ──
        'iframe[src*="doubleclick.net"]',
        'iframe[src*="googlesyndication.com"]',
        'iframe[src*="googleadservices.com"]',
        'iframe[src*="amazon-adsystem.com"]',
        'iframe[src*="criteo.com"]',
        'iframe[src*="criteo.net"]',
        'iframe[src*="adnxs.com"]',
        'iframe[src*="taboola.com"]',
        'iframe[src*="outbrain.com"]',
        'iframe[src*="pubmatic.com"]',
        'iframe[src*="rubiconproject.com"]',
        'iframe[src*="openx.net"]',
        'iframe[src*="adform.net"]',
        'iframe[src*="moatads.com"]',
        'iframe[src*="adsrvr.org"]',
        // 注意: "adservice" は customerservice 等を巻き込むので "adservice.google" に限定
        'iframe[src*="adservice.google"]',

        // ── Taboola / Outbrain ウィジェット (確実なID/クラスのみ) ──
        'div[id^="taboola-"]',
        'div[id="taboola-below-article-thumbnails"]',
        'div[class^="taboola-"]',
        'div[id^="outbrain_widget_"]',
        'div[class^="OUTBRAIN"]',
        'div[data-widget-id^="AR_"]',  // Outbrain widget

        // ── 確実な data-* 属性 (これらは広告以外で使われない) ──
        '[data-ad-client]',
        '[data-ad-slot]',
        '[data-ad-unit]',
        '[data-adunit-path]',
        '[data-ad-format]',
        '[data-ad-region]',
        '[data-google-av-cxn]',

        // ── 広告リンク (href完全パターン) ──
        'a[href*="doubleclick.net/aclk"]',
        'a[href*="googleadservices.com/pagead"]',
        'a[href*="googlesyndication.com/pagead"]',

        // ── 単語境界付き ad-/_ad/-ad クラス・ID ──
        // 注意: [class*="ad"] は使わず、必ず区切り文字を含める
        'div[class^="ad-banner"]',
        'div[class^="ad-container"]',
        'div[class^="ad-wrapper"]',
        'div[class^="ad-slot"]',
        'div[class^="ad-unit"]',
        'div[class^="ad-placement"]',
        'div[class^="ad-block"]',
        'div[class*=" ad-banner"]',
        'div[class*=" ad-container"]',
        'div[class*=" ad-wrapper"]',
        'div[class*=" ad-slot"]',
        'div[class*=" ad-unit"]',
        'div[id="ad-banner"]',
        'div[id="ad-container"]',
        'div[id="ad-wrapper"]',
        'div[id="ad-slot"]',
        'div[id^="ad-banner-"]',
        'div[id^="ad-container-"]',
        'div[id^="ad-wrapper-"]',
        'div[id^="ad-slot-"]',
        'div[id^="ad-unit-"]',

        // ── adsbygoogle 関連 ──
        'div.adsbygoogle',
        'div.adsbygoogle-noablate',

        // ── スポンサード (語頭・語末で限定) ──
        'div[class^="sponsored-"]',
        'div[class*=" sponsored-"]',
        'aside[class^="sponsored-"]',
        'section[class^="sponsored-"]',
        'div[id^="sponsored-"]',
        'div[data-sponsored]',
        'li.sponsored-post',
        'li.sponsored-content',

        // ── 日本語広告マーカー (厳格に) ──
        // [class*="広告"] は無差別すぎるので、ピンポイント語彙のみ
        'div.広告',
        'div[class$="広告"]',
        'div[class^="広告-"]',
        'div[id="広告"]',
        'span.PR表示',
        'div.AD表示',

        // ── 既知の悪質広告挿入パターン ──
        'iframe[id^="ad_iframe_"]',
        'iframe[name^="ad_iframe_"]',
        'div[id^="ad_position_"]',
        'div[id^="ad_unit_"]',
        'div[class^="adsbygoogle"]'
    ];

    // 注意: [class*="interstitial"], [class*="popup-ad"], [class*="modal-ad"],
    // sticky-ad, floating-ad, overlay-ad は意図的に除外
    // → サイトの正規モーダル/ナビと衝突するため、JS側で「広告と判定できた場合のみ」処理

    function injectCosmeticCSS() {
        safe(() => {
            const STYLE_ID = 'erasead-scalpel-cosmetic';
            if (document.getElementById(STYLE_ID)) return;

            // 適用先が無い段階でも <head> か <html> に差し込めるよう待機
            const insert = () => {
                if (document.getElementById(STYLE_ID)) return;
                const style = document.createElement('style');
                style.id = STYLE_ID;
                style.type = 'text/css';

                // KEY: display:none のみ。position絶対化やpointer-events伝播は使わない
                // !important で他CSSとの競合を回避するが、影響範囲は要素自身に閉じる
                const css =
                    COSMETIC_SELECTORS.join(',\n') + ' {\n' +
                    '  display: none !important;\n' +
                    '}\n' +
                    // アンチアドブロック検知用デコイ (見える状態を維持しつつ画面外)
                    // 注意: position:absolute は要素自身にのみ。親には影響しない
                    '.adsbox, .ad-placement-decoy, #ad-banner-decoy {\n' +
                    '  display: block !important;\n' +
                    '  width: 1px !important;\n' +
                    '  height: 1px !important;\n' +
                    '  position: absolute !important;\n' +
                    '  left: -9999px !important;\n' +
                    '  top: -9999px !important;\n' +
                    '  opacity: 0.01 !important;\n' +
                    '  pointer-events: none !important;\n' +
                    '}\n';

                style.appendChild(document.createTextNode(css));

                const target = document.head || document.documentElement;
                if (target) target.appendChild(style);
            };

            if (document.head || document.documentElement) {
                insert();
            } else {
                // documentElementすら無い極初期 → MutationObserverで待機
                const earlyObs = new MutationObserver(() => {
                    if (document.head || document.documentElement) {
                        insert();
                        earlyObs.disconnect();
                    }
                });
                try { earlyObs.observe(document, { childList: true, subtree: true }); } catch(_) {}
            }
        }, 'injectCosmeticCSS');
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 2. NETWORK GUARD  (慎重設計 — SPA APIを壊さない)
    // ═════════════════════════════════════════════════════════════════════════
    //
    // v3.0との違い:
    //   ✗ fetch/XHR全リクエストを判定 → 確実な広告ドメインのみに限定
    //   ✗ 一律 status 204 で返す → 元のPromise APIを壊さないよう Response を返す
    //   ✓ 例外発生時は必ず元のメソッドにフォールバック
    //
    function patchNetwork() {
        safe(() => {
            // ── fetch ──
            if (typeof window.fetch === 'function') {
                const origFetch = window.fetch.bind(window);
                window.fetch = function patchedFetch(input, init) {
                    try {
                        let url = '';
                        if (typeof input === 'string') url = input;
                        else if (input && typeof input.url === 'string') url = input.url;

                        if (url && isAdUrl(url)) {
                            log('block fetch:', url);
                            // 空のResponseを返す。call sideは正常完了として扱える
                            return Promise.resolve(new Response('', {
                                status: 204,
                                statusText: 'No Content',
                                headers: { 'Content-Type': 'text/plain' }
                            }));
                        }
                    } catch (_) { /* 判定失敗→普通に通す */ }
                    return origFetch(input, init);
                };
            }

            // ── XMLHttpRequest ──
            if (typeof window.XMLHttpRequest === 'function') {
                const XHR = window.XMLHttpRequest;
                const origOpen = XHR.prototype.open;
                const origSend = XHR.prototype.send;

                XHR.prototype.open = function(method, url) {
                    try {
                        this.__erasead_url__ = url;
                        this.__erasead_blocked__ = (typeof url === 'string' && isAdUrl(url));
                    } catch(_) {}
                    return origOpen.apply(this, arguments);
                };

                XHR.prototype.send = function(body) {
                    if (this.__erasead_blocked__) {
                        log('block XHR:', this.__erasead_url__);
                        // 同期的にエラー化せず、非同期で完了イベントだけ発火
                        try {
                            Object.defineProperty(this, 'readyState',   { value: 4, configurable: true });
                            Object.defineProperty(this, 'status',       { value: 204, configurable: true });
                            Object.defineProperty(this, 'responseText', { value: '', configurable: true });
                            Object.defineProperty(this, 'response',     { value: '', configurable: true });
                        } catch(_) {}
                        const fire = () => {
                            try { this.onreadystatechange && this.onreadystatechange(); } catch(_) {}
                            try { this.onload && this.onload(); } catch(_) {}
                            try { this.dispatchEvent && this.dispatchEvent(new Event('load')); } catch(_) {}
                        };
                        setTimeout(fire, 0);
                        return;
                    }
                    return origSend.apply(this, arguments);
                };
            }

            // ── navigator.sendBeacon ──
            if (navigator && typeof navigator.sendBeacon === 'function') {
                const origBeacon = navigator.sendBeacon.bind(navigator);
                navigator.sendBeacon = function(url, data) {
                    try {
                        if (typeof url === 'string' && isAdUrl(url)) {
                            log('block beacon:', url);
                            return true;  // 成功を装う
                        }
                    } catch(_) {}
                    return origBeacon(url, data);
                };
            }
        }, 'patchNetwork');
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 3. ANTI-ANTI-ADBLOCK  (検知回避用ダミー)
    // ═════════════════════════════════════════════════════════════════════════
    //
    // v3.0との違い:
    //   ✗ document.createElement の上書き → 廃止（正規scriptの読込を壊す）
    //   ✗ window.open のグローバル無効化 → 廃止（正規リンクのtarget=_blank破壊）
    //   ✓ noop オブジェクトの提供のみ。既存実装があれば一切上書きしない
    //
    function neutralizeAdAPIs() {
        safe(() => {
            const noop = function() {};
            const noopProxy = new Proxy(noop, {
                get: () => noopProxy,
                apply: () => undefined,
                construct: () => ({})
            });

            const defineIfMissing = (target, prop, value) => {
                try {
                    if (target[prop] === undefined) {
                        Object.defineProperty(target, prop, {
                            value: value,
                            writable: true,
                            configurable: true
                        });
                    }
                } catch(_) {}
            };

            // adsbygoogle: 配列としてpush可能なスタブ（既存があればそのまま）
            try {
                if (!Array.isArray(window.adsbygoogle)) {
                    window.adsbygoogle = window.adsbygoogle || [];
                    if (typeof window.adsbygoogle.push !== 'function') {
                        window.adsbygoogle.push = noop;
                    }
                    window.adsbygoogle.loaded = true;
                }
            } catch(_) {}

            // Google Publisher Tag
            try {
                if (!window.googletag) {
                    window.googletag = {
                        cmd: { push: function(cb) { try { typeof cb === 'function' && cb(); } catch(_){} } },
                        pubads: function() { return { addEventListener: noop, refresh: noop, enableSingleRequest: noop, collapseEmptyDivs: noop, setTargeting: noop }; },
                        display: noop, defineSlot: function(){ return { addService: noop, setTargeting: noop }; },
                        enableServices: noop, destroySlots: noop
                    };
                }
            } catch(_) {}

            // 検知回避: アドブロック検知用のお馴染みのプロパティ
            defineIfMissing(window, 'canRunAds',       true);
            defineIfMissing(window, 'isAdBlockActive', false);
            defineIfMissing(window, 'adblockDetected', false);
        }, 'neutralizeAdAPIs');
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 4. DEPLOY DECOYS  (アドブロック検知をだます)
    // ═════════════════════════════════════════════════════════════════════════
    function deployDecoys() {
        safe(() => {
            if (!document.body) return;
            if (document.getElementById('ad-banner-decoy')) return;

            const decoy = document.createElement('div');
            decoy.id = 'ad-banner-decoy';
            decoy.className = 'adsbox ad-placement-decoy';
            decoy.setAttribute('aria-hidden', 'true');
            decoy.style.cssText =
                'width:1px;height:1px;position:absolute;left:-9999px;top:-9999px;opacity:0.01;pointer-events:none;';

            // offsetHeight が 0 になると検知される → 1 を返すよう偽装
            try {
                Object.defineProperty(decoy, 'offsetHeight', { get: () => 1, configurable: true });
                Object.defineProperty(decoy, 'offsetWidth',  { get: () => 1, configurable: true });
                Object.defineProperty(decoy, 'clientHeight', { get: () => 1, configurable: true });
                Object.defineProperty(decoy, 'clientWidth',  { get: () => 1, configurable: true });
            } catch(_) {}

            document.body.appendChild(decoy);
        }, 'deployDecoys');
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 5. DOM SWEEP  (動的広告の除去)
    // ═════════════════════════════════════════════════════════════════════════
    //
    // v3.0との違い:
    //   ✗ innerHTML = '' で要素を空にする → 正規要素誤判定時の破壊大。廃止
    //   ✓ display:none をインラインで付与するだけ（CSSと同様の最小侵襲）
    //   ✓ 偽陽性ガードを必ず通す
    //
    function neutralize(node) {
        if (!node || node.nodeType !== 1) return;
        if (node.__erasead_neutralized__) return;

        safe(() => {
            // 二重処理防止フラグ
            node.__erasead_neutralized__ = true;

            // <script>, <link>, <img> はそのまま削除可（広告URLが確定済みなので）
            const tag = node.tagName;
            if (tag === 'SCRIPT' || tag === 'LINK') {
                if (node.parentNode) {
                    try { node.parentNode.removeChild(node); } catch(_) {}
                }
                return;
            }

            // それ以外は display:none のみ。要素は残してレイアウト破壊を最小化
            try {
                node.style.setProperty('display', 'none', 'important');
            } catch(_) {}
        }, 'neutralize');
    }

    // 要素が広告かどうか判定 (極めて慎重に)
    function nodeLooksLikeAd(node) {
        if (!node || node.nodeType !== 1) return false;
        try {
            const tag = node.tagName;

            // iframe: src が広告ドメインなら確定
            if (tag === 'IFRAME') {
                const src = node.getAttribute('src') || '';
                if (src && isAdUrl(src)) return true;
                const id = node.id || '';
                const name = node.getAttribute('name') || '';
                if (/^(google_ads_iframe|aswift_|ad_iframe_)/.test(id)) return true;
                if (/^(google_ads_iframe|aswift_|ad_iframe_)/.test(name)) return true;
                return false;
            }

            // script: src が広告ドメインなら確定
            if (tag === 'SCRIPT') {
                const src = node.getAttribute('src') || '';
                if (src && isAdUrl(src)) return true;
                return false;
            }

            // link[rel="preconnect|dns-prefetch|prefetch|preload"]: 広告ドメイン
            if (tag === 'LINK') {
                const rel = (node.getAttribute('rel') || '').toLowerCase();
                if (rel === 'preconnect' || rel === 'dns-prefetch' || rel === 'prefetch' || rel === 'preload') {
                    const href = node.getAttribute('href') || '';
                    if (href && isAdUrl(href)) return true;
                }
                return false;
            }

            // ins.adsbygoogle / data-ad-client/slot は確定
            if (tag === 'INS' && node.classList && node.classList.contains('adsbygoogle')) return true;
            if (node.hasAttribute && (node.hasAttribute('data-ad-client') || node.hasAttribute('data-ad-slot') || node.hasAttribute('data-google-query-id'))) {
                return true;
            }

            // id/class による判定 (偽陽性ガード必須)
            const id = node.id || '';
            const cls = (typeof node.className === 'string') ? node.className : '';

            if (id && !isFalsePositive(id) && isStrictAdToken(id)) return true;
            if (cls && !isFalsePositive(cls) && isStrictAdToken(cls)) return true;

            return false;
        } catch (_) {
            return false;
        }
    }

    function sweepRoot(root) {
        safe(() => {
            if (!root || !root.querySelectorAll) return;

            // 確実なセレクタで一括検索（CSSと同じ厳格セレクタを再利用）
            const selector = COSMETIC_SELECTORS.join(',');
            let nodes;
            try { nodes = root.querySelectorAll(selector); }
            catch (_) { return; }

            for (let i = 0; i < nodes.length; i++) {
                neutralize(nodes[i]);
            }

            // 動的判定: 新規 iframe/script/ins を個別チェック
            try {
                const dyn = root.querySelectorAll('iframe, script, ins, link[rel="preconnect"], link[rel="dns-prefetch"], link[rel="prefetch"], link[rel="preload"]');
                for (let i = 0; i < dyn.length; i++) {
                    if (nodeLooksLikeAd(dyn[i])) neutralize(dyn[i]);
                }
            } catch(_) {}
        }, 'sweepRoot');
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 6. MUTATION OBSERVER  (動的挿入の監視)
    // ═════════════════════════════════════════════════════════════════════════
    let _observer = null;
    function startObserver() {
        safe(() => {
            if (_observer) return;
            if (!window.MutationObserver || !document.documentElement) return;

            _observer = new MutationObserver((mutations) => {
                // 大量変更時のパフォーマンス保護: 200件超は次回tickへ
                if (mutations.length > 200) {
                    safe(() => sweepRoot(document.body || document.documentElement), 'obs-bulk');
                    return;
                }
                for (let i = 0; i < mutations.length; i++) {
                    const m = mutations[i];
                    if (m.addedNodes && m.addedNodes.length) {
                        for (let j = 0; j < m.addedNodes.length; j++) {
                            const n = m.addedNodes[j];
                            if (n && n.nodeType === 1) {
                                if (nodeLooksLikeAd(n)) {
                                    neutralize(n);
                                } else {
                                    // 子孫もスイープ
                                    sweepRoot(n);
                                }
                            }
                        }
                    }
                    if (m.type === 'attributes' && m.target && m.target.nodeType === 1) {
                        if (nodeLooksLikeAd(m.target)) neutralize(m.target);
                    }
                }
            });

            try {
                _observer.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['src', 'href', 'class', 'id', 'data-ad-client', 'data-ad-slot']
                });
            } catch(_) {}
        }, 'startObserver');
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 7. VIDEO AD AUTO-SKIP  (YouTube等のスキップボタン押下)
    // ═════════════════════════════════════════════════════════════════════════
    //
    // v3.0との違い:
    //   ✗ 倍速再生に書き換え → 廃止（ユーザーの正規動画も巻き添え）
    //   ✓ 「スキップボタンが出たら押す」のみ
    //
    let _videoSkipTimer = null;
    function autoSkipVideoAds() {
        safe(() => {
            if (_videoSkipTimer) return;
            const SKIP_SELECTORS = [
                '.ytp-ad-skip-button',
                '.ytp-ad-skip-button-modern',
                '.ytp-skip-ad-button',
                '.videoAdUiSkipButton',
                'button.ytp-ad-skip-button-container'
            ];
            const sel = SKIP_SELECTORS.join(',');

            _videoSkipTimer = setInterval(() => {
                safe(() => {
                    const btns = document.querySelectorAll(sel);
                    for (let i = 0; i < btns.length; i++) {
                        const b = btns[i];
                        if (b && typeof b.click === 'function') {
                            try { b.click(); } catch(_) {}
                        }
                    }
                }, 'videoSkip-tick');
            }, 1000);
        }, 'autoSkipVideoAds');
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 8. BOOT SEQUENCE  (起動順序)
    // ═════════════════════════════════════════════════════════════════════════
    function boot() {
        // Phase 1: pre-DOM (即時)
        neutralizeAdAPIs();
        patchNetwork();
        injectCosmeticCSS();

        // Phase 2: DOM ready
        const onReady = () => safe(() => {
            sweepRoot(document.documentElement);
            startObserver();
            deployDecoys();
            autoSkipVideoAds();
        }, 'onReady');

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady, { once: true });
        } else {
            onReady();
        }

        // Phase 3: 完全load後の最終スイープ
        window.addEventListener('load', () => safe(() => {
            sweepRoot(document.documentElement);
        }, 'load-final-sweep'), { once: true });
    }

    // ─── すべてを try で包んだ最終起動 ───
    try {
        boot();
        log('Scalpel v4.0.0 booted on', location.hostname);
    } catch (e) {
        // ここに来ても、ページは何一つ壊れない
        warn('boot failed:', e);
    }

})();
