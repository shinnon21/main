// 実機に近い幅で撮るスクリーンショット（headless Chrome の最小ウィンドウ幅の制限を避ける）。
// usage: node scripts/shot-cdp.mjs <url> <out.png> <width> <height> [full] [motion]
//   full: ページ全体を撮る / motion: 動きを有効にする（既定は prefers-reduced-motion で最終状態を撮る）
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const [url, out, w = "390", h = "844", full, motion] = process.argv.slice(2);
const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9400 + Math.floor(Math.random() * 300);
const chrome = spawn(CH, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/shot-prof-${port}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  for (let i = 0; i < 40 && !ws; i++) { try { const t = await (await fetch(`http://localhost:${port}/json`)).json(); const page = t.find((x) => x.type === "page"); if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r)); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } }; } } catch { await sleep(300); } }
  await send("Page.enable");
  const mobile = Number(w) < 700;
  await send("Emulation.setDeviceMetricsOverride", { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile });
  if (!motion) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.navigate", { url });
  await sleep(motion ? 3500 : 3000);
  const clip = full ? await (async () => { const m = await send("Page.getLayoutMetrics"); return { x: 0, y: 0, width: Number(w), height: Math.ceil(m.cssContentSize.height), scale: 1 }; })() : undefined;
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!full, ...(clip ? { clip } : {}) });
  writeFileSync(out, Buffer.from(r.data, "base64")); console.log("saved", out);
} finally { chrome.kill(); }
