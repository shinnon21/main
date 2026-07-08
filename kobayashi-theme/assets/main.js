/* Kobayashi Portfolio — main.js */
(function () {
  'use strict';

  /* キーワードティッカー：継ぎ目なし無限ループ。
     元セット(N件)を「ビューポート幅の2倍以上」を満たす回数だけ複製し、
     アニメは「1セット分の実測px」ぶんだけ translateX する（＝複製の境目で
     絵柄が一致するため途切れない・常に画面が埋まる）。
     フォント確定後に採寸するため fonts.ready / load でも初期化を試みる */
  var lane = document.getElementById('tickerLane');
  if (lane && !lane.dataset.marquee) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      var initTicker = function () {
        if (lane.dataset.marquee) { return; }
        var ticker = lane.parentElement;
        var n = lane.children.length;
        if (!n) { return; }
        var oneSet = lane.scrollWidth || 1;
        var copies = Math.max(2, Math.ceil((ticker.offsetWidth * 2) / oneSet) + 1);
        var html = '', i;
        var setHTML = lane.innerHTML;
        for (i = 0; i < copies; i++) { html += setHTML; }
        lane.innerHTML = html;
        var shift = lane.children[n].offsetLeft; /* 2セット目先頭の位置＝1周期(px) */
        if (!shift) { return; }
        lane.style.setProperty('--kb-shift', shift + 'px');
        lane.style.animation = 'kbTicker ' + Math.max(14, shift / 55) + 's linear infinite';
        lane.dataset.marquee = '1';
      };
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(initTicker); }
      else { initTicker(); }
      window.addEventListener('load', initTicker);
    }
  }

  /* スクロールリビール：主要ブロックがスクロールに応じて浮かび上がる。
     クラスはJSが付与するためno-JSでは常時表示。同じ親の中では出現を
     70msずつ段差させる。完了後はクラスと遅延を外して各要素本来の
     hover transition（カードの持ち上がり等）に戻す */
  var motionOk = !( window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches );
  if (motionOk && 'IntersectionObserver' in window) {
    var revealTargets = document.querySelectorAll(
      '.sec-head, .featured .card, .grid3 .card, .news-list .news-item, .col-wrap .article,' +
      ' .prof, .profile-sec, .contact-cta, .kpi-grid .kpi, .timeline .tl-item, .sns-tiles .sns-btn'
    );
    if (revealTargets.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) { return; }
          en.target.classList.add('in');
          io.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
      Array.prototype.forEach.call(revealTargets, function (el) {
        var parent = el.parentElement;
        var n = parent.__kbRevealCount || 0;
        parent.__kbRevealCount = n + 1;
        el.classList.add('js-reveal');
        el.style.transitionDelay = Math.min(n * 70, 420) + 'ms';
        el.addEventListener('transitionend', function () {
          el.classList.remove('js-reveal', 'in');
          el.style.transitionDelay = '';
        }, { once: true });
        io.observe(el);
      });
    }
  }

  /* モバイルメニュー開閉（全画面オーバーレイ）
     ハンバーガー⇄×のモーフ、背景スクロールロック、
     リンクタップ・Escキーで閉じる */
  var btn = document.getElementById('menuBtn');
  var nav = document.getElementById('gnav');
  if (btn && nav) {
    var setMenu = function (open) {
      nav.classList.toggle('open', open);
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.documentElement.classList.toggle('menu-open', open);
    };
    btn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    nav.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) { setMenu(false); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); }
    });
  }

  /* URLコピー（シェアボタン）。表示文言は data 属性（日英対応） */
  document.querySelectorAll('.js-copy-url').forEach(function (el) {
    var idle = el.textContent;
    el.addEventListener('click', function () {
      navigator.clipboard.writeText(location.href).then(function () {
        el.textContent = el.dataset.copied || 'コピーしました';
        setTimeout(function () { el.textContent = idle; }, 1600);
      });
    });
  });

  /* 条件検索：スキルタグ「すべて表示」 */
  var tgl = document.getElementById('toggleSkills');
  if (tgl) {
    tgl.addEventListener('click', function () {
      document.querySelectorAll('.skill-extra').forEach(function (el) { el.classList.toggle('open'); });
      var opened = tgl.textContent === (tgl.dataset.close || '閉じる ▲');
      tgl.textContent = opened ? (tgl.dataset.open || 'すべて表示する ▼') : (tgl.dataset.close || '閉じる ▲');
    });
  }

  /* ヒーロービジュアル：ファーストビュー全面の背景格子を波打たせ、クリックした場所にポイントを打つ */
  var net = document.getElementById('heroNet');
  if (net) {
    var NS = 'http://www.w3.org/2000/svg';
    var stage = net.closest('.hero') || net.parentElement;
    var waves = document.getElementById('heroWaves');
    var dots = document.getElementById('heroDots');
    var links = document.getElementById('heroLinks');
    var cursorDot = document.getElementById('heroCursor');
    var INIT_DOTS = dots.children.length;
    var INIT_LINKS = links.children.length;
    var MAX_ADDED = 24;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* --- 背景格子の生成 ---
       viewBoxは高さ720固定・幅は実表示のアスペクト比から算出し、
       約94間隔の格子と初期ポイント（比率座標）をJSで組み直す。
       front-page.php の静的パスは no-JS／reduced-motion 時の
       フォールバック（1280×720想定）なので構図変更時は揃えること */
    var VB_H = 720, GRID_SP = 94, MARGIN = 16, C_OFF = 40;
    var vbW = 1280;
    var H_YS = [], V_XS = [], hPaths = [], vPaths = [];
    /* 初期ポイントの比率座標。横長=右カラムに本人写真があるため、ノードは
       左半分（コピー側）に寄せて人物と重ならないようにする。縦長=コピー下の余白 */
    var SEED_DOTS = [
      { fx: .10, fy: .26 }, { fx: .28, fy: .44 }, { fx: .17, fy: .64 },
      { fx: .38, fy: .30 }, { fx: .05, fy: .48 }
    ];
    var SEED_DOTS_PORTRAIT = [
      { fx: .26, fy: .84 }, { fx: .70, fy: .82 }, { fx: .50, fy: .94 },
      { fx: .16, fy: .96 }, { fx: .88, fy: .70 }
    ];

    var spread = function (min, max, step) {
      var n = Math.max(2, Math.round((max - min) / step)), arr = [], i;
      for (i = 0; i <= n; i++) { arr.push(min + (max - min) * i / n); }
      return arr;
    };
    var mkPath = function () {
      var p = document.createElementNS(NS, 'path');
      waves.appendChild(p);
      return p;
    };
    var lastW = 0, lastH = 0;
    var rebuild = function () {
      var r = net.getBoundingClientRect();
      if (!r.width || !r.height) { return; }
      /* iOSはスクロール中のツールバー開閉でもresizeが発火する。ヒーローの
         実寸が変わっていなければ何もしない（格子の全消去→再生成による
         スクロール中のちらつき・ブレを防ぐ） */
      var w = Math.round(r.width), h = Math.round(r.height);
      if ( w === lastW && h === lastH ) { return; }
      lastW = w;
      lastH = h;
      vbW = Math.round(VB_H * r.width / r.height);
      net.setAttribute('viewBox', '0 0 ' + vbW + ' ' + VB_H);
      H_YS = spread(-MARGIN, VB_H + MARGIN, GRID_SP);
      V_XS = spread(-MARGIN, vbW + MARGIN, GRID_SP);
      waves.textContent = '';
      hPaths = H_YS.map(mkPath);
      vPaths = V_XS.map(mkPath);
      /* 初期ポイントを比率→viewBox座標に配置し、先頭4点を折れ線で結ぶ */
      var seeds = r.width > r.height ? SEED_DOTS : SEED_DOTS_PORTRAIT;
      var seg = [];
      seeds.forEach(function (d, i) {
        var c = dots.children[i];
        if (!c) { return; }
        c.setAttribute('cx', Math.round(d.fx * vbW));
        c.setAttribute('cy', Math.round(d.fy * VB_H));
        if (i < 4) { seg.push(Math.round(d.fx * vbW) + ' ' + Math.round(d.fy * VB_H)); }
      });
      if (links.children[0]) { links.children[0].setAttribute('d', 'M' + seg.join(' L')); }
    };

    if (!reduced) {
      rebuild();
      var rsz = null;
      window.addEventListener('resize', function () {
        clearTimeout(rsz);
        rsz = setTimeout(rebuild, 200);
      });

      /* --- 波アニメーション：制御点をsin波で揺らす --- */
      var t0 = null;
      var wave = function (ts) {
        if (t0 === null) { t0 = ts; }
        var t = (ts - t0) / 1000;
        var cx1 = vbW / 3, cx2 = vbW * 2 / 3;
        hPaths.forEach(function (p, i) {
          var y = H_YS[i];
          var a = Math.sin(t * 1.0 + i * 0.9) * 15;
          var b = Math.sin(t * 1.0 + i * 0.9 + 2.4) * 15;
          var e1 = Math.sin(t * 0.8 + i) * 4;
          var e2 = Math.sin(t * 0.8 + i + 2) * 4;
          p.setAttribute('d', 'M-20 ' + (y + e1) + ' C ' + cx1 + ' ' + (y - C_OFF + a) + ', ' + cx2 + ' ' + (y + C_OFF + b) + ', ' + (vbW + 20) + ' ' + (y + e2));
        });
        vPaths.forEach(function (p, i) {
          var x = V_XS[i];
          var a = Math.sin(t * 0.85 + i * 1.1 + 1) * 15;
          var b = Math.sin(t * 0.85 + i * 1.1 + 3.4) * 15;
          p.setAttribute('d', 'M' + x + ' -20 C ' + (x - C_OFF + a) + ' 240, ' + (x + C_OFF + b) + ' 480, ' + x + ' ' + (VB_H + 20));
        });
        requestAnimationFrame(wave);
      };
      requestAnimationFrame(wave);
    }

    /* --- 座標変換（表示サイズ→viewBox） --- */
    var toSvg = function (e) {
      var r = net.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * vbW, y: (e.clientY - r.top) / r.height * VB_H };
    };
    /* リンク・ボタン・フォーム上ではポイント演出を出さない */
    var onUi = function (e) {
      return e.target.closest && e.target.closest('a,button,input,label,form');
    };

    /* --- ポイント演出（カーソル追従＋クリックで追加） ---
       SVGはpointer-events:noneの背景なのでヒーローセクション側で拾う。
       reduced-motion時は静的フォールバック表示のため座標変換が
       成立せず、演出ごと無効化する */
    if (!reduced) {
    stage.addEventListener('pointermove', function (e) {
      /* タッチではスクロール開始時に点が明滅して見えるため、追従表示はマウスのみ */
      if (e.pointerType !== 'mouse' || onUi(e)) { cursorDot.style.display = 'none'; return; }
      var p = toSvg(e);
      cursorDot.style.display = '';
      cursorDot.setAttribute('cx', p.x);
      cursorDot.setAttribute('cy', p.y);
    });
    stage.addEventListener('pointerleave', function () { cursorDot.style.display = 'none'; });
    stage.addEventListener('pointercancel', function () { cursorDot.style.display = 'none'; });

    /* クリックでポイントを打ち、最寄りのポイントと結ぶ */
    stage.addEventListener('click', function (e) {
      if (onUi(e)) { return; }
      var p = toSvg(e);

      var nearest = null, best = Infinity;
      dots.querySelectorAll('circle').forEach(function (c) {
        var dx = c.cx.baseVal.value - p.x;
        var dy = c.cy.baseVal.value - p.y;
        if (dx * dx + dy * dy < best) { best = dx * dx + dy * dy; nearest = c; }
      });
      if (nearest) {
        var ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', p.x);
        ln.setAttribute('y1', p.y);
        ln.setAttribute('x2', nearest.cx.baseVal.value);
        ln.setAttribute('y2', nearest.cy.baseVal.value);
        ln.setAttribute('stroke', '#C22740');
        ln.setAttribute('stroke-width', '1.6');
        ln.setAttribute('stroke-opacity', '.5');
        links.appendChild(ln);
      }

      var c2 = document.createElementNS(NS, 'circle');
      var r0 = 4 + Math.random() * 4;
      c2.setAttribute('cx', p.x);
      c2.setAttribute('cy', p.y);
      c2.setAttribute('fill', Math.random() < 0.5 ? '#C22740' : '#84192A');
      dots.appendChild(c2);
      var s0 = null;
      var grow = function (ts) {
        if (s0 === null) { s0 = ts; }
        var k = Math.min(1, (ts - s0) / 220);
        c2.setAttribute('r', r0 * (2 * k - k * k)); /* ease-out */
        if (k < 1) { requestAnimationFrame(grow); }
      };
      requestAnimationFrame(grow);

      /* 増えすぎ防止: 古い追加分（点と線のペア）から間引く */
      if (dots.children.length - INIT_DOTS > MAX_ADDED) { dots.removeChild(dots.children[INIT_DOTS]); }
      if (links.children.length - INIT_LINKS > MAX_ADDED) { links.removeChild(links.children[INIT_LINKS]); }
    });
    }
  }
})();
