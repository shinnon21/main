import type { Lang } from "./i18n.ts";

export function pick(lang: Lang, ja: string | null | undefined, en: string | null | undefined): string {
  return lang === "en" && typeof en === "string" && en.trim() !== "" ? en : ja ?? "";
}

const TERMS: Record<string, string> = {
  "起業・経営": "Founding & Management", "DX支援": "DX Support", "国際事業開発": "Global Business Development", "マーケティング": "Marketing", "登壇・講師": "Talks & Lectures",
  "政治DX": "Political DX", "データ分析": "Data Analysis", "事業開発": "Business Development", "東南アジア": "Southeast Asia", "コミュニティ構築": "Community Building",
  "経営工学": "Management Science", "サプライチェーン": "Supply Chain", "生成AI活用": "Generative AI", "スタートアップ": "Startup", "政治・行政": "Politics & Government",
};
const SCOPES: Record<string, string> = {
  "戦略立案": "Strategy", "要件定義": "Requirements", "設計": "System Design", "デザイン": "Design", "実装": "Implementation", "運用": "Operations",
  "データ分析": "Data Analysis", "リサーチ・調査": "Research", "マーケティング・広報": "Marketing & PR", "コミュニティ運営": "Community Management", "講師・登壇": "Lecturing & Talks",
};
const NEWS: Record<string, string> = { "お知らせ": "News", "登壇・イベント": "Talks & Events", "メディア掲載": "Media", "リリース": "Release" };

const look = (m: Record<string, string>, lang: Lang, k: string) => (lang === "en" && Object.hasOwn(m, k) ? m[k] : k);
export const termName = (lang: Lang, name: string) => look(TERMS, lang, name);
export const scopeLabel = (lang: Lang, v: string) => look(SCOPES, lang, v);
export const newsTypeName = (lang: Lang, name: string) => look(NEWS, lang, name);

/** 実績の担当領域として選べる値（管理画面のチェックボックス用） */
export const SCOPE_VALUES = Object.keys(SCOPES);
