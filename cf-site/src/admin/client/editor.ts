import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

interface Initial { type: string; id: number | null; modified_at: string | null; content: string; content_en: string; kpi_results: { label: string; value: string }[]; kpi_results_en: { label: string; value: string }[] }

const form = document.getElementById("postForm") as HTMLFormElement | null;
if (form) init(form);

function init(form: HTMLFormElement) {
  const initial = JSON.parse(document.getElementById("initial")!.textContent!) as Initial;
  let modifiedAt = initial.modified_at;
  const msg = document.getElementById("msg")!;
  const say = (text: string, kind: "ok" | "err" | "" = "") => { msg.textContent = text; msg.className = kind; };
  const $ = <T extends HTMLElement>(sel: string) => form.querySelector<T>(sel);

  // タブ
  form.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    form.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    form.querySelectorAll<HTMLElement>("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  }));

  // Tiptap
  const editors: Record<string, Editor> = {};
  form.querySelectorAll<HTMLElement>("[data-tiptap]").forEach((el) => {
    const key = el.dataset.tiptap as "content" | "content_en";
    const ed = new Editor({
      element: el.querySelector<HTMLElement>(".tt-body")!,
      extensions: [StarterKit.configure({ link: { openOnClick: false } }), Image],
      content: initial[key] ?? "",
    });
    editors[key] = ed;
    const bar = el.querySelector<HTMLElement>(".tt-bar")!;
    const buttons: [string, () => void, string?][] = [
      ["H2", () => ed.chain().focus().toggleHeading({ level: 2 }).run(), "heading2"], ["H3", () => ed.chain().focus().toggleHeading({ level: 3 }).run(), "heading3"],
      ["B", () => ed.chain().focus().toggleBold().run(), "bold"], ["I", () => ed.chain().focus().toggleItalic().run(), "italic"],
      ["• リスト", () => ed.chain().focus().toggleBulletList().run(), "bulletList"], ["1. リスト", () => ed.chain().focus().toggleOrderedList().run(), "orderedList"],
      ["引用", () => ed.chain().focus().toggleBlockquote().run(), "blockquote"],
      ["リンク", () => { const url = window.prompt("リンク先URL（空で解除）", ed.getAttributes("link").href ?? "https://"); if (url === null) return; if (!url) ed.chain().focus().unsetLink().run(); else ed.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); }, "link"],
      ["画像URL", () => { const src = window.prompt("画像のURL（/media/… または https://…）"); if (src) ed.chain().focus().setImage({ src }).run(); }],
      ["区切り線", () => ed.chain().focus().setHorizontalRule().run()],
      ["↶", () => ed.chain().focus().undo().run()], ["↷", () => ed.chain().focus().redo().run()],
    ];
    for (const [label, fn, mark] of buttons) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.addEventListener("click", fn);
      if (mark) ed.on("transaction", () => b.classList.toggle("on", ed.isActive(mark.replace(/\d$/, "") === "heading" ? "heading" : mark, mark.startsWith("heading") ? { level: Number(mark.slice(-1)) } : undefined)));
      bar.appendChild(b);
    }
  });

  // KPI 行
  const addKpi = (key: string, row?: { label: string; value: string }) => {
    const box = form.querySelector<HTMLElement>(`[data-kpi="${key}"]`); if (!box) return;
    const d = document.createElement("div"); d.className = "kpi-row";
    for (const f of ["label", "value"] as const) { const i = document.createElement("input"); i.type = "text"; i.placeholder = f === "label" ? "ラベル" : "値"; i.dataset.f = f; i.value = row?.[f] ?? ""; d.appendChild(i); }
    const x = document.createElement("button"); x.type = "button"; x.className = "btn"; x.textContent = "削除"; x.addEventListener("click", () => d.remove()); d.appendChild(x);
    box.appendChild(d);
  };
  for (const key of ["kpi_results", "kpi_results_en"] as const) initial[key].forEach((r) => addKpi(key, r));
  form.querySelectorAll<HTMLButtonElement>("[data-add-kpi]").forEach((b) => b.addEventListener("click", () => addKpi(b.dataset.addKpi!)));

  const val = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";

  function collect(statusOverride?: string) {
    const meta: Record<string, unknown> = {};
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[name^='meta.']").forEach((el) => {
      const k = el.name.slice(5);
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        if (k === "scope") { if (el.checked) ((meta.scope ??= []) as string[]).push(el.value); } else meta[k] = el.checked ? "1" : "0";
      } else meta[k] = el.value;
    });
    for (const key of ["kpi_results", "kpi_results_en"]) {
      const rows = [...form.querySelectorAll<HTMLElement>(`[data-kpi="${key}"] .kpi-row`)].map((r) => ({ label: r.querySelector<HTMLInputElement>("[data-f=label]")!.value, value: r.querySelector<HTMLInputElement>("[data-f=value]")!.value }));
      if (rows.length) meta[key] = rows;
    }
    const terms: { taxonomy: string; slug: string }[] = [];
    form.querySelectorAll<HTMLInputElement>("[data-term]").forEach((el) => { if (el.checked && el.value) terms.push({ taxonomy: el.dataset.term!, slug: el.value }); });
    return {
      type: initial.type, title: val("title"), title_en: val("title_en"), slug: val("slug"), status: statusOverride ?? val("status"),
      published_at: val("published_at") || null, excerpt: val("excerpt"), excerpt_en: val("excerpt_en"),
      content: editors.content?.getHTML() ?? "", content_en: editors.content_en?.getHTML() ?? "",
      thumbnail: val("thumbnail") || null, meta, terms, ...(initial.id ? { expected_modified_at: modifiedAt } : {}),
    };
  }

  const api = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`/admin/api${path}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `エラー (${res.status})`);
    return data;
  };
  const busy = (on: boolean) => form.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((b) => (b.disabled = on));
  const nowLabel = () => new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  async function save(statusOverride?: string) {
    if (!form.reportValidity()) return;
    busy(true); say("保存中…");
    try {
      if (initial.id) {
        const r = await api("PUT", `/posts/${initial.id}`, collect(statusOverride));
        modifiedAt = r.modified_at;
        if (statusOverride) (form.elements.namedItem("status") as HTMLSelectElement).value = statusOverride;
        say(`保存しました（${nowLabel()}）`, "ok");
      } else {
        const r = await api("POST", "/posts", collect(statusOverride));
        location.href = `/admin/${initial.type}/${r.id}/`;
      }
    } catch (e) { say(e instanceof Error ? e.message : String(e), "err"); }
    finally { busy(false); }
  }

  form.querySelector("[data-act=save]")?.addEventListener("click", () => save());
  form.querySelector("[data-act=publish]")?.addEventListener("click", () => save("publish"));
  form.querySelector("[data-act=draft]")?.addEventListener("click", () => save("draft"));
  form.querySelector("[data-act=trash]")?.addEventListener("click", async () => {
    if (!window.confirm("ゴミ箱に移動します。よろしいですか？（履歴から復元できます）")) return;
    busy(true);
    try { await api("DELETE", `/posts/${initial.id}`); location.href = `/admin/${initial.type}/`; }
    catch (e) { say(e instanceof Error ? e.message : String(e), "err"); busy(false); }
  });

  // 履歴
  const dlg = document.getElementById("history") as HTMLDialogElement;
  const list = document.getElementById("historyList")!;
  document.getElementById("historyClose")?.addEventListener("click", () => dlg.close());
  form.querySelector("[data-act=history]")?.addEventListener("click", async () => {
    try {
      const { revisions } = await api("GET", `/posts/${initial.id}/revisions`) as { revisions: { id: number; saved_at: string; saved_by: string }[] };
      list.textContent = "";
      if (!revisions.length) list.textContent = "履歴はありません。";
      for (const r of revisions) {
        const li = document.createElement("li");
        const label = document.createElement("span"); label.textContent = `${r.saved_at.slice(0, 19)} UTC ／ ${r.saved_by}`;
        const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = "この時点に復元";
        b.addEventListener("click", async () => {
          if (!window.confirm("この時点の内容に戻します（現在の内容も履歴に残ります）。")) return;
          try { await api("POST", `/posts/${initial.id}/restore/${r.id}`, {}); location.reload(); } catch (e) { say(e instanceof Error ? e.message : String(e), "err"); dlg.close(); }
        });
        li.append(label, b); list.appendChild(li);
      }
      dlg.showModal();
    } catch (e) { say(e instanceof Error ? e.message : String(e), "err"); }
  });
}
