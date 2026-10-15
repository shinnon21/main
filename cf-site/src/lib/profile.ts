/** 「1行1項目」形式のプロフィール欄を行配列にする（kb_profile_lines 相当） */
export function profileLines(text: unknown): string[] {
  return typeof text === "string" ? text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean) : [];
}

/** 経歴: 「日付 | 見出し | 説明」（説明に | を含んでもよい） */
export function parseCareer(text: unknown): { d: string; t: string; p: string }[] {
  return profileLines(text).map((line) => {
    const [d, t = "", ...rest] = line.split("|").map((s) => s.trim());
    return { d, t, p: rest.join(" | ") };
  });
}

/** スキル: 「グループ | 項目、項目,項目」 */
export function parseSkills(text: unknown): { g: string; chips: string[] }[] {
  return profileLines(text).map((line) => {
    const i = line.indexOf("|");
    const g = (i < 0 ? line : line.slice(0, i)).trim();
    const chips = i < 0 ? [] : line.slice(i + 1).split(/[、,]/).map((s) => s.trim()).filter(Boolean);
    return { g, chips };
  });
}
