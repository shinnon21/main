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

  /* --- Lottieアバター（丸で囲まず“アバターがそのままいる”） ---
     FAB(右下)は常時idle。ヘッダーは会話状態で idle/thinking/answering を切替。
     lottie未使用時は透過ポスターのまま（setはno-op） */
  var mountAvatar = function (host, states) {
    if (!host || !cfg.avatar || typeof window.lottie === 'undefined') { return { set: function () {} }; }
    var cells = {}, first = null;
    states.forEach(function (key) {
      if (!cfg.avatar[key]) { return; }
      var cell = document.createElement('div');
      cell.className = 'kb-av-cell';
      host.appendChild(cell);
      var an = window.lottie.loadAnimation({ container: cell, renderer: 'svg', loop: true, autoplay: true, path: cfg.avatar[key] });
      cells[key] = cell;
      if (!first) { first = key; an.addEventListener('DOMLoaded', function () { host.classList.add('is-ready'); }); }
    });
    if (first) { cells[first].classList.add('on'); }
    return {
      set: function (key) {
        if (!cells[key]) { key = first; }
        Object.keys(cells).forEach(function (k) { cells[k].classList.toggle('on', k === key); });
      }
    };
  };
  mountAvatar(document.getElementById('kbFabAvatar'), ['idle']);
  var headAv = null; /* パネル初回オープン時に生成 */

  /* 会話履歴（送信APIのコンテキスト用）。タブ内で保持し言語別に分ける */
  var storeKey = 'kbChatHist_' + cfg.lang;
  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(storeKey) || '[]'); } catch (e) { history = []; }
  if (!Array.isArray(history)) { history = []; }
  var saveHistory = function () {
    try { sessionStorage.setItem(storeKey, JSON.stringify(history.slice(-10))); } catch (e) { /* private mode等は無視 */ }
  };

  /* テキスト中のURLをリンク化して parent に追加（テキストノードのみ＝XSS安全） */
  var linkify = function (parent, text) {
    /* URL末尾に句読点・括弧類を含めない（「〜（URL）。」のような回答文対策） */
    String(text).split(/(https?:\/\/[^\s<>「」（）()、。]+)/g).forEach(function (p, i) {
      if (i % 2 === 1) {
        var a = document.createElement('a');
        a.href = p;
        a.textContent = p.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        a.rel = 'noopener';
        if (p.indexOf(location.origin + '/') !== 0 && p !== location.origin) { a.target = '_blank'; }
        parent.appendChild(a);
      } else if (p) {
        parent.appendChild(document.createTextNode(p));
      }
    });
  };

  /* インライン装飾（**太字**）＋リンク。innerHTMLは使わずノード生成のみ */
  var appendInline = function (parent, text) {
    String(text).split(/\*\*([^*]+)\*\*/g).forEach(function (seg, i) {
      if (seg === '') { return; }
      if (i % 2 === 1) {
        var strong = document.createElement('strong');
        linkify(strong, seg);
        parent.appendChild(strong);
      } else {
        linkify(parent, seg);
      }
    });
  };

  /* 応答を最小Markdown（箇条書き・太字・改行）としてレンダリング。
     モデルが返す ** や * 記法をそのまま文字表示させないための整形 */
  var addMsg = function (role, text) {
    var el = document.createElement('div');
    el.className = 'kb-chat-msg ' + role;
    var ul = null, needBr = false;
    String(text).replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
      var bullet = line.match(/^\s*[-*]\s+(.*\S.*)$/); /* 「- 項目」「* 項目」を箇条書きに */
      if (bullet) {
        if (!ul) { ul = document.createElement('ul'); el.appendChild(ul); }
        var li = document.createElement('li');
        appendInline(li, bullet[1]);
        ul.appendChild(li);
        needBr = false;
        return;
      }
      ul = null;
      if (line.trim() === '') {
        if (el.childNodes.length) { el.appendChild(document.createElement('br')); }
        needBr = false;
        return;
      }
      if (needBr) { el.appendChild(document.createElement('br')); }
      appendInline(el, line);
      needBr = true;
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
      if (!headAv) { headAv = mountAvatar(document.getElementById('kbHeadAvatar'), ['idle', 'thinking', 'answering']); }
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
  var pending = false, talkTimer = null;
  var send = function (text) {
    text = String(text || '').trim();
    if (!text || pending) { return; }
    pending = true;
    root.classList.add('busy');
    if (headAv) { headAv.set('thinking'); }
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
        if (headAv) {
          headAv.set('answering'); /* 回答を“話している”間だけ answering ループ */
          clearTimeout(talkTimer);
          talkTimer = setTimeout(function () { headAv.set('idle'); }, Math.min(6000, Math.max(1500, reply.length * 45)));
        }
      } else if (headAv) {
        headAv.set('idle');
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
