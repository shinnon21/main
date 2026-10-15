const INLINE = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** /media/* の応答ヘッダー。画像4形式以外（SVG・HTML・不明）は必ずダウンロード扱いにして、サイトのオリジンでスクリプトが動かないようにする */
export function mediaHeaders(contentType: string | undefined, etag: string): Record<string, string> {
  const t = (contentType ?? "").split(";")[0].trim().toLowerCase();
  const inline = INLINE.has(t);
  return {
    "Content-Type": inline ? t : "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
    ...(inline ? {} : { "Content-Disposition": "attachment" }),
  };
}
