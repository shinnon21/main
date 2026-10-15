interface Grant { id: string; client: string; createdAt: number; expiresAt: number | null }
const body = document.getElementById("grantsBody")!, msg = document.getElementById("mcpMsg")!;
const say = (t: string, ok = true) => { msg.textContent = t; msg.style.color = ok ? "#1a7f4b" : "#b3261e"; };
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
const fmt = (sec: number | null) => (sec ? new Date(sec * 1000).toLocaleString("ja-JP") : "—");

async function load() {
  const r = await fetch("/admin/mcp/api/grants");
  if (!r.ok) { body.replaceChildren(); const tr = el("tr"); const td = el("td", "読み込めませんでした"); td.colSpan = 4; tr.append(td); body.append(tr); return; }
  const { grants } = (await r.json()) as { grants: Grant[] };
  body.replaceChildren();
  if (!grants.length) { const tr = el("tr"); const td = el("td", "接続中のClaudeはありません。"); td.colSpan = 4; tr.append(td); body.append(tr); return; }
  for (const g of grants) {
    const tr = el("tr"), act = el("td"), btn = el("button", "取り消す");
    btn.className = "btn danger"; btn.type = "button";
    btn.onclick = async () => {
      if (!confirm(`「${g.client}」の接続を取り消します。よろしいですか？`)) return;
      btn.disabled = true;
      const res = await fetch("/admin/mcp/api/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: g.id }) });
      if (res.ok) { say("取り消しました"); await load(); } else { btn.disabled = false; say("取り消せませんでした", false); }
    };
    act.append(btn);
    tr.append(el("td", g.client), el("td", fmt(g.createdAt)), el("td", fmt(g.expiresAt)), act);
    body.append(tr);
  }
}
load();
