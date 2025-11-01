import fs from 'node:fs/promises';
import path from 'node:path';

import { AxePuppeteer } from '@axe-core/puppeteer';
import { load as loadHtml } from 'cheerio';
import puppeteer from 'puppeteer';

type AxeAnalysis = Awaited<ReturnType<AxePuppeteer['analyze']>>;

export interface PageMetadata {
  title: string | null;
  status: number | null;
  screenshotPath?: string;
}

export interface PageAuditResult {
  url: string;
  metadata: PageMetadata;
  axe: AxeAnalysis;
  fetchedAt: string;
}

export interface AuditRunResult {
  pages: PageAuditResult[];
  startedAt: string;
  completedAt: string;
}

export type AuditProgressEvent =
  | { type: 'discover-start'; url: string }
  | { type: 'discover-complete'; urls: string[] }
  | { type: 'page-start'; url: string }
  | { type: 'page-complete'; url: string }
  | { type: 'error'; url: string; error: Error };

export interface AuditOptions {
  url: string;
  pages?: number;
  timeout?: number;
  onProgress?: (event: AuditProgressEvent) => void;
  captureScreenshots?: boolean;
  screenshotDir?: string;
}

export interface PersistAuditOptions {
  outputDir?: string;
  title?: string;
  includeHtml?: boolean;
}

export interface PersistAuditResult {
  json: string;
  html?: string;
}

const DEFAULT_TIMEOUT = 45_000;

export async function runAudit(options: AuditOptions): Promise<AuditRunResult> {
  const startedAt = new Date().toISOString();
  const maxPages = Math.max(1, options.pages ?? 5);
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  options.onProgress?.({ type: 'discover-start', url: options.url });
  const urls = await discoverSameOriginUrls({
    startUrl: options.url,
    limit: maxPages,
    timeout
  });
  options.onProgress?.({ type: 'discover-complete', urls });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const pages: PageAuditResult[] = [];

    for (const url of urls) {
      options.onProgress?.({ type: 'page-start', url });
      try {
        const result = await auditSinglePage(browser, url, {
          timeout,
          captureScreenshots: options.captureScreenshots ?? false,
          screenshotDir: options.screenshotDir
        });
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
    return { pages, startedAt, completedAt };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export async function persistAuditArtifacts(
  result: AuditRunResult,
  options: PersistAuditOptions = {}
): Promise<PersistAuditResult> {
  const outputDir = path.resolve(options.outputDir ?? 'autositefix-report');
  await fs.mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, 'report.json');
  await fs.writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf8');

  if (options.includeHtml === false) {
    return { json: jsonPath };
  }

  const { writeReport } = await import('@autositefix/report');
  const locations = await writeReport(result, {
    outputDir,
    title: options.title
  });

  return { json: jsonPath, html: locations.html };
}

interface DiscoverOptions {
  startUrl: string;
  limit: number;
  timeout: number;
}

async function discoverSameOriginUrls({
  startUrl,
  limit,
  timeout
}: DiscoverOptions): Promise<string[]> {
  const initialUrl = new URL(startUrl);
  const seen = new Set<string>();
  const queue: string[] = [initialUrl.href];
  const urls: string[] = [];

  while (queue.length > 0 && urls.length < limit) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const normalized = normalizeUrl(new URL(current));
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    urls.push(normalized);

    if (urls.length >= limit) {
      break;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(normalized, { signal: controller.signal });

        if (!response.ok) {
          continue;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/html')) {
          continue;
        }

        const body = await response.text();
        const $ = loadHtml(body);

        $('a[href]')
          .toArray()
          .forEach((element) => {
            const href = $(element).attr('href');
            if (!href) {
              return;
            }

            try {
              const resolved = new URL(href, normalized);
              if (resolved.origin !== initialUrl.origin) {
                return;
              }

              const normalizedHref = normalizeUrl(resolved);
              if (!seen.has(normalizedHref) && !queue.includes(normalizedHref)) {
                queue.push(normalizedHref);
              }
            } catch (error) {
              void error;
            }
          });
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      void error;
    }
  }

  return urls.slice(0, limit);
}

function normalizeUrl(url: URL): string {
  url.hash = '';
  if (url.pathname.endsWith('/') && url.pathname !== '/') {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.href;
}

interface AuditPageOptions {
  timeout: number;
  captureScreenshots: boolean;
  screenshotDir?: string;
}

async function auditSinglePage(
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  url: string,
  options: AuditPageOptions
): Promise<PageAuditResult> {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(options.timeout);

  let response: Awaited<ReturnType<typeof page.goto>>;
  try {
    response = await page.goto(url, { waitUntil: 'networkidle2' });

    const title = await page.title().catch(() => null);
    const axe = await new AxePuppeteer(page).analyze();

    let screenshotPath: string | undefined;
    if (options.captureScreenshots) {
      const dir = options.screenshotDir
        ? path.resolve(options.screenshotDir)
        : path.resolve('autositefix-report', 'screenshots');
      await fs.mkdir(dir, { recursive: true });
      const fileName = `${encodeURIComponent(page.url())}.png`;
      screenshotPath = path.join(dir, fileName);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    const metadata: PageMetadata = {
      title,
      status: response ? response.status() : null,
      screenshotPath
    };

    return {
      url: page.url() || url,
      metadata,
      axe,
      fetchedAt: new Date().toISOString()
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}
