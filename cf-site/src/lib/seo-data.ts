import type { D1Like } from "./d1.ts";
import { SITE_URL, mediaSrc } from "./format.ts";
import type { Lang } from "./i18n.ts";
import { profileFull } from "./queries.ts";
import { personLd } from "./seo.ts";
import { SNS } from "./sns.ts";

/** Person の JSON-LD（プロフィール編集欄・SNSアカウントと連動）。 */
export async function personFor(db: D1Like, lang: Lang) {
  const p = await profileFull(db, lang);
  const img = mediaSrc(p.avatar);
  return personLd({ lang, name: p.name, bio: p.bio, sameAs: SNS.filter((s) => s.url).map((s) => s.url), image: img ? SITE_URL + img : null });
}
export const ogImage = (thumbnail: string | null) => {
  const m = mediaSrc(thumbnail);
  return m ? { url: SITE_URL + m, isDefault: false } : { url: `${SITE_URL}/assets/img/og-default.png`, isDefault: true };
};

import { l } from "./lang.ts";
import { articleLd, breadcrumbLd, metaDescription } from "./seo.ts";

/** 実績・コラム・お知らせ詳細の description / OGP画像 / JSON-LD（Article + BreadcrumbList）をまとめて作る */
export async function articleSeo(db: D1Like, i: {
  lang: Lang; type: "works" | "column" | "news"; slug: string; title: string; excerpt: string; body: string;
  thumbnail: string | null; published: string; modified: string; listLabel: string;
}) {
  const path = l(i.lang, `/${i.type}/${encodeURIComponent(i.slug)}/`);
  const description = metaDescription({ lang: i.lang, kind: "post", excerpt: i.excerpt, body: i.body });
  const image = ogImage(i.thumbnail);
  const author = await personFor(db, i.lang);
  return {
    description,
    seo: {
      type: "article" as const,
      image,
      jsonld: [
        articleLd({ lang: i.lang, type: i.type, title: i.title, published: i.published, modified: i.modified, path, description: i.excerpt || undefined, image: image.url, author }),
        breadcrumbLd({ lang: i.lang, listLabel: i.listLabel, listPath: l(i.lang, `/${i.type}/`), title: i.title }),
      ],
    },
  };
}
