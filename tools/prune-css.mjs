import { PurgeCSS } from "purgecss";
import { readFile, writeFile } from "node:fs/promises";

const css = await readFile("styles.css", "utf8");
const [result] = await new PurgeCSS().purge({
  content: ["index.html", "app.js", "model.js", "src/**/*.js"],
  css: [{ raw: css }],
  safelist: {
    standard: ["is-active", "sr-status"],
    greedy: [
      /^budget-/,
      /^cols-/,
      /^is-/,
      /^state-/,
      /^status-/,
      /^seg-/,
      /^th-/,
      /^cov-/,
      /^poster-/,
      /aria-disabled/,
      /aria-busy/,
      /data-qe-panel/,
      /data-seg-idx/,
      /data-tone/,
      /data-view/,
      /data-tick/,
      /details-content/,
      /focus-visible/,
      /::backdrop/,
      /::-webkit-/,
    ],
  },
  rejected: true,
});
const dryRun = process.argv.includes("--dry-run");
if (!dryRun) {
  await writeFile("styles.css", result.css);
}
console.log(
  `CSS${dryRun ? " (dry-run)" : ""}: ${Buffer.byteLength(css)} → ${Buffer.byteLength(result.css)} bytes; ${dryRun ? "would remove" : "removed"} ${result.rejected.length} unused selectors.`,
);
