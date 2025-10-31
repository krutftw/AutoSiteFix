#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
.scriptName("autositefix")
.usage("$0 --url <url> [--pages 5] [--fix perf,a11y,seo] [--dry-run]")
.option("url", { type: "string", describe: "Site URL (or local dev URL)" })
.option("pages", { type: "number", default: 5 })
.option("fix", { type: "string", describe: "Comma list: perf,a11y,seo" })
.option("dry-run", { type: "boolean", default: true })
.help()
.parseSync();

console.log("AutoSiteFix (skeleton).");
console.log("Args:", argv);
