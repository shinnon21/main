// usage: node scripts/check-en.ts <url…>  英語ページの本文以外に日本語が残っていないか点検する
const JP = /[぀-ヿ㐀-鿿＀-￯]/;
for (const url of process.argv.slice(2)) {
  const html = await (await fetch(url)).text();
  const body = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<div class="entry-content">[\s\S]*?<\/div>\s*<\/article>/g, " ");
  const texts = [...body.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter((s) => JP.test(s));
  const attrs = [...body.matchAll(/\b(?:alt|title|aria-label|placeholder|content)="([^"]*)"/g)].map((m) => m[1]).filter((s) => JP.test(s));
  const links = [...body.matchAll(/href="(\/(?!en\/|media\/|assets\/|_astro\/)[^"]*)"/g)].map((m) => m[1]);
  const lang = html.match(/<html lang="([^"]+)"/)?.[1];
  const hreflang = (html.match(/hreflang="/g) ?? []).length;
  console.log(`${url}\n  lang=${lang} hreflang-attrs=${hreflang} switches=${(html.match(/class="lang-switch"/g) ?? []).length}`);
  for (const s of [...new Set(texts)]) console.log(`  JP text : ${s.slice(0, 80)}`);
  for (const s of [...new Set(attrs)]) console.log(`  JP attr : ${s.slice(0, 80)}`);
  for (const s of [...new Set(links)]) console.log(`  non-/en link: ${s.slice(0, 80)}`);
}
