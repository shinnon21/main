import { openPicker } from "./picker.ts";

const form = document.getElementById("profileForm") as HTMLFormElement | null;
if (form) {
  const msg = document.getElementById("profMsg")!, photo = document.getElementById("profPhoto") as HTMLImageElement;
  const thumb = form.elements.namedItem("thumbnail") as HTMLInputElement;
  const show = () => { photo.hidden = !thumb.value; photo.src = thumb.value ? `/media/${thumb.value}` : ""; };
  document.getElementById("profPick")!.addEventListener("click", async () => { const m = await openPicker(); if (m) { thumb.value = m.key; show(); } });
  document.getElementById("profClear")!.addEventListener("click", () => { thumb.value = ""; show(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fields: Record<string, string> = {};
    for (const el of Array.from(form.elements) as HTMLInputElement[]) if (el.name.startsWith("profile_")) fields[el.name] = el.value;
    const btn = form.querySelector<HTMLButtonElement>("button[type=submit]")!; btn.disabled = true;
    const r = await fetch("/admin/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields, thumbnail: thumb.value }) });
    btn.disabled = false;
    const d = r.ok ? null : await r.json().catch(() => null);
    msg.textContent = r.ok ? "保存しました" : `保存できませんでした: ${d?.error ?? r.status}`;
    msg.style.color = r.ok ? "#1a7f4b" : "#b3261e";
  });
}
