import fs from 'node:fs/promises';
import path from 'node:path';

import type { AuditRunResult, PageAuditResult } from '@autositefix/auditor';

export interface ReportLocations {
  json: string;
  html: string;
}

export interface ReportOptions {
  outputDir?: string;
  title?: string;
}

export interface SummaryMetrics {
  averagePerformance: number;
  averageAccessibility: number;
  averageSeo: number;
  totalViolations: number;
}

export async function writeReport(
  result: AuditRunResult,
  options: ReportOptions = {}
): Promise<ReportLocations> {
  const outputDir = path.resolve(options.outputDir ?? 'autositefix-report');
  await fs.mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, 'report.json');
  const htmlPath = path.join(outputDir, 'index.html');

  await fs.writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf8');

  const summary = summarize(result.pages);
  const html = renderHtmlReport(result, summary, options.title);
  await fs.writeFile(htmlPath, html, 'utf8');

  return { json: jsonPath, html: htmlPath };
}

export function summarize(pages: PageAuditResult[]): SummaryMetrics {
  if (pages.length === 0) {
    return {
      averagePerformance: 0,
      averageAccessibility: 0,
      averageSeo: 0,
      totalViolations: 0
    };
  }

  const totals = pages.reduce(
    (acc, page) => {
      acc.performance += page.performance.score;
      acc.accessibility += page.accessibility.score;
      acc.seo += page.seo.score;
      acc.violations += page.accessibility.violations.length;
      return acc;
    },
    { performance: 0, accessibility: 0, seo: 0, violations: 0 }
  );

  return {
    averagePerformance: Math.round(totals.performance / pages.length),
    averageAccessibility: Math.round(totals.accessibility / pages.length),
    averageSeo: Math.round(totals.seo / pages.length),
    totalViolations: totals.violations
  };
}

function renderHtmlReport(result: AuditRunResult, summary: SummaryMetrics, title?: string): string {
  const pageRows = result.pages
    .map((page) => {
      const violations = page.accessibility.violations
        .map(
          (violation) =>
            `<li><strong>${escapeHtml(violation.id)}</strong> – ${escapeHtml(violation.description)} (${escapeHtml(
              violation.impact ?? 'unknown'
            )})</li>`
        )
        .join('');

      const seoIssues = page.seo.issues
        .map((issue) => `<li>${escapeHtml(issue)}</li>`)
        .join('');

      const performanceDetails = [
        `FCP: ${formatTiming(page.performance.metrics.firstContentfulPaint)}`,
        `LCP: ${formatTiming(page.performance.metrics.largestContentfulPaint)}`,
        `DOMContentLoaded: ${formatTiming(page.performance.metrics.domContentLoaded)}`,
        `DOM interactive: ${formatTiming(page.performance.metrics.domInteractive)}`
      ].join(' \u2022 ');

      return `
        <tr>
          <td><a href="${escapeAttribute(page.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        page.url
      )}</a></td>
          <td>${page.performance.score}</td>
          <td>${page.accessibility.score}</td>
          <td>${page.seo.score}</td>
          <td>${page.accessibility.violations.length}</td>
        </tr>
        <tr class="details">
          <td colspan="5">
            <details>
              <summary>View audit details</summary>
              <div class="details-grid">
                <section>
                  <h3>Performance</h3>
                  <p>${performanceDetails}</p>
                </section>
                <section>
                  <h3>SEO</h3>
                  <ul>${seoIssues || '<li>All configured checks passed 🎉</li>'}</ul>
                </section>
                <section>
                  <h3>Accessibility</h3>
                  <ul>${violations || '<li>No issues found 🎉</li>'}</ul>
                </section>
              </div>
            </details>
          </td>
        </tr>
      `;
    })
    .join('');

  const tableBody =
    pageRows || `<tr><td colspan="5">No pages were audited. Please verify the URL and try again.</td></tr>`;

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title ?? 'AutoSiteFix Audit Report')}</title>
      <style>
        :root {
          color-scheme: light dark;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        body {
          margin: 0;
          padding: 2rem;
          background: #0f172a;
          color: #e2e8f0;
        }
        .container {
          max-width: 1100px;
          margin: 0 auto;
          background: rgba(15, 23, 42, 0.85);
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 40px 80px rgba(8, 47, 73, 0.45);
          backdrop-filter: blur(18px);
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 0.75rem;
        }
        p.lead {
          font-size: 1.1rem;
          opacity: 0.8;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 2rem;
          background: rgba(30, 41, 59, 0.6);
          border-radius: 12px;
          overflow: hidden;
        }
        th, td {
          padding: 0.85rem 1rem;
          text-align: left;
        }
        thead th {
          background: rgba(15, 118, 110, 0.35);
        }
        tbody tr:nth-child(even) {
          background: rgba(30, 64, 175, 0.25);
        }
        tbody tr.details td {
          background: rgba(15, 23, 42, 0.55);
        }
        details {
          margin-top: 0.5rem;
        }
        a {
          color: #38bdf8;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }
        .summary-card {
          padding: 1rem;
          border-radius: 12px;
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }
        .summary-card h2 {
          margin: 0;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #94a3b8;
        }
        .summary-card strong {
          display: block;
          margin-top: 0.4rem;
          font-size: 1.7rem;
          color: #f8fafc;
        }
        .details-grid {
          display: grid;
          gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          margin-top: 1rem;
        }
        .details-grid h3 {
          margin-top: 0;
          font-size: 1rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #94a3b8;
        }
        footer {
          margin-top: 2.5rem;
          font-size: 0.85rem;
          opacity: 0.6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${escapeHtml(title ?? 'AutoSiteFix Audit Report')}</h1>
        <p class="lead">Audited ${result.pages.length} page(s) between ${formatDate(
    result.startedAt
  )} and ${formatDate(result.completedAt)}.</p>

        <div class="summary-grid">
          <div class="summary-card">
            <h2>Performance</h2>
            <strong>${summary.averagePerformance}</strong>
          </div>
          <div class="summary-card">
            <h2>Accessibility</h2>
            <strong>${summary.averageAccessibility}</strong>
          </div>
          <div class="summary-card">
            <h2>SEO</h2>
            <strong>${summary.averageSeo}</strong>
          </div>
          <div class="summary-card">
            <h2>Axe Violations</h2>
            <strong>${summary.totalViolations}</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Performance</th>
              <th>Accessibility</th>
              <th>SEO</th>
              <th>Violations</th>
            </tr>
          </thead>
          <tbody>
            ${tableBody}
          </tbody>
        </table>

        <footer>
          Generated by <strong>AutoSiteFix</strong>. JSON report available alongside this HTML file.
        </footer>
      </div>
    </body>
  </html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatTiming(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return `${(value / 1000).toFixed(2)}s`;
}
