// メディアの選択・アップロード（ライブラリ画面と、エディタ／アイキャッチの選択ダイアログで共用）
export interface MediaItem { id: number; key: string; url?: string; alt: string; content_type: string; size: number }

export async function listMedia(q = ""): Promise<MediaItem[]> {
  const res = await fetch(`/admin/api/media${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  if (!res.ok) throw new Error(`一覧を取得できません (${res.status})`);
  return ((await res.json()) as { media: MediaItem[] }).media;
}

export async function uploadFile(file: File): Promise<MediaItem> {
  const res = await fetch("/admin/api/media", {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream", "X-Kb-Admin": "1", "X-Filename": encodeURIComponent(file.name) },
    body: file,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `アップロードに失敗しました (${res.status})`);
  return data as MediaItem;
}

export const mediaUrl = (m: { key: string }) => `/media/${m.key}`;

/** 画像を選ぶダイアログ。選択したら {key, alt, url}、キャンセルなら null */
export function openPicker(): Promise<{ key: string; alt: string; url: string } | null> {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "picker";
    dlg.style.maxWidth = "760px";
    const bar = document.createElement("div"); bar.className = "bar";
    const search = document.createElement("input"); search.type = "text"; search.placeholder = "検索"; search.style.width = "200px";
    const file = document.createElement("input"); file.type = "file"; file.accept = "image/jpeg,image/png,image/gif,image/webp"; file.hidden = true;
    const up = document.createElement("button"); up.type = "button"; up.className = "btn primary"; up.textContent = "アップロード";
    const close = document.createElement("button"); close.type = "button"; close.className = "btn"; close.textContent = "閉じる";
    const msg = document.createElement("div"); msg.className = "picker-msg";
    const grid = document.createElement("div"); grid.className = "media-grid";
    bar.append(search, up, file, close); dlg.append(bar, msg, grid);
    document.body.appendChild(dlg);
    let done = false;
    const finish = (v: { key: string; alt: string; url: string } | null) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); };
    close.addEventListener("click", () => finish(null));
    dlg.addEventListener("cancel", () => finish(null));
    const render = async () => {
      try {
        const items = await listMedia(search.value.trim());
        grid.textContent = "";
        if (!items.length) grid.textContent = "画像がありません。";
        for (const m of items) {
          const b = document.createElement("button"); b.type = "button"; b.className = "media-cell";
          const img = document.createElement("img"); img.src = mediaUrl(m); img.alt = m.alt; img.loading = "lazy";
          const cap = document.createElement("span"); cap.textContent = m.key.split("/").pop() ?? m.key;
          b.append(img, cap);
          b.addEventListener("click", () => finish({ key: m.key, alt: m.alt, url: mediaUrl(m) }));
          grid.appendChild(b);
        }
      } catch (e) { msg.textContent = e instanceof Error ? e.message : String(e); }
    };
    let t: number | undefined;
    search.addEventListener("input", () => { window.clearTimeout(t); t = window.setTimeout(render, 250); });
    up.addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      const f = file.files?.[0]; if (!f) return;
      msg.textContent = "アップロード中…";
      try { const m = await uploadFile(f); finish({ key: m.key, alt: m.alt ?? "", url: mediaUrl(m) }); }
      catch (e) { msg.textContent = e instanceof Error ? e.message : String(e); }
    });
    dlg.showModal(); void render();
  });
}
