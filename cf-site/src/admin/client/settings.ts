const form = document.getElementById("settingsForm") as HTMLFormElement, msg = document.getElementById("setMsg")!;
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
  const sns: Record<string, string> = {};
  for (const k of ["linkedin", "facebook", "x", "instagram", "note"]) sns[k] = v(`sns_${k}`);
  const btn = form.querySelector("button")!; btn.disabled = true;
  const r = await fetch("/admin/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blogname: v("blogname"), blogdescription: v("blogdescription"), sns }) });
  btn.disabled = false;
  const d = r.ok ? null : await r.json().catch(() => null);
  msg.textContent = r.ok ? "保存しました" : `保存できませんでした: ${d?.error ?? r.status}`;
  msg.style.color = r.ok ? "#1a7f4b" : "#b3261e";
});
