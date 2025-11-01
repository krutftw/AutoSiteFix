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
  totalPages: number;
  pagesWithViolations: number;
  totalViolations: number;
  averageViolations: number;
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
      totalPages: 0,
      pagesWithViolations: 0,
      totalViolations: 0,
      averageViolations: 0
    };
  }

  const totals = pages.reduce(
    (acc, page) => {
      const violations = page.axe.violations?.length ?? 0;
      acc.totalViolations += violations;
      if (violations > 0) {
        acc.pagesWithViolations += 1;
      }
      return acc;
    },
    { totalViolations: 0, pagesWithViolations: 0 }
  );

  return {
    totalPages: pages.length,
    pagesWithViolations: totals.pagesWithViolations,
    totalViolations: totals.totalViolations,
    averageViolations: totals.totalViolations / pages.length
  };
}

function renderHtmlReport(result: AuditRunResult, summary: SummaryMetrics, title?: string): string {
  const pageRows = result.pages
    .map((page) => {
      const violations = page.axe.violations
        .map(
          (violation) =>
            `<li><strong>${escapeHtml(violation.id)}</strong> – ${escapeHtml(violation.description)} (${escapeHtml(
              violation.impact ?? 'unknown'
            )})</li>`
        )
        .join('');

      return `
        <tr>
          <td><a href="${escapeAttribute(page.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        page.url
      )}</a></td>
          <td>${page.metadata.status ?? 'n/a'}</td>
          <td>${escapeHtml(page.metadata.title ?? 'Untitled')}</td>
          <td>${page.axe.violations.length}</td>
        </tr>
        <tr class="violations">
          <td colspan="4">
            <details>
              <summary>View accessibility issues</summary>
              <ul>${violations || '<li>No issues found 🎉</li>'}</ul>
            </details>
          </td>
        </tr>
      `;
    })
    .join('');

  const tableBody = pageRows ||
    `<tr><td colspan="4">No pages were audited. Please verify the URL and try again.</td></tr>`;

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
        tbody tr.violations td {
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
            <h2>Total Pages</h2>
            <strong>${summary.totalPages}</strong>
          </div>
          <div class="summary-card">
            <h2>Pages with Violations</h2>
            <strong>${summary.pagesWithViolations}</strong>
          </div>
          <div class="summary-card">
            <h2>Total Violations</h2>
            <strong>${summary.totalViolations}</strong>
          </div>
          <div class="summary-card">
            <h2>Average Violations</h2>
            <strong>${summary.averageViolations.toFixed(2)}</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Status</th>
              <th>Title</th>
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
