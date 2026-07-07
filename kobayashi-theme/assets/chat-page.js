/* Kobayashi Portfolio — 全画面AIチャットページ（キャラアバター連動） */
(function () {
  'use strict';

  var cfg = window.kbChatCfg;
  var form = document.getElementById('kbcForm');
  var input = document.getElementById('kbcInput');
  var log = document.getElementById('kbcLog');
  var avatar = document.getElementById('kbcAvatar');
  if (!cfg || !form || !log || !input) { return; }
  var suggests = document.getElementById('kbcSuggests');

  /* 会話履歴（タブ内・言語別） */
  var storeKey = 'kbcHist_' + cfg.lang;
  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(storeKey) || '[]'); } catch (e) { history = []; }
  if (!Array.isArray(history)) { history = []; }
  var saveHistory = function () {
    try { sessionStorage.setItem(storeKey, JSON.stringify(history.slice(-10))); } catch (e) { /* private mode等は無視 */ }
  };

  /* --- 最小Markdownレンダラー（chatbot.js と同仕様。innerHTML不使用＝XSS安全） --- */
  var linkify = function (parent, text) {
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
  var addMsg = function (role, text) {
    var el = document.createElement('div');
    el.className = 'kb-chat-msg ' + role;
    var ul = null, needBr = false;
    String(text).replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
      var bullet = line.match(/^\s*[-*]\s+(.*\S.*)$/);
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
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };

  /* 保存済み履歴を復元 */
  history.forEach(function (h) { addMsg(h.role === 'model' ? 'model' : 'user', h.text); });

  /* アバターの状態（idle / thinking / talking）を切り替える */
  var setState = function (s) {
    if (!avatar) { return; }
    avatar.classList.toggle('is-thinking', s === 'thinking');
    avatar.classList.toggle('is-talking', s === 'talking');
  };

  var pending = false, talkTimer = null;
  var send = function (text) {
    text = String(text || '').trim();
    if (!text || pending) { return; }
    pending = true;
    if (suggests) { suggests.remove(); suggests = null; }
    addMsg('user', text);
    var sent = history.slice(-10);
    history.push({ role: 'user', text: text });
    saveHistory();
    input.value = '';
    setState('thinking'); /* 考えている表情 */

    var typing = document.createElement('div');
    typing.className = 'kb-chat-msg model kb-chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    var finish = function (reply, isError) {
      typing.remove();
      addMsg('model', reply);
      if (!isError) {
        history.push({ role: 'model', text: reply });
        saveHistory();
        setState('talking'); /* 回答を“話している”間だけ口を動かす */
        clearTimeout(talkTimer);
        talkTimer = setTimeout(function () { setState('idle'); }, Math.min(6000, Math.max(1800, reply.length * 45)));
      } else {
        setState('idle');
      }
      pending = false;
    };

    fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: sent, lang: cfg.lang })
    }).then(function (res) {
      return res.json().then(function (json) {
        if (res.ok && json && json.reply) { finish(json.reply, false); return; }
        finish(res.status === 429 ? cfg.strings.limited : cfg.strings.error, true);
      });
    }).catch(function () {
      finish(cfg.strings.error, true);
    });
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    send(input.value);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#kbcChat .kb-chat-suggest');
    if (b) { send(b.textContent); }
  });
})();
