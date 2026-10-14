export function mediaKey(p: string): string {
  if (p.startsWith("/") || p.split("/").includes("..") || p.includes("\0")) throw new Error(`unsafe media path: ${p}`);
  return p;
}
export const originalsOnly = (paths: string[]) => paths.filter((p) => !/-\d+x\d+\.[A-Za-z0-9]+$/.test(p));

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, at: number, s: string) => [...s].every((c, i) => b[at + i] === c.charCodeAt(0));
const EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", pdf: "application/pdf", mp4: "video/mp4", mp3: "audio/mpeg",
};
export function sniffContentType(bytes: Uint8Array, path: string): string {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (ascii(bytes, 0, "GIF8")) return "image/gif";
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "image/webp";
  if (ascii(bytes, 0, "%PDF")) return "application/pdf";
  return EXT[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}
