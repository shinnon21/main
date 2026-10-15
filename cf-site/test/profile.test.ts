import { expect, test } from "vitest";
import { profileLines, parseCareer, parseSkills } from "../src/lib/profile.ts";

test("profileLines splits on any newline, trims and drops blanks", () => {
  expect(profileLines("a\r\n\r\n  b \nc\r")).toEqual(["a", "b", "c"]);
  expect(profileLines("")).toEqual([]);
  expect(profileLines(undefined)).toEqual([]);
});
test("parseCareer splits 'date | title | description' (description may contain pipes; missing parts are empty)", () => {
  expect(parseCareer("2025.09 – | Weeave | 説明 | に | パイプ\n2024 | だけ")).toEqual([
    { d: "2025.09 –", t: "Weeave", p: "説明 | に | パイプ" },
    { d: "2024", t: "だけ", p: "" },
  ]);
  expect(parseCareer("2020")).toEqual([{ d: "2020", t: "", p: "" }]);
});
test("parseSkills splits 'group | a、b,c' into chips and ignores empty chips", () => {
  expect(parseSkills("言語 | 日本語（母語）、英語, ,\nグループのみ")).toEqual([
    { g: "言語", chips: ["日本語（母語）", "英語"] },
    { g: "グループのみ", chips: [] },
  ]);
});
