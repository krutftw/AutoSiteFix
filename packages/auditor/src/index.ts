import fs from 'node:fs/promises';
import path from 'node:path';

import { load as loadHtml } from 'cheerio';
import { source as axeSource } from 'axe-core';
import type { AxeResults, NodeResult as AxeNodeResult, Result as AxeRuleResult } from 'axe-core';
import pLimit from 'p-limit';
import puppeteer, { type Browser, type Page } from 'puppeteer';

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

export interface PerformanceMetrics {
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  domContentLoaded: number | null;
  domInteractive: number | null;
}

export interface PerformanceAuditResult {
  metrics: PerformanceMetrics;
  score: number;
}

export interface AccessibilityAuditResult {
  score: number;
  violations: AxeViolationSummary[];
  passes: number;
}

export interface SeoCheck {
  id: string;
  label: string;
  passed: boolean;
}

export interface SeoAuditResult {
  score: number;
  checks: SeoCheck[];
  issues: string[];
  imageAltCoverage: number;
  metaDescriptionLength: number | null;
}

export interface PageAuditResult {
  url: string;
  performance: PerformanceAuditResult;
  accessibility: AccessibilityAuditResult;
  seo: SeoAuditResult;
  fetchedAt: string;
}

export interface AuditOptions {
  /** Starting URL for the crawl. */
  url: string;
  /** Maximum number of pages to audit. */
  pages?: number;
  /** Directory to write intermediate artifacts such as raw audit reports. */
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
const PERFORMANCE_THRESHOLDS = {
  firstContentfulPaint: { good: 1_800, poor: 3_000 },
  largestContentfulPaint: { good: 2_500, poor: 4_000 },
  domContentLoaded: { good: 2_000, poor: 4_000 },
  domInteractive: { good: 3_500, poor: 7_000 }
} as const;

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

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const limit = pLimit(2);
    const pages: (PageAuditResult | undefined)[] = new Array(urls.length);

    await Promise.all(
      urls.map((url, index) =>
        limit(async () => {
          options.onProgress?.({ type: 'page-start', url });
          try {
            const result = await auditSinglePage(browser, url, artifactDir, timeout);
            pages[index] = result;
            options.onProgress?.({ type: 'page-complete', url });
          } catch (error) {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            options.onProgress?.({ type: 'error', url, error: normalizedError });
          }
        })
      )
    );

    const completedAt = new Date().toISOString();
    return {
      pages: pages.filter((page): page is PageAuditResult => Boolean(page)),
      startedAt,
      completedAt
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
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

async function auditSinglePage(
  browser: Browser,
  url: string,
  artifactDir: string,
  timeout: number
): Promise<PageAuditResult> {
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(timeout);
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument(() => {
    const entries: number[] = [];
    Object.defineProperty(window, '__autositefixLcp', {
      value: entries,
      writable: true
    });
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const values = list.getEntries().map((entry) => entry.startTime);
          entries.push(...values);
          (window as typeof window & { __autositefixLcp?: number[] }).__autositefixLcp = entries;
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // Ignore observer errors for unsupported browsers.
      }
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: Math.min(timeout, 10_000) }).catch(() => undefined);

    const performance = await collectPerformanceAudit(page);
    const accessibility = await runAccessibilityAudit(page);
    const seo = await runSeoAudit(page);

    const result: PageAuditResult = {
      url,
      performance,
      accessibility,
      seo,
      fetchedAt: new Date().toISOString()
    };

    const artifactPath = path.join(artifactDir, `${toSafeFilename(url)}.json`);
    await fs.writeFile(artifactPath, JSON.stringify(result, null, 2), 'utf8');

    return result;
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function collectPerformanceAudit(page: Page): Promise<PerformanceAuditResult> {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry | undefined;
    const lcpEntries = (window as typeof window & { __autositefixLcp?: number[] }).__autositefixLcp ?? [];

    return {
      firstContentfulPaint: fcpEntry?.startTime ?? null,
      largestContentfulPaint: lcpEntries.length ? lcpEntries[lcpEntries.length - 1] : null,
      domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.startTime : null,
      domInteractive: navigation ? navigation.domInteractive - navigation.startTime : null
    } satisfies PerformanceMetrics;
  });

