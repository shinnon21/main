import { listMedia, mediaUrl, uploadFile, type MediaItem } from "./picker.ts";

const grid = document.getElementById("mediaGrid");
if (grid) init(grid);

function init(grid: HTMLElement) {
  const msg = document.getElementById("mediaMsg")!;
  const say = (t: string, kind: "ok" | "err" | "" = "") => { msg.textContent = t; msg.className = kind; };
  const search = document.getElementById("mediaSearch") as HTMLInputElement;
  const file = document.getElementById("mediaFile") as HTMLInputElement;
  const zone = document.getElementById("dropZone")!;

  async function render() {
    try {
      const items = await listMedia(search.value.trim());
      grid.textContent = "";
      if (!items.length) grid.textContent = "画像がありません。";
      for (const m of items) grid.appendChild(card(m));
    } catch (e) { say(e instanceof Error ? e.message : String(e), "err"); }
  }

  function card(m: MediaItem): HTMLElement {
    const d = document.createElement("div"); d.className = "media-card";
    const img = document.createElement("img"); img.src = mediaUrl(m); img.alt = m.alt; img.loading = "lazy";
    const name = document.createElement("div"); name.className = "mc-name"; name.textContent = m.key;
    const meta = document.createElement("div"); meta.className = "mc-meta"; meta.textContent = `${m.content_type} ／ ${(m.size / 1024).toFixed(0)} KB`;
    const alt = document.createElement("input"); alt.type = "text"; alt.value = m.alt; alt.placeholder = "代替テキスト（alt）"; alt.maxLength = 500;
    const row = document.createElement("div"); row.className = "mc-row";
    const save = btn("altを保存", async () => { await call("PUT", `/media/${m.id}`, { alt: alt.value }); say("保存しました", "ok"); });
    const copy = btn("URLをコピー", async () => { await navigator.clipboard.writeText(location.origin + mediaUrl(m)); say("URLをコピーしました", "ok"); });
    const del = btn("削除", async () => {
      if (!window.confirm("この画像を削除します。よろしいですか？")) return;
      const res = await fetch(`/admin/api/media/${m.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
      if (res.status === 204) { say("削除しました", "ok"); d.remove(); return; }
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.usage) throw new Error("使用中のため削除できません: " + data.usage.map((u: { title: string }) => u.title).join("、"));
      throw new Error((data && data.error) || `削除に失敗しました (${res.status})`);
    });
    del.classList.add("danger");
    row.append(save, copy, del);
    d.append(img, name, meta, alt, row);
    return d;
  }

  function btn(label: string, fn: () => Promise<void>) {
    const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = label;
    b.addEventListener("click", async () => { b.disabled = true; try { await fn(); } catch (e) { say(e instanceof Error ? e.message : String(e), "err"); } finally { b.disabled = false; } });
    return b;
  }

  async function call(method: string, path: string, body: unknown) {
    const res = await fetch(`/admin/api${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `エラー (${res.status})`);
    return data;
  }

  async function uploadAll(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      say(`アップロード中: ${f.name}`);
      try { await uploadFile(f); say(`アップロードしました: ${f.name}`, "ok"); } catch (e) { say(`${f.name}: ${e instanceof Error ? e.message : String(e)}`, "err"); break; }
    }
    await render();
  }

  document.getElementById("mediaUpload")?.addEventListener("click", () => file.click());
  file.addEventListener("change", () => { if (file.files?.length) void uploadAll(file.files); file.value = ""; });
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); if (e.dataTransfer?.files.length) void uploadAll(e.dataTransfer.files); });
  let t: number | undefined;
  search.addEventListener("input", () => { window.clearTimeout(t); t = window.setTimeout(render, 250); });
  void render();
}
