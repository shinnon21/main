export function mediaKey(p: string): string {
  if (p.startsWith("/") || p.split("/").includes("..") || p.includes("\0")) throw new Error(`unsafe media path: ${p}`);
  return p;
}
export const originalsOnly = (paths: string[]) => paths.filter((p) => !/-\d+x\d+\.[A-Za-z0-9]+$/.test(p));
