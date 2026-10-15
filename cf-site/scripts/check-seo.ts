// usage: node scripts/check-seo.ts <baseUrl>  JSON-LDの妥当性とsitemap URLの実在を点検する
const base = process.argv[2];
const sm = await (await fetch(base + "/sitemap.xml")).text();
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
let bad = 0, ld = 0, noCanon = 0;
const queue = [...locs];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let u; (u = queue.shift()); ) {
    const url = base + new URL(u).pathname;
    const res = await fetch(url, { redirect: "manual" });
    if (res.status !== 200) { bad++; console.log(`NOT 200 (${res.status}): ${url}`); continue; }
    const html = await res.text();
    const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (canon !== u) { noCanon++; console.log(`canonical mismatch: ${url}\n   loc=${u}\n   canonical=${canon}`); }
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); ld++; } catch (e) { bad++; console.log(`bad JSON-LD: ${url}: ${e}`); }
    }
  }
}));
console.log(`urls=${locs.length} bad=${bad} canonicalMismatch=${noCanon} jsonld=${ld}`);
process.exit(bad || noCanon ? 1 : 0);
