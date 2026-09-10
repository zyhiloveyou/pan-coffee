/* ==========================================================================
   潘咖啡 · 页面交互
   纯原生 JS，无依赖。所有交互都做了降级：JS 失效时页面仍可正常阅读。
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- 年份 */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------- 顶栏描边 + 底部栏收起 */
  var topbar = $('#topbar');
  var actionbar = $('#actionbar');
  var lastY = window.pageYOffset;
  var ticking = false;

  function onScrollFrame() {
    var y = window.pageYOffset;

    if (topbar) topbar.classList.toggle('is-stuck', y > 8);

    if (actionbar && !document.body.classList.contains('is-locked')) {
      var goingDown = y > lastY + 4;
      var goingUp = y < lastY - 4;
      // 顶部附近永远显示，下滑隐藏让出阅读空间，上滑立刻回来
      if (goingDown && y > 140) actionbar.classList.add('is-hidden');
      else if (goingUp || y < 140) actionbar.classList.remove('is-hidden');
    }

    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScrollFrame); }
  }, { passive: true });
  onScrollFrame();

  /* ------------------------------------------------------------ 抽屉菜单 */
  var burger = $('#burger');
  var drawer = $('#drawer');
  var drawerMask = $('#drawerMask');
  var drawerPanel = drawer ? $('.drawer__panel', drawer) : null;
  var lastFocused = null;
  var scrollLockY = 0;

  /* iOS Safari 上 body{overflow:hidden} 锁不住背景滚动，
     改用 position:fixed + 负 top 偏移，关闭时再还原滚动位置。 */
  function lockScroll() {
    scrollLockY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var b = document.body.style;
    b.position = 'fixed';
    b.top = -scrollLockY + 'px';
    b.left = '0';
    b.right = '0';
    b.width = '100%';
    b.overflow = 'hidden';
  }

  function unlockScroll(restore) {
    var b = document.body.style;
    b.position = '';
    b.top = '';
    b.left = '';
    b.right = '';
    b.width = '';
    b.overflow = '';
    if (restore !== false) window.scrollTo(0, scrollLockY);
  }

  function openDrawer() {
    if (!drawer) return;
    lastFocused = document.activeElement;
    drawer.hidden = false;
    lockScroll();
    // 下一帧再加 class，保证过渡动画生效
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { drawer.classList.add('is-open'); });
    });
    if (burger) { burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', '关闭菜单'); }
    if (drawerPanel) {
      var first = drawerPanel.querySelector('a, button');
      if (first) first.focus({ preventScroll: true });
    }
  }

  function closeDrawer(returnFocus, restoreScroll) {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('is-open');
    if (burger) { burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', '打开菜单'); }
    unlockScroll(restoreScroll);

    var delay = prefersReduced ? 0 : 340;
    window.setTimeout(function () {
      if (!drawer.classList.contains('is-open')) drawer.hidden = true;
    }, delay);

    if (returnFocus !== false && lastFocused && lastFocused.focus) {
      lastFocused.focus({ preventScroll: true });
    }
  }

  if (burger && drawer) {
    burger.addEventListener('click', function () {
      if (drawer.hidden) openDrawer(); else closeDrawer();
    });

    if (drawerMask) drawerMask.addEventListener('click', function () { closeDrawer(); });

    // 点目录里的锚点：先关闭抽屉并解锁，再跳到目标区块
    $$('a[href^="#"]', drawer).forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        var target = id ? document.getElementById(id) : null;
        if (!target) { closeDrawer(false); return; }
        e.preventDefault();
        closeDrawer(false, false);
        window.setTimeout(function () {
          target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#' + id);
          }
        }, prefersReduced ? 0 : 80);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
      // 抽屉打开时用 Tab 循环聚焦，避免焦点跑到页面后面
      if (e.key === 'Tab' && !drawer.hidden && drawerPanel) {
        var focusables = $$('a[href], button:not([tabindex="-1"])', drawerPanel);
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // 旋转到横屏或放大窗口时，避免残留锁定
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900 && !drawer.hidden) closeDrawer(false);
    });
  }

  /* ------------------------------------------------------- 滚动渐显动效 */
  var revealTargets = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !prefersReduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------------------------------------------------------- 菜单分类切换 */
  var tabs = $$('.tab');
  var panels = $$('.menu__list');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var cat = tab.getAttribute('data-cat');
      tabs.forEach(function (t) {
        var active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach(function (p) {
        p.classList.toggle('is-active', p.getAttribute('data-panel') === cat);
      });
      // 让被点中的标签滚到可视区中间
      if (!prefersReduced && tab.scrollIntoView) {
        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  });

  /* ------------------------------------------------------------- 轻提示 */
  var toast = $('#toast');
  var toastTimer = null;

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove('is-show'); }, 2600);
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { showToast(okMsg); },
        function () { fallbackCopy(text, okMsg); }
      );
    } else {
      fallbackCopy(text, okMsg);
    }
  }

  function fallbackCopy(text, okMsg) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast(okMsg); }
    catch (err) { showToast('复制失败，请长按地址手动复制'); }
    document.body.removeChild(ta);
  }

  var copyAddr = $('#copyAddr');
  if (copyAddr) {
    copyAddr.addEventListener('click', function () {
      copyText(copyAddr.getAttribute('data-addr') || '', '地址已复制，可粘贴到地图 App 搜索');
    });
  }

  var wechatBtn = $('#wechatBtn');
  if (wechatBtn) {
    wechatBtn.addEventListener('click', function () {
      var id = wechatBtn.getAttribute('data-wechat') || '';
      copyText(id, '微信号 ' + id + ' 已复制，去微信搜索添加');
    });
  }

  /* ------------------------------------------- 手机端修正：地址栏高度变化 */
  // iOS Safari 滚动时工具栏伸缩会改变 100vh，这里只做一次滚动位置复位保护
  window.addEventListener('orientationchange', function () {
    window.setTimeout(function () { window.scrollBy(0, 1); }, 220);
  });
})();
