// お問い合わせフォーム: Turnstile を描画し、JSONで送信。成功したらフォーム一式を全画面サンクスに差し替える
declare global { interface Window { turnstile?: { render(el: Element, o: Record<string, unknown>): string; reset(id?: string): void } } }

const form = document.getElementById("contactForm") as HTMLFormElement | null;
if (form) init(form);

function init(form: HTMLFormElement) {
  const msg = JSON.parse(form.dataset.msg ?? "{}") as Record<string, string>;
  const lang = form.dataset.lang === "en" ? "en" : "ja";
  const sendLabel = form.querySelector<HTMLButtonElement>(".cf-submit")!.textContent ?? "";
  const sendingLabel = form.dataset.sending ?? "…";
  const btn = form.querySelector<HTMLButtonElement>(".cf-submit")!;
  const out = form.querySelector<HTMLElement>(".cf-response")!;
  const main = document.getElementById("contactMain")!;
  const thanks = document.getElementById("contactThanks")!;
  const siteKey = form.dataset.sitekey ?? "";
  let widgetId: string | undefined;
  let token = "";

  const widget = form.querySelector<HTMLElement>(".cf-turnstile-widget");
  const mount = () => {
    if (!widget || !siteKey || widgetId) return;
    if (!window.turnstile) { window.setTimeout(mount, 200); return; }
    widgetId = window.turnstile.render(widget, { sitekey: siteKey, callback: (t: string) => { token = t; }, "expired-callback": () => { token = ""; }, "error-callback": () => { token = ""; } });
  };
  mount();

  const tips = () => form.querySelectorAll<HTMLElement>("[data-tip]");
  const clear = () => { tips().forEach((t) => { t.textContent = ""; }); out.hidden = true; out.textContent = ""; };
  const show = (text: string) => { out.textContent = text; out.hidden = false; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear();
    const f = form.elements;
    const val = (n: string) => (f.namedItem(n) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    const payload = {
      name: val("name"), email: val("email"), company: val("company"), kind: val("kind"), message: val("message"), website: val("website"),
      consent: (f.namedItem("consent") as HTMLInputElement).checked, lang, turnstile: token,
    };
    btn.disabled = true; btn.textContent = sendingLabel;
    try {
      const res = await fetch(form.dataset.endpoint ?? "/api/contact/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        main.hidden = true; thanks.hidden = false;
        window.scrollTo({ top: Math.max(0, thanks.getBoundingClientRect().top + window.scrollY - 120), behavior: "smooth" });
        return;
      }
      if (res.status === 400 && data.errors) {
        for (const [k, v] of Object.entries<string>(data.errors)) { const t = form.querySelector<HTMLElement>(`[data-tip="${k}"]`); if (t) t.textContent = v; }
        show(msg.invalid ?? "");
      } else if (res.status === 400 && data.error === "challenge_failed") { show(msg.challenge ?? ""); }
      else if (res.status === 429) { show(msg.limited ?? ""); }
      else if (res.status === 503) { show(msg.notConfigured ?? ""); }
      else { show(msg.network ?? ""); }
      if (widgetId && window.turnstile) { window.turnstile.reset(widgetId); token = ""; }
    } catch { show(msg.network ?? ""); if (widgetId && window.turnstile) { window.turnstile.reset(widgetId); token = ""; } }
    finally { btn.disabled = false; btn.textContent = sendLabel; }
  });
}
export {};
