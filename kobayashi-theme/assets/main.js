/* Kobayashi Portfolio — main.js */
(function () {
  'use strict';

  /* ヘッダー日付表示 */
  var today = document.getElementById('today');
  if (today) {
    var d = new Date();
    var z = function (n) { return ('0' + n).slice(-2); };
    today.textContent = d.getFullYear() + '.' + z(d.getMonth() + 1) + '.' + z(d.getDate());
  }

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
})();
