interface Term { id: number; taxonomy: string; slug: string; name: string; uses: number }
const msg = document.getElementById("termsMsg")!;
const say = (t: string, ok = true) => { msg.textContent = t; msg.style.color = ok ? "#1a7f4b" : "#b3261e"; };
const hdr = { "Content-Type": "application/json" };

async function call(method: string, path: string, body?: unknown) {
  const r = await fetch(`/admin/api${path}`, { method, headers: hdr, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  return { r, data };
}
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };

function row(t: Term): HTMLTableRowElement {
  const tr = el("tr");
  const nameTd = el("td"), input = el("input"); input.type = "text"; input.value = t.name; input.maxLength = 100; input.setAttribute("aria-label", "名前"); nameTd.append(input);
  const slugTd = el("td", t.slug), usesTd = el("td", String(t.uses)), act = el("td");
  const save = el("button", "名前を保存"); save.className = "btn"; save.type = "button";
  save.onclick = async () => {
    save.disabled = true;
    const { r, data } = await call("PUT", `/terms/${t.id}`, { name: input.value });
    save.disabled = false;
    say(r.ok ? "保存しました" : `保存できませんでした: ${data?.error ?? r.status}`, r.ok);
  };
  const del = el("button", "削除"); del.className = "btn danger"; del.type = "button"; del.style.marginLeft = "6px";
  del.onclick = async () => {
    if (!confirm(`「${t.name}」を削除します。よろしいですか？`)) return;
    const { r, data } = await call("DELETE", `/terms/${t.id}`);
    if (r.status === 409) return say(`「${t.name}」は ${data?.count ?? ""} 件の記事で使用中のため削除できません`, false);
    if (!r.ok) return say(`削除できませんでした: ${data?.error ?? r.status}`, false);
    tr.remove(); say("削除しました");
  };
  act.append(save, del);
  tr.append(nameTd, slugTd, usesTd, act);
  return tr;
}

async function load() {
  const { r, data } = await call("GET", "/terms");
  if (!r.ok) return say("読み込めませんでした", false);
  for (const sec of document.querySelectorAll<HTMLElement>("section[data-tax]")) {
    const body = sec.querySelector(".terms-body")!; body.replaceChildren();
    for (const t of (data.terms as Term[]).filter((x) => x.taxonomy === sec.dataset.tax)) body.append(row(t));
  }
}
for (const sec of document.querySelectorAll<HTMLElement>("section[data-tax]")) {
  sec.querySelector<HTMLFormElement>(".term-add")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement, input = form.elements.namedItem("name") as HTMLInputElement;
    const { r, data } = await call("POST", "/terms", { taxonomy: sec.dataset.tax, name: input.value });
    if (!r.ok) return say(r.status === 409 ? "同じスラッグの分類が既にあります" : `追加できませんでした: ${data?.error ?? r.status}`, false);
    input.value = ""; say("追加しました"); await load();
  });
}
load();
