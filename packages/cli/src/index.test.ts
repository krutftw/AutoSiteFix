import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@autositefix/auditor', () => ({
  runAudit: vi.fn()
}), { virtual: true });

vi.mock('@autositefix/report', () => ({
  writeReport: vi.fn(),
  summarize: vi.fn()
}), { virtual: true });

vi.mock('@autositefix/git', () => ({
  prepareRepository: vi.fn(),
  finalizePullRequest: vi.fn()
}), { virtual: true });

import { runAudit } from '@autositefix/auditor';
import { finalizePullRequest, prepareRepository } from '@autositefix/git';
import { summarize, writeReport } from '@autositefix/report';

import { runCli } from './index';

describe('runCli', () => {
  const auditResult = {
    pages: [],
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:05:00.000Z'
  };

  const repoContext = {
    git: {} as unknown,
    branch: 'autositefix/fixes',
    baseBranch: 'main',
    dryRun: false
  } as const;

  beforeEach(() => {
    vi.mocked(runAudit).mockResolvedValue(auditResult as never);
    vi.mocked(writeReport).mockResolvedValue({
      json: '/tmp/autositefix-report/report.json',
      html: '/tmp/autositefix-report/index.html'
    });
    vi.mocked(summarize).mockReturnValue({
      averageAccessibility: 0,
      averagePerformance: 0,
      averageSeo: 0,
      totalViolations: 0
    });
    vi.mocked(prepareRepository).mockResolvedValue(repoContext as never);
    vi.mocked(finalizePullRequest).mockResolvedValue(undefined as never);
  });

  it('runs the audit and writes the report with default options', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runCli(['node', 'autositefix', '--url', 'https://example.com']);

    expect(runAudit).toHaveBeenCalledWith({ url: 'https://example.com', pages: 5 });
    expect(writeReport).toHaveBeenCalledWith(auditResult);
    expect(logSpy).toHaveBeenCalledWith('Report generated at /tmp/autositefix-report');
    expect(prepareRepository).not.toHaveBeenCalled();
    expect(finalizePullRequest).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('passes through CLI options and avoids PR flow when dry-run is enabled', async () => {
    await runCli([
      'node',
      'autositefix',
      '--url',
      'https://example.com',
      '--pages',
      '3',
      '--dry-run',
      '--open-pr'
    ]);

    expect(runAudit).toHaveBeenCalledWith({ url: 'https://example.com', pages: 3 });
    expect(prepareRepository).not.toHaveBeenCalled();
    expect(finalizePullRequest).not.toHaveBeenCalled();
  });

  it('opens a pull request when requested and not a dry run', async () => {
    await runCli(['node', 'autositefix', '--url', 'https://example.com', '--open-pr']);

    expect(prepareRepository).toHaveBeenCalledWith({ dryRun: false });
    expect(finalizePullRequest).toHaveBeenCalledWith({
      repo: repoContext,
      fixes: {
        filesChanged: 0,
        fixesApplied: ['Generated AutoSiteFix report'],
        details: []
      },
      audit: auditResult,
      summary: {
        averageAccessibility: 0,
        averagePerformance: 0,
        averageSeo: 0,
        totalViolations: 0
      },
      title: 'AutoSiteFix report'
    });
  });
});
