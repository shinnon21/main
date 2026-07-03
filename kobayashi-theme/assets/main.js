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

  /* ヒーロービジュアル：格子を波打たせ、クリックした場所にポイントを打つ */
  var net = document.getElementById('heroNet');
  if (net) {
    var NS = 'http://www.w3.org/2000/svg';
    var waves = document.getElementById('heroWaves');
    var dots = document.getElementById('heroDots');
    var links = document.getElementById('heroLinks');
    var cursorDot = document.getElementById('heroCursor');
    var INIT_DOTS = dots.children.length;
    var INIT_LINKS = links.children.length;
    var MAX_ADDED = 24;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* --- 波アニメーション（横5本・縦4本の制御点をsin波で揺らす） --- */
    var paths = waves.querySelectorAll('path');
    if (!reduced) {
      var t0 = null;
      var wave = function (ts) {
        if (t0 === null) { t0 = ts; }
        var t = (ts - t0) / 1000;
        var i, y, x, a, b, e1, e2;
        for (i = 0; i < 5; i++) {
          y = 60 * (i + 1);
          a = Math.sin(t * 1.0 + i * 0.9) * 13;
          b = Math.sin(t * 1.0 + i * 0.9 + 2.4) * 13;
          e1 = Math.sin(t * 0.8 + i) * 3;
          e2 = Math.sin(t * 0.8 + i + 2) * 3;
          paths[i].setAttribute('d', 'M0 ' + (y + e1) + ' C 120 ' + (y - 40 + a) + ', 280 ' + (y + 40 + b) + ', 400 ' + (y + e2));
        }
        for (i = 0; i < 4; i++) {
          x = 60 + 80 * i;
          a = Math.sin(t * 0.85 + i * 1.1 + 1) * 13;
          b = Math.sin(t * 0.85 + i * 1.1 + 3.4) * 13;
          paths[5 + i].setAttribute('d', 'M' + x + ' 0 C ' + (x - 40 + a) + ' 120, ' + (x + 40 + b) + ' 240, ' + x + ' 360');
        }
        requestAnimationFrame(wave);
      };
      requestAnimationFrame(wave);
    }

    /* --- 座標変換（表示サイズ→viewBox） --- */
    var toSvg = function (e) {
      var r = net.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * 400, y: (e.clientY - r.top) / r.height * 360 };
    };

    /* --- カーソル追従の予告ポイント --- */
    net.addEventListener('pointermove', function (e) {
      var p = toSvg(e);
      cursorDot.style.display = '';
      cursorDot.setAttribute('cx', p.x);
      cursorDot.setAttribute('cy', p.y);
    });
    net.addEventListener('pointerleave', function () { cursorDot.style.display = 'none'; });

    /* --- クリックでポイントを打ち、最寄りのポイントと結ぶ --- */
    net.addEventListener('click', function (e) {
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
      if (reduced) {
        c2.setAttribute('r', r0);
      } else {
        var s0 = null;
        var grow = function (ts) {
          if (s0 === null) { s0 = ts; }
          var k = Math.min(1, (ts - s0) / 220);
          c2.setAttribute('r', r0 * (2 * k - k * k)); /* ease-out */
          if (k < 1) { requestAnimationFrame(grow); }
        };
        requestAnimationFrame(grow);
      }

      /* 増えすぎ防止: 古い追加分（点と線のペア）から間引く */
      if (dots.children.length - INIT_DOTS > MAX_ADDED) { dots.removeChild(dots.children[INIT_DOTS]); }
      if (links.children.length - INIT_LINKS > MAX_ADDED) { links.removeChild(links.children[INIT_LINKS]); }
    });
  }
})();
