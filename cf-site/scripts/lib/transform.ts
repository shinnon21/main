const ESC = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function rewriteUploads(html: string, siteUrl: string): string {
  const host = new URL(siteUrl).host;
  const abs = new RegExp(`https?://${ESC(host)}/wp-content/uploads/`, "g");
  const sized = /(\/media\/[^\s"'<>,]*?)-\d+x\d+(\.[A-Za-z0-9]+)/g;
  return html
    .replace(abs, "/media/")
    .replace(/(["'(\s=])\/wp-content\/uploads\//g, "$1/media/")
    .replace(sized, "$1$2");
}

const SHORTCODES = "gallery|caption|embed|contact-form-7|video|audio|playlist";
export function findWpArtifacts(html: string): string[] {
  const re = new RegExp(`\\[(?:${SHORTCODES})\\b[^\\]]*\\]|<!--\\s*/?wp:[^>]*-->`, "g");
  return html.match(re) ?? [];
}

export function stripBlockComments(html: string): string {
  return html.replace(/[ \t]*<!--\s*\/?wp:[\s\S]*?-->[ \t]*\n?/g, "");
}
