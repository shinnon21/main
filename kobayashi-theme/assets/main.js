/* Kobayashi Portfolio — main.js */
(function () {
  'use strict';

  /* キーワードティッカー：無限ループ用に複製 */
  var lane = document.getElementById('tickerLane');
  if (lane && !lane.dataset.cloned) {
    lane.innerHTML += lane.innerHTML;
    lane.dataset.cloned = '1';
  }

  /* モバイルメニュー開閉 */
  var btn = document.getElementById('menuBtn');
  var nav = document.getElementById('gnav');
  if (btn && nav) {
    btn.addEventListener('click', function () { nav.classList.toggle('open'); });
  }

  /* URLコピー（シェアボタン） */
  document.querySelectorAll('.js-copy-url').forEach(function (el) {
    el.addEventListener('click', function () {
      navigator.clipboard.writeText(location.href).then(function () {
        el.textContent = 'コピーしました';
        setTimeout(function () { el.textContent = 'URLコピー'; }, 1600);
      });
    });
  });

  /* 条件検索：スキルタグ「すべて表示」 */
  var tgl = document.getElementById('toggleSkills');
  if (tgl) {
    tgl.addEventListener('click', function () {
      document.querySelectorAll('.skill-extra').forEach(function (el) { el.classList.toggle('open'); });
      tgl.textContent = tgl.textContent.indexOf('すべて') !== -1 ? '閉じる ▲' : 'すべて表示する ▼';
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
    /* 初期ポイントの比率座標。横長=コピー右の余白／縦長=コピー下の余白に置く */
    var SEED_DOTS = [
      { fx: .56, fy: .30 }, { fx: .78, fy: .46 }, { fx: .64, fy: .64 },
      { fx: .42, fy: .70 }, { fx: .86, fy: .20 }
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
    var rebuild = function () {
      var r = net.getBoundingClientRect();
      if (!r.width || !r.height) { return; }
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
      if (onUi(e)) { cursorDot.style.display = 'none'; return; }
      var p = toSvg(e);
      cursorDot.style.display = '';
      cursorDot.setAttribute('cx', p.x);
      cursorDot.setAttribute('cy', p.y);
    });
    stage.addEventListener('pointerleave', function () { cursorDot.style.display = 'none'; });

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
