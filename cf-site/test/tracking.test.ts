import { expect, test } from "vitest";
import { GA_ID, ADSENSE_CLIENT, trackingEnabled, gaSnippet } from "../src/lib/tracking.ts";

test("tracking is on for the production host only (not staging/localhost)", () => {
  expect(trackingEnabled("shinnosuke-kobayashi.jp")).toBe(true);
  expect(trackingEnabled("www.shinnosuke-kobayashi.jp")).toBe(true);
  for (const h of ["kb-site.curly-wave-c49f.workers.dev", "localhost:4321", "127.0.0.1:8787"]) expect(trackingEnabled(h)).toBe(false);
});
test("ids match the live WordPress site and the snippet embeds only the GA id", () => {
  expect(GA_ID).toBe("G-605F8JC1XR"); expect(ADSENSE_CLIENT).toBe("ca-pub-2082856298686985");
  expect(gaSnippet()).toContain(`gtag('config', '${GA_ID}')`);
});
