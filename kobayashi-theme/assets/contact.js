/* Kobayashi Portfolio — お問い合わせ：送信完了で画面をサンクス表示へ切り替える
   CF7 の wpcf7mailsent（メール送信成功）イベントを拾い、フォーム一式を
   #contactThanks に差し替える。文言はテンプレート側で日英出し分け済み。 */
(function () {
  'use strict';
  var main = document.getElementById('contactMain');
  var thanks = document.getElementById('contactThanks');
  if (!main || !thanks) { return; }

  document.addEventListener('wpcf7mailsent', function () {
    main.hidden = true;
    thanks.hidden = false;
    thanks.classList.add('is-in');

    /* 見出し（＋サンクス）が見えるようページ上部へスクロール */
    var top = 0, mv = document.querySelector('.page-mv');
    if (mv) { top = mv.getBoundingClientRect().top + window.pageYOffset - 12; }
    try { window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); }
    catch (e) { window.scrollTo(0, Math.max(0, top)); }

    /* スクリーンリーダー通知＆フォーカス移動 */
    var h = thanks.querySelector('h2');
    if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
  }, false);
})();
