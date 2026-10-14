export type Lang = "ja" | "en";
export const t = (lang: Lang, ja: string, en: string): string => (lang === "en" ? en : ja);
