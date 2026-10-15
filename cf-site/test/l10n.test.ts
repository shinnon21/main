import { expect, test } from "vitest";
import { pick, termName, scopeLabel, newsTypeName } from "../src/lib/l10n.ts";

test("pick prefers non-empty English in en, never in ja", () => {
  expect(pick("en", "日本語", "English")).toBe("English");
  expect(pick("en", "日本語", "  ")).toBe("日本語");
  expect(pick("en", "日本語", null)).toBe("日本語");
  expect(pick("ja", "日本語", "English")).toBe("日本語");
  expect(pick("en", null, undefined)).toBe("");
});
test("termName maps known Japanese names in en and passes unknown through", () => {
  expect(termName("en", "DX支援")).toBe("DX Support");
  expect(termName("en", "起業・経営")).toBe("Founding & Management");
  expect(termName("en", "政治・行政")).toBe("Politics & Government");
  expect(termName("en", "未知のタグ")).toBe("未知のタグ");
  expect(termName("en", "constructor")).toBe("constructor");
  expect(termName("ja", "DX支援")).toBe("DX支援");
});
test("scopeLabel and newsTypeName", () => {
  expect(scopeLabel("en", "要件定義")).toBe("Requirements");
  expect(scopeLabel("en", "講師・登壇")).toBe("Lecturing & Talks");
  expect(scopeLabel("ja", "運用")).toBe("運用");
  expect(newsTypeName("en", "メディア掲載")).toBe("Media");
  expect(newsTypeName("en", "登壇・イベント")).toBe("Talks & Events");
  expect(newsTypeName("en", "不明")).toBe("不明");
});