  const scores = (
    Object.entries(metrics) as Array<[
      keyof PerformanceMetrics,
      PerformanceMetrics[keyof PerformanceMetrics]
    ]>
  )
    .map(([key, value]) => {
      const thresholds = PERFORMANCE_THRESHOLDS[key];
      return scoreTiming(value, thresholds.good, thresholds.poor);
    })
    .filter((value): value is number => value !== null);

  const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 100;

  return { metrics, score };
}

async function runAccessibilityAudit(page: Page): Promise<AccessibilityAuditResult> {
  await page.addScriptTag({ content: axeSource });
  const raw: AxeResults = await page.evaluate(async () => {
    const axe = (window as typeof window & { axe?: { run: typeof import('axe-core')['run'] } }).axe;
    if (!axe) {
      throw new Error('axe-core failed to load in the browser context.');
    }
    return await axe.run(document, { reporter: 'v2', resultTypes: ['violations', 'passes'] });
  });

  const violations: AxeViolationSummary[] = raw.violations.map((violation: AxeRuleResult) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node: AxeNodeResult) => ({
      html: node.html,
      target: Array.isArray(node.target) ? node.target.map((value) => value.toString()) : [],
      failureSummary: node.failureSummary ?? undefined
    }))
  }));

  const severityWeights: Record<string, number> = {
    minor: 1,
    moderate: 2,
    serious: 3,
    critical: 4
  };

  const weightedViolations = raw.violations.reduce((total, violation) => {
    const weight = severityWeights[violation.impact ?? 'moderate'] ?? 2;
    return total + weight * violation.nodes.length;
  }, 0);

  const score = Math.max(0, Math.round(100 - Math.min(100, weightedViolations * 4)));

  return {
    score,
    violations,
    passes: raw.passes.length
  };
}

async function runSeoAudit(page: Page): Promise<SeoAuditResult> {
  const data = await page.evaluate(() => {
    const doc = document;
    const title = doc.title?.trim() ?? '';
    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ?? '';
    const lang = doc.documentElement?.getAttribute('lang')?.trim() ?? '';
    const h1Count = doc.querySelectorAll('h1').length;
    const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content')?.toLowerCase() ?? '';

    const images = Array.from(doc.querySelectorAll('img')) as HTMLImageElement[];
    const imagesWithAlt = images.filter((image) => (image.getAttribute('alt') ?? '').trim().length > 0).length;
    const imageCoverage = images.length === 0 ? 1 : imagesWithAlt / images.length;

    const structuredData = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
      .map((script) => script.textContent?.trim())
      .filter(Boolean);

    const checks: SeoCheck[] = [
      { id: 'title', label: 'Document has a <title> tag', passed: title.length > 0 },
      {
        id: 'description-length',
        label: 'Meta description is between 50 and 160 characters',
        passed: description.length >= 50 && description.length <= 160
      },
      { id: 'canonical', label: 'Canonical link is defined', passed: canonical.length > 0 },
      { id: 'lang', label: '<html> has a lang attribute', passed: lang.length > 0 },
      { id: 'single-h1', label: 'Exactly one <h1> element exists', passed: h1Count === 1 },
      { id: 'robots', label: 'Robots meta tag does not block indexing', passed: !robots.includes('noindex') },
      { id: 'image-alt', label: 'At least 80% of images include alt text', passed: imageCoverage >= 0.8 },
      { id: 'structured-data', label: 'Structured data is present', passed: structuredData.length > 0 }
    ];

    return {
      checks,
      imageAltCoverage: Math.round(imageCoverage * 100),
      metaDescriptionLength: description ? description.length : null
    };
  });

  const passedChecks = data.checks.filter((check) => check.passed).length;
  const score = data.checks.length ? Math.round((passedChecks / data.checks.length) * 100) : 100;
  const issues = data.checks.filter((check) => !check.passed).map((check) => check.label);

  return {
    score,
    checks: data.checks,
    issues,
    imageAltCoverage: data.imageAltCoverage,
    metaDescriptionLength: data.metaDescriptionLength
  };
}

function scoreTiming(value: number | null, good: number, poor: number): number | null {
  if (value == null) {
    return null;
  }
  if (value <= good) {
    return 100;
  }
  if (value >= poor) {
    return 0;
  }
  const range = poor - good;
  const clamped = Math.max(0, Math.min(range, poor - value));
  return Math.round((clamped / range) * 100);
}

function toSafeFilename(urlString: string): string {
  return urlString.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'page';
}
