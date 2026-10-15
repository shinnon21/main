import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { buildBackfillSql } from "../scripts/backfill-media.ts";

test("backfill SQL registers originals only, with sniffed type and size, idempotently and with safe quoting", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const sql = buildBackfillSql(
    [{ id: 1, path: "2026/07/a.jpg", mime: "image/png" }, { id: 2, path: "2026/07/a-300x200.jpg", mime: "image/jpeg" }, { id: 3, path: "2026/07/it's.webp", mime: "image/webp" }, { id: 4, path: "../x.png", mime: "image/png" }],
    (key) => (key === "2026/07/a.jpg" ? { bytes: png, size: 1234 } : null),
    "2026-10-15 00:00:00",
  );
  const db = newDb(); for (const s of [...sql, ...sql]) db.exec(s);
  const rows = db.prepare("select key,content_type,size,uploaded_by from media order by key").all() as any[];
  expect(rows.map((r) => r.key)).toEqual(["2026/07/a.jpg", "2026/07/it's.webp"]);
  expect(rows[0]).toMatchObject({ content_type: "image/png", size: 1234, uploaded_by: "wp-import" });
  expect(rows[1]).toMatchObject({ content_type: "image/webp", size: 0 });
});
