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

// These are public, browser-safe Lovable Cloud identifiers. They are not secrets:
// the frontend needs them in the JavaScript bundle to talk to auth/database with RLS.
// Server-only keys stay in managed environment variables and are never committed.
const publicCloudEnv = {
  "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
    process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://iuewdbsgtodxedwsxosd.supabase.co",
  ),
  "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZXdkYnNndG9keGVkd3N4b3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MDQ1NzcsImV4cCI6MjA5NTA4MDU3N30.G_HSTCTobhPtv-tUhUQMSsVoEe8ua_j_pwKCMKFDMJ8",
  ),
  "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
    process.env.VITE_SUPABASE_PROJECT_ID ?? process.env.SUPABASE_PROJECT_ID ?? "iuewdbsgtodxedwsxosd",
  ),
};

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: publicCloudEnv,
    resolve: {
      alias: [
        { find: /^entities\/lib\/decode\.js$/, replacement: `${entitiesV4}/lib/decode.js` },
        { find: /^entities\/lib\/encode\.js$/, replacement: `${entitiesV4}/lib/encode.js` },
        { find: /^entities$/, replacement: entitiesV4 },
      ],
    },
  },
});
