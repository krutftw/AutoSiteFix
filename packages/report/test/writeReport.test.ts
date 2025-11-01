import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeReport } from '../src/index';
import { fixtureAuditResult } from './fixtures/audit-result';

describe('writeReport', () => {
  it('writes the audit report to HTML and JSON files', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'autositefix-report-'));
    const outputDir = path.join(tmpRoot, 'reports');

    const locations = await writeReport(fixtureAuditResult, {
      outputDir,
      title: 'Fixture Audit Summary'
    });

    expect(locations).toEqual({
      json: path.join(outputDir, 'report.json'),
      html: path.join(outputDir, 'index.html')
    });

    const jsonContents = await fs.readFile(locations.json, 'utf8');
    expect(JSON.parse(jsonContents)).toEqual(fixtureAuditResult);

    const htmlContents = await fs.readFile(locations.html, 'utf8');
    expect(htmlContents).toContain('<title>Fixture Audit Summary</title>');
    expect(htmlContents).toContain('Audited 2 page(s)');
    expect(htmlContents).toContain('https://example.com');
    expect(htmlContents).toContain('color-contrast');
    expect(htmlContents).toContain('<td>1</td>');
  });
});
