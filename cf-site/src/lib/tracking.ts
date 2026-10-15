import { isStagingHost } from "./seo.ts";

/** 現行WordPressサイトと同じ計測ID（GA4）・AdSenseパブリッシャーID */
export const GA_ID = "G-605F8JC1XR";
export const ADSENSE_CLIENT = "ca-pub-2082856298686985";

/** 確認用ホスト（workers.dev・localhost）では計測・広告を出さず、本番ドメインのときだけ出す */
export const trackingEnabled = (host: string): boolean => !isStagingHost(host);

export const gaSnippet = (): string =>
  `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config', '${GA_ID}');`;
