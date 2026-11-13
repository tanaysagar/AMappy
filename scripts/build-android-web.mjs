import { build } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const origin = new URL(process.env.MARGA_API_ORIGIN ?? "");
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
    origin.hostname === "chatgpt.site" || origin.hostname.endsWith(".chatgpt.site")) {
  throw new Error("MARGA_API_ORIGIN must be the HTTPS origin of the independent Marga backend");
}
await build({
  root,
  configFile: false,
  define: { __MARGA_API_ORIGIN__: JSON.stringify(origin.origin) },
  resolve: { alias: { "@": root } },
  esbuild: { jsx: "automatic" },
  build: {
    assetsDir: 'marga-bundled',
    outDir: "android/app/src/main/assets",
    rollupOptions: { input: "android.html" },
  },
});
