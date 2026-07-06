/* Kobayashi Portfolio — AIチャットボット ウィジェット */
(function () {
  'use strict';

  var cfg = window.kbChatCfg;
  var root = document.getElementById('kbChat');
  if (!cfg || !root) { return; }

  var fab = document.getElementById('kbChatFab');
  var panel = document.getElementById('kbChatPanel');
  var body = document.getElementById('kbChatBody');
  var form = document.getElementById('kbChatForm');
  var input = document.getElementById('kbChatInput');
  var closeBtn = document.getElementById('kbChatClose');
  var suggests = document.getElementById('kbChatSuggests');

  /* 会話履歴（送信APIのコンテキスト用）。タブ内で保持し言語別に分ける */
  var storeKey = 'kbChatHist_' + cfg.lang;
  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(storeKey) || '[]'); } catch (e) { history = []; }
  if (!Array.isArray(history)) { history = []; }
  var saveHistory = function () {
    try { sessionStorage.setItem(storeKey, JSON.stringify(history.slice(-10))); } catch (e) { /* private mode等は無視 */ }
  };

  /* テキスト→メッセージ要素（エスケープ済みテキストにURLリンクのみ許可） */
  var addMsg = function (role, text) {
    var el = document.createElement('div');
    el.className = 'kb-chat-msg ' + role;
    /* URL末尾に句読点・括弧類を含めない（「〜（URL）。」のような回答文対策） */
    var parts = String(text).split(/(https?:\/\/[^\s<>「」（）()、。]+)/g);
    parts.forEach(function (p, i) {
      if (i % 2 === 1) {
        var a = document.createElement('a');
        a.href = p;
        a.textContent = p.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        a.rel = 'noopener';
        if (p.indexOf(location.origin + '/') !== 0 && p !== location.origin) { a.target = '_blank'; }
        el.appendChild(a);
      } else if (p) {
        p.split('\n').forEach(function (line, j) {
          if (j > 0) { el.appendChild(document.createElement('br')); }
          el.appendChild(document.createTextNode(line));
        });
      }
    });
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  };

  /* 保存済み履歴を復元（初期メッセージ・サジェストの後ろに続ける） */
  history.forEach(function (h) { addMsg(h.role === 'model' ? 'model' : 'user', h.text); });

  /* 開閉 */
  var setOpen = function (open) {
    panel.hidden = !open;
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    root.classList.toggle('open', open);
    if (open) {
      body.scrollTop = body.scrollHeight;
      input.focus();
    } else {
      fab.focus(); /* dialogを閉じたら起点へフォーカスを返す */
    }
  };
  fab.addEventListener('click', function () { setOpen(panel.hidden); });
  closeBtn.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) { setOpen(false); }
  });

  /* 送信 */
  var pending = false;
  var send = function (text) {
    text = String(text || '').trim();
    if (!text || pending) { return; }
    pending = true;
    root.classList.add('busy');
    if (suggests) { suggests.remove(); suggests = null; }
    addMsg('user', text);
    var sent = history.slice(-10);
    history.push({ role: 'user', text: text });
    saveHistory();
    input.value = '';

    var typing = document.createElement('div');
    typing.className = 'kb-chat-msg model kb-chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    var done = function (reply, isError) {
      typing.remove();
      addMsg('model', reply);
      if (!isError) {
        history.push({ role: 'model', text: reply });
        saveHistory();
      }
      pending = false;
      root.classList.remove('busy');
    };

    fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: sent, lang: cfg.lang })
    }).then(function (res) {
      return res.json().then(function (json) {
        if (res.ok && json && json.reply) { done(json.reply, false); return; }
        done(res.status === 429 ? cfg.strings.limited : cfg.strings.error, true);
      });
    }).catch(function () {
      done(cfg.strings.error, true);
    });
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    send(input.value);
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.kb-chat-suggest');
    if (b) { send(b.textContent); }
  });
})();
