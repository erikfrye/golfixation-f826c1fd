// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";

const entitiesV4 = path.resolve(
  process.cwd(),
  "node_modules/htmlparser2/node_modules/entities",
);

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [
        { find: /^entities\/lib\/decode\.js$/, replacement: `${entitiesV4}/lib/decode.js` },
        { find: /^entities\/lib\/encode\.js$/, replacement: `${entitiesV4}/lib/encode.js` },
        { find: /^entities$/, replacement: entitiesV4 },
      ],
    },
  },
});
