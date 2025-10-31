#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runAudit } from "autositefix-auditor";

const argv = yargs(hideBin(process.argv))
  .scriptName("autositefix")
  .usage("$0 --url <url> [--pages 5] [--dry-run]")
  .option("url", { type: "string", describe: "Site URL (or local dev URL)" })
  .option("pages", { type: "number", default: 5 })
  .option("dry-run", { type: "boolean", default: true })
  .help()
  .strict()
  .parseSync();

(async () => {
  if (!argv.url) {
    console.log("AutoSiteFix\nPass --url to run an audit, e.g.:");
    console.log("  autositefix --url https://example.com --pages 2");
    process.exit(0);
  }
  console.log(`🔎 Auditing ${argv.url} (pages=${argv.pages})...`);
  const { outDir, summary } = await runAudit({ url: argv.url, pages: argv.pages as number });
  console.log(`✅ Done. ${summary.pagesCrawled} page(s) scanned.`);
  console.log(`📁 Report written to: ${outDir}/index.html`);
})();
