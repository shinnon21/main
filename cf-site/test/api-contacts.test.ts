import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { handleAdminApi } from "../src/admin/api.ts";

const ORIGIN = "https://admin.test";
function setup() {
  const raw = newDb(); const db = d1(raw);
  const ins = raw.prepare("insert into contacts(created_at,name,email,company,kind,message,lang,status,notify_status) values(?,?,?,?,?,?,?,?,?)");
  ins.run("2026-10-15 01:00:00.000", "山田", "a@example.com", "X社", "その他", "<b>本文</b>1", "ja", "new", "sent");
  ins.run("2026-10-15 02:00:00.000", "Smith", "b@example.com", "", "取材・登壇のご依頼", "msg2", "en", "read", "error");
  ins.run("2026-10-15 03:00:00.000", "Spam", "c@example.com", "", "その他", "buy", "ja", "spam", "sent");
  return { raw, db };
}
const call = (s: ReturnType<typeof setup>, method: string, path: string, body?: unknown) =>
  handleAdminApi(new Request(`${ORIGIN}/admin/api${path}`, { method, headers: { Origin: ORIGIN, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), { db: s.db, email: "me@x", nowUtc: "t" });

test("list: newest first, spam hidden by default, status filter, counts of new messages", async () => {
  const s = setup();
  const all = await (await call(s, "GET", "/contacts")).json() as any;
  expect(all.contacts.map((c: any) => c.name)).toEqual(["Smith", "山田"]); expect(all.new_count).toBe(1);
  expect(all.contacts[0]).not.toHaveProperty("message");
  expect(((await (await call(s, "GET", "/contacts?status=spam")).json()) as any).contacts.map((c: any) => c.name)).toEqual(["Spam"]);
  expect(((await (await call(s, "GET", "/contacts?status=new")).json()) as any).contacts).toHaveLength(1);
});
test("detail returns the full message; unknown id is 404; ip_hash and user agent are never exposed in lists", async () => {
  const s = setup();
  const d = await (await call(s, "GET", "/contacts/1")).json() as any;
  expect(d).toMatchObject({ id: 1, name: "山田", message: "<b>本文</b>1", status: "new" });
  expect((await call(s, "GET", "/contacts/999")).status).toBe(404);
  expect(JSON.stringify(await (await call(s, "GET", "/contacts")).json())).not.toMatch(/ip_hash|user_agent/);
});
test("status update: new/read/spam only; invalid status 400; unknown id 404", async () => {
  const s = setup();
  expect((await call(s, "POST", "/contacts/1/status", { status: "read" })).status).toBe(200);
  expect((s.raw.prepare("select status from contacts where id=1").get() as any).status).toBe("read");
  expect((await call(s, "POST", "/contacts/1/status", { status: "bogus" })).status).toBe(400);
  expect((await call(s, "POST", "/contacts/999/status", { status: "read" })).status).toBe(404);
  expect((await call(s, "POST", "/contacts/1/status", { status: "spam" })).status).toBe(200);
});
