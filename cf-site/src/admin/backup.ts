import type { D1Like } from "../lib/d1.ts";

const all = (db: D1Like, sql: string) => db.prepare(sql).bind().all().then((r) => r.results);

/** 全コンテンツのJSON書き出し。R2の画像ファイル本体は含まない（一覧のみ）。問い合わせは本人情報のため opt-in、IPハッシュ/UAは含めない */
export async function buildBackup(db: D1Like, nowUtc: string, opts: { contacts: boolean }) {
  return {
    format: "kb-site-backup/1",
    exported_at: nowUtc,
    posts: await all(db, "SELECT * FROM posts ORDER BY id"),
    post_meta: await all(db, "SELECT post_id,key,value FROM post_meta ORDER BY post_id,key"),
    terms: await all(db, "SELECT * FROM terms ORDER BY id"),
    post_terms: await all(db, "SELECT post_id,term_id FROM post_terms ORDER BY post_id,term_id"),
    settings: await all(db, "SELECT key,value FROM settings ORDER BY key"),
    views: await all(db, "SELECT post_id,count FROM views ORDER BY post_id"),
    revisions: await all(db, "SELECT id,post_id,saved_at,saved_by,snapshot FROM revisions ORDER BY id"),
    media: await all(db, "SELECT id,key,content_type,size,alt,uploaded_at,uploaded_by FROM media ORDER BY id"),
    ...(opts.contacts ? { contacts: await all(db, "SELECT id,created_at,name,email,company,kind,message,lang,status,notify_status,notify_error FROM contacts ORDER BY id") } : {}),
  };
}
export const backupFilename = (nowUtc: string) => `kobayashi-backup-${nowUtc.replace(/\D/g, "").replace(/^(\d{8})(\d{6}).*$/, "$1-$2")}.json`;
