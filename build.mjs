/**
 * Bundles the scripts into `dist/`. The repository root is the extension:
 * load it unpacked and the browser picks up the files manifest.json points at.
 *
 *   node build.mjs           production build (minified)
 *   node build.mjs --watch   development build, rebuilt on change
 */

import { build, context } from "esbuild";
import { access, readFile, rm } from "node:fs/promises";

const OUT_DIR = "dist";
const watch = process.argv.includes("--watch");

await rm(OUT_DIR, { recursive: true, force: true });

/** Every file the manifest points at, relative to the repository root. */
function referencedFiles(source) {
  return [
    source.background?.service_worker,
    ...(source.background?.scripts ?? []),
    ...(source.content_scripts ?? []).flatMap((entry) => [
      ...(entry.js ?? []),
      ...(entry.css ?? []),
    ]),
    ...Object.values(source.icons ?? {}),
  ].filter(Boolean);
}

/** @type {import("esbuild").BuildOptions} */
const options = {
  // The stylesheet is an entry point too, so watch mode rebuilds it on change.
  entryPoints: [
    { in: "src/background/index.ts", out: "background" },
    { in: "src/content/index.ts", out: "content" },
    { in: "src/content/styles.css", out: "content" },
  ],
  outdir: OUT_DIR,
  bundle: true,
  // Content scripts are classic scripts, so ES modules cannot be used.
  format: "iife",
  platform: "browser",
  target: ["chrome121", "firefox121"],
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  legalComments: "none",
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching for changes…");
} else {
  await build(options);

  const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
  for (const file of new Set(referencedFiles(manifest))) {
    await access(file).catch(() => {
      throw new Error(`manifest.json references "${file}", which does not exist.`);
    });
  }
  console.log(`Build complete. Files written to ${OUT_DIR}/`);
}
