import fs from 'node:fs/promises';
import path from 'node:path';

import { AxePuppeteer } from '@axe-core/puppeteer';
import { load as loadHtml } from 'cheerio';
import chromeLauncher from 'chrome-launcher';
import lighthouse, { Flags as LighthouseFlags, RunnerResult } from 'lighthouse';
import pLimit from 'p-limit';
import puppeteer, { Browser } from 'puppeteer';

export interface AxeNodeSummary {
  html: string;
  target: string[];
  failureSummary?: string;
}

export interface AxeViolationSummary {
  id: string;
  impact?: string | null;
  description: string;
  helpUrl: string;
  nodes: AxeNodeSummary[];
}

export interface LighthouseScoreSummary {
  performance: number;
  accessibility: number;
  seo: number;
}

export interface PageAuditResult {
  url: string;
  lighthouse: {
    scores: LighthouseScoreSummary;
    details: RunnerResult['lhr'];
  };
  axe: {
    violations: AxeViolationSummary[];
  };
  fetchedAt: string;
}

export interface AuditOptions {
  /** Starting URL for the crawl. */
  url: string;
  /** Maximum number of pages to audit. */
  pages?: number;
  /** Directory to write intermediate artifacts such as raw Lighthouse reports. */
  artifactDir?: string;
  /** Optional callback fired when a page starts or finishes auditing. */
  onProgress?: (event: AuditProgressEvent) => void;
  /** Optional timeout per page in milliseconds. */
  timeout?: number;
}

export type AuditProgressEvent =
  | { type: 'discover-start'; url: string }
  | { type: 'discover-complete'; urls: string[] }
  | { type: 'page-start'; url: string }
  | { type: 'page-complete'; url: string }
  | { type: 'error'; url: string; error: Error };

export interface AuditRunResult {
  pages: PageAuditResult[];
  startedAt: string;
  completedAt: string;
}

interface DiscoverOptions {
  startUrl: string;
  limit: number;
  timeout: number;
}

const DEFAULT_TIMEOUT = 90_000;

export async function runAudit(options: AuditOptions): Promise<AuditRunResult> {
  const startedAt = new Date().toISOString();
  const maxPages = Math.max(1, options.pages ?? 5);
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  options.onProgress?.({ type: 'discover-start', url: options.url });
  const urls = await discoverUrls({
    startUrl: options.url,
    limit: maxPages,
    timeout
  });
  options.onProgress?.({ type: 'discover-complete', urls });

  const artifactDir = options.artifactDir ?? path.resolve('autositefix-report/.artifacts');
  await fs.mkdir(artifactDir, { recursive: true });

  const limit = pLimit(1);
  const pages: PageAuditResult[] = [];

  for (const url of urls) {
    options.onProgress?.({ type: 'page-start', url });
    try {
      const result = await limit(() => auditSinglePage(url, artifactDir, timeout));
      pages.push(result);
      options.onProgress?.({ type: 'page-complete', url });
    } catch (error) {
      options.onProgress?.({
        type: 'error',
        url,
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }

  const completedAt = new Date().toISOString();
  return {
    pages,
    startedAt,
    completedAt
  };
}

async function discoverUrls({ startUrl, limit, timeout }: DiscoverOptions): Promise<string[]> {
  const initialUrl = new URL(startUrl);
  const seen = new Set<string>();
  const queue: string[] = [initialUrl.href];
  const urls: string[] = [];

  while (queue.length > 0 && urls.length < limit) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }
    seen.add(current);
    urls.push(current);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(current, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok || response.headers.get('content-type')?.includes('text/html') !== true) {
        continue;
      }

      const body = await response.text();
      const $ = loadHtml(body);
      $('a[href]')
        .toArray()
        .forEach((element) => {
          const href = $(element).attr('href');
          if (!href) return;

          try {
            const resolved = new URL(href, current);
            if (resolved.origin !== initialUrl.origin) {
              return;
            }
            const normalized = normalizeUrl(resolved);
            if (!seen.has(normalized) && !queue.includes(normalized) && urls.length + queue.length < limit * 3) {
              queue.push(normalized);
            }
          } catch (error) {
            // Ignore malformed URLs.
            void error;
          }
        });
    } catch (error) {
      // Ignore fetch errors and continue crawling.
      void error;
    }
  }

  return urls.slice(0, limit);
}

function normalizeUrl(url: URL): string {
  url.hash = '';
  if (url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1) || '/';
  }
  return url.href;
}

async function auditSinglePage(url: string, artifactDir: string, timeout: number): Promise<PageAuditResult> {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
  });

  let browser: Browser | undefined;

  try {
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });

    const lighthouseFlags: LighthouseFlags = {
      port: chrome.port,
      output: 'json',
      logLevel: 'error'
    };

    const runner = await lighthouse(url, lighthouseFlags);
    if (!runner?.lhr) {
      throw new Error('Failed to obtain Lighthouse results');
    }

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(timeout);
    await page.goto(url, { waitUntil: 'networkidle2' });
    const axe = await new AxePuppeteer(page).analyze();
    await page.close();

    const lighthouseArtifactPath = path.join(
      artifactDir,
      `${encodeURIComponent(url)}-lighthouse.json`
    );
    await fs.writeFile(lighthouseArtifactPath, JSON.stringify(runner.lhr, null, 2), 'utf8');

    const violations: AxeViolationSummary[] = axe.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map((node) => ({
        html: node.html,
        target: Array.isArray(node.target)
          ? node.target.map((value) => value.toString())
          : [],
        failureSummary: node.failureSummary ?? undefined
      }))
    }));

    return {
      url,
      lighthouse: {
        scores: extractScores(runner),
        details: runner.lhr
      },
      axe: {
        violations
      },
      fetchedAt: new Date().toISOString()
    };
  } finally {
    await browser?.close().catch(() => undefined);
    try {
      await chrome.kill();
    } catch {
      // ignore
    }
  }
}

function extractScores(runner: RunnerResult): LighthouseScoreSummary {
  const performance = (runner.lhr.categories.performance?.score ?? 0) * 100;
  const accessibility = (runner.lhr.categories.accessibility?.score ?? 0) * 100;
  const seo = (runner.lhr.categories.seo?.score ?? 0) * 100;

  return {
    performance: Math.round(performance),
    accessibility: Math.round(accessibility),
    seo: Math.round(seo)
  };
}
