import { defineConfig } from "vitest/config";
// RSA鍵生成（access.test.ts）は並列実行時に5秒を超えることがあるため余裕を持たせる
export default defineConfig({ test: { include: ["test/**/*.test.ts"], environment: "node", testTimeout: 30000 } });
