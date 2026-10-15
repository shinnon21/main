import type { Lang } from "./i18n.ts";

/** 保存される種別（日本語）と、英語画面のラベル */
export const KINDS = ["お仕事のご依頼・ご相談", "実績に関するお問い合わせ", "取材・登壇のご依頼", "その他"] as const;
export const KIND_LABELS_EN = ["Work inquiry or consulting", "Question about my works", "Interview or speaking request", "Other"] as const;

export interface ContactClean { name: string; email: string; company: string; kind: string; message: string; lang: Lang; bot: boolean }
export type ContactResult = { ok: true; value: ContactClean } | { ok: false; errors: Record<string, string> };

const CTRL = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f]", "g");
const CTRL_KEEP_NL = new RegExp("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f]", "g");
const oneLine = (s: string) => s.replace(CTRL, " ").replace(/\s+/g, " ").trim();
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

const MSG = {
  ja: { name: "氏名を入力してください（100文字以内）", email: "正しいメールアドレスを入力してください", company: "会社名・所属は100文字以内で入力してください", kind: "お問い合わせ種別を選択してください", message: "お問い合わせ内容を入力してください（5000文字以内）", consent: "プライバシーポリシーへの同意が必要です", body: "入力内容を確認してください" },
  en: { name: "Please enter your name (up to 100 characters)", email: "Please enter a valid email address", company: "Company must be 100 characters or fewer", kind: "Please select an inquiry type", message: "Please enter your message (up to 5000 characters)", consent: "You need to agree to the privacy policy", body: "Please check your input" },
} as const;

export function validateContact(raw: unknown): ContactResult {
  const lang: Lang = raw && typeof raw === "object" && (raw as Record<string, unknown>).lang === "en" ? "en" : "ja";
  const m = MSG[lang];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: { _: m.body } };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const errors: Record<string, string> = {};

  const name = oneLine(str(r.name));
  if (!name || name.length > 100) errors.name = m.name;
  const email = str(r.email).trim().toLowerCase();
  if (!email || email.length > 254 || CTRL.test(email) || !EMAIL_RE.test(email)) errors.email = m.email;
  const company = oneLine(str(r.company));
  if (company.length > 100) errors.company = m.company;
  const kindRaw = str(r.kind).trim();
  const kindIdx = (KINDS as readonly string[]).indexOf(kindRaw) >= 0 ? (KINDS as readonly string[]).indexOf(kindRaw) : (KIND_LABELS_EN as readonly string[]).indexOf(kindRaw);
  if (kindIdx < 0) errors.kind = m.kind;
  const message = str(r.message).replace(/\r\n?/g, "\n").replace(CTRL_KEEP_NL, "").trim();
  if (!message || message.length > 5000) errors.message = m.message;
  if (r.consent !== true) errors.consent = m.consent;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, email, company, kind: KINDS[kindIdx], message, lang, bot: str(r.website).trim() !== "" } };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const subj = (s: string) => oneLine(s).slice(0, 100);

/** 運営者への通知メール（本文は常にエスケープ。件名は単一行） */
export function buildNotification(c: ContactClean, id: number, siteUrl: string): { subject: string; text: string; html: string } {
  const url = `${siteUrl}/admin/contacts/${id}/`;
  const subject = subj(`[お問い合わせ] ${c.kind} — ${c.name}`);
  const text = [`新しいお問い合わせがありました。`, "", `種別: ${c.kind}`, `氏名: ${c.name}`, `メール: ${c.email}`, `会社名・所属: ${c.company || "（なし）"}`, `言語: ${c.lang}`, "", "--- 内容 ---", c.message, "-------------", "", `管理画面: ${url}`, "（このメールに返信すると送信者に届きます）"].join("\n");
  const html = `<p>新しいお問い合わせがありました。</p><table cellpadding="6" style="border-collapse:collapse"><tr><th align="left">種別</th><td>${esc(c.kind)}</td></tr><tr><th align="left">氏名</th><td>${esc(c.name)}</td></tr><tr><th align="left">メール</th><td>${esc(c.email)}</td></tr><tr><th align="left">会社名・所属</th><td>${esc(c.company || "（なし）")}</td></tr></table><p style="white-space:pre-wrap;border-left:3px solid #C22740;padding-left:12px">${esc(c.message)}</p><p><a href="${esc(url)}">管理画面で開く</a>（このメールに返信すると送信者に届きます）</p>`;
  return { subject, text, html };
}

/** 送信者への自動返信（本文は繰り返さない） */
export function buildAutoReply(c: ContactClean): { subject: string; text: string; html: string } {
  if (c.lang === "en") {
    const text = `Hi ${c.name},\n\nThank you for your inquiry. I have received your message and will get back to you within a few business days.\n\nThis is an automated message — please do not reply to it.\n\nShinnosuke Kobayashi\nhttps://shinnosuke-kobayashi.jp/en/`;
    return { subject: "Thank you for your inquiry", text, html: `<p>${esc(text).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>` };
  }
  const text = `${c.name} 様\n\nお問い合わせありがとうございます。メッセージを受け付けました。\n内容を確認のうえ、数日を目安に折り返しご連絡いたします。\n\n※このメールは自動送信です。返信はお控えください。\n※心当たりのない場合は、このメールを破棄してください。\n\n小林慎之助\nhttps://shinnosuke-kobayashi.jp/`;
  return { subject: "お問い合わせを受け付けました", text, html: `<p>${esc(text).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>` };
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  if (!ip) return "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
