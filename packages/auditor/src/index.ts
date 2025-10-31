import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import type { Page } from "puppeteer";
import axeSource from "axe-core";

export type AuditResult = {
  url: string;
  title?: string;
  axeViolations: {
    id: string;
    impact?: string | null;
    description: string;
    help: string;
    helpUrl: string;
    nodes: number;
  }[];
};

export type AuditSummary = {
  startedAt: string;
  pagesCrawled: number;
  results: AuditResult[];
};

function normalizeUrl(u: string) {
  try { return new URL(u).toString().replace(/#.*$/,""); } catch { return u; }
}

async function getPageTitle(page: Page) {
  try { return await page.title(); } catch { return undefined; }
}

async function runAxe(page: Page) {
  await page.addScriptTag({ content: axeSource.source });
  const result = await page.evaluate(async () => {
    // @ts-ignore
    return await (window as any).axe.run({
      runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21aa","section508"] },
      resultTypes: ["violations"],
    });
  });
  return (result.violations || []).map((v: any) => ({
    id: v.id,
    impact: v.impact ?? null,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: (v.nodes || []).length,
  }));
}

function isInternalLink(root: URL, href: string) {
  try {
    const u = new URL(href, root);
    return u.origin === root.origin;
  } catch { return false; }
}

async function discoverLinks(page: Page, root: URL): Promise<string[]> {
  const hrefs = await page.$$eval("a[href]", (as) => as.map(a => (a as HTMLAnchorElement).getAttribute("href") || ""));
  const urls = new Set<string>();
  for (const href of hrefs) {
    if (!href) continue;
    try {
      const absolute = new URL(href, root).toString();
      if (isInternalLink(root, absolute)) urls.add(absolute.replace(/#.*$/,""));
    } catch {}
  }
  return Array.from(urls);
}

export async function runAudit(options: { url: string; pages: number }) {
  const startUrl = new URL(options.url);
  const maxPages = Math.max(1, options.pages || 5);
  const visited = new Set<string>();
  const queue: string[] = [normalizeUrl(startUrl.toString())];

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  const results: AuditResult[] = [];
  while (queue.length && visited.size < maxPages) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    try {
      await page.goto(current, { waitUntil: "domcontentloaded", timeout: 45000 });
      const title = await getPageTitle(page);
      const axeViolations = await runAxe(page);
      results.push({ url: current, title, axeViolations });

      const links = await discoverLinks(page, startUrl);
      for (const l of links) if (!visited.has(l) && queue.length < maxPages * 3) queue.push(l);
    } catch (err) {
      results.push({ url: current, title: undefined, axeViolations: [{
        id: "navigation-error",
        impact: "serious",
        description: (err as Error).message ?? "Navigation error",
        help: "Page failed to load",
        helpUrl: "",
        nodes: 0,
      }]});
    }
  }

  await browser.close();

  const summary: AuditSummary = {
    startedAt: new Date().toISOString(),
    pagesCrawled: results.length,
    results,
  };

  const outDir = path.resolve("autositefix-report");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(summary, null, 2));

  // very simple HTML report
  const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"/>
<title>AutoSiteFix Report</title>
<style>
 body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:24px;line-height:1.4}
 h1{margin:0 0 12px} .url{font-weight:600}
 .violation{border:1px solid #ddd;padding:10px;border-radius:8px;margin:8px 0}
 .impact{padding:2px 6px;border-radius:6px;background:#eee;font-size:12px}
 .impact.serious{background:#ffe1e1}
 .impact.moderate{background:#fff3cd}
 .impact.minor{background:#e7f3ff}
 code{background:#f6f8fa;padding:2px 4px;border-radius:4px}
</style>
<h1>AutoSiteFix Report</h1>
<p>Started: <code>${summary.startedAt}</code></p>
<p>Pages scanned: <strong>${summary.pagesCrawled}</strong></p>
${results.map(r => `
<section>
  <div class="url">${r.title ? r.title + " — " : ""}<a href="${r.url}">${r.url}</a></div>
  <div>Violations: <strong>${r.axeViolations.length}</strong></div>
  ${r.axeViolations.map(v => `
   <div class="violation">
     <div><span class="impact ${v.impact ?? ""}">${v.impact ?? "n/a"}</span> <strong>${v.id}</strong> — ${v.help}</div>
     <div>${v.description}</div>
     ${v.helpUrl ? `<div><a href="${v.helpUrl}">${v.helpUrl}</a></div>` : ""}
     <div>Affected nodes: ${v.nodes}</div>
   </div>
  `).join("")}
</section>`).join("")}
</html>`;
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf-8");

  return { outDir, summary };
}
