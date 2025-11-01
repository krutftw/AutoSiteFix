import fs from 'node:fs/promises';
import path from 'node:path';

import type { AuditRunResult } from '@autositefix/auditor';
import type { SummaryMetrics } from '@autositefix/report';
import { Octokit } from '@octokit/rest';
import { simpleGit, SimpleGit } from 'simple-git';

import type { FixExecutionResult } from '@autositefix/fixer';

export interface PrepareRepositoryOptions {
  dryRun?: boolean;
  branchPrefix?: string;
}

export interface GitRepositoryContext {
  git: SimpleGit;
  branch: string;
  baseBranch: string;
  remoteUrl?: string;
  owner?: string;
  repo?: string;
  dryRun: boolean;
}

export interface FinalizePullRequestOptions {
  repo: GitRepositoryContext;
  fixes: FixExecutionResult;
  audit: AuditRunResult;
  summary: SummaryMetrics;
  title?: string;
}

export async function prepareRepository(
  options: PrepareRepositoryOptions = {}
): Promise<GitRepositoryContext> {
  const git = simpleGit();
  const dryRun = Boolean(options.dryRun);
  const branchPrefix = options.branchPrefix ?? 'autositefix/fixes-';

  const root = await git.revparse(['--show-toplevel']);
  git.cwd(root);

  const branchSummary = await git.branch();
  const baseBranch = branchSummary.current;

  const dateStamp = new Date().toISOString().slice(0, 10);
  const branch = `${branchPrefix}${dateStamp}`;

  if (!dryRun) {
    if (branchSummary.all.includes(branch)) {
      await git.checkout(branch);
    } else {
      await git.checkoutLocalBranch(branch);
    }
  }

  const remoteUrl = (await git.remote(['get-url', 'origin']).catch(() => undefined))?.trim();
  const remoteInfo = remoteUrl ? parseRemote(remoteUrl) : undefined;

  return {
    git,
    branch,
    baseBranch,
    remoteUrl,
    owner: remoteInfo?.owner,
    repo: remoteInfo?.repo,
    dryRun
  };
}

export async function finalizePullRequest(options: FinalizePullRequestOptions): Promise<void> {
  const { git, branch, baseBranch, dryRun } = options.repo;
  const status = await git.status();

  if (status.staged.length === 0 && status.modified.length === 0 && status.created.length === 0) {
    console.warn('No changes detected; skipping commit and PR creation.');
    return;
  }

  if (!dryRun) {
    await git.add(['.']);
    const refreshed = await git.status();
    if (refreshed.staged.length === 0) {
      console.warn('No staged changes found after adding files.');
      return;
    }

    await git.commit('chore: apply AutoSiteFix improvements');
    await git.push('origin', branch, { '--set-upstream': null }).catch(async (error) => {
      if (error instanceof Error && error.message.includes('set-upstream')) {
        await git.push(['-u', 'origin', branch]);
        return;
      }
      throw error;
    });
  }

  const token = process.env.GITHUB_TOKEN;
  const { owner, repo } = options.repo;

  if (!token || !owner || !repo) {
    console.warn('Skipping PR creation: missing GitHub token or remote information.');
    return;
  }

  const octokit = new Octokit({ auth: token });
  const title = options.title ?? 'AutoSiteFix improvements';
  const body = buildPullRequestBody(options);

  await octokit.pulls.create({
    owner,
    repo,
    head: branch,
    base: baseBranch,
    title,
    body
  });
}

function buildPullRequestBody(options: FinalizePullRequestOptions): string {
  const { fixes, summary, audit } = options;
  const fileList = fixes.details
    .map((detail) => `- \`${detail.file}\` — ${detail.actions.join(', ')}`)
    .join('\n');

  const summaryTable = `| Metric | Value |\n| --- | --- |\n| Pages audited | ${summary.totalPages} |\n| Pages with violations | ${summary.pagesWithViolations} |\n| Total accessibility violations | ${summary.totalViolations} |\n| Average violations per page | ${summary.averageViolations.toFixed(2)} |`;

  const artifactNote = audit.pages
    .map((page) => `- ${page.url} — ${page.axe.violations.length} violation(s)`)
    .join('\n');

  const fixesApplied = fixes.fixesApplied.length
    ? fixes.fixesApplied.map((item) => `- ${item}`).join('\n')
    : '- Automated fixes applied';

  return `## Summary\n\n${fixesApplied}\n\n## Accessibility overview\n\n${summaryTable}\n\nAudited pages:\n${artifactNote || '- No pages were audited.'}\n\n## File changes\n\n${fileList || 'No direct file changes recorded.'}\n`;
}

function parseRemote(remoteUrl: string): { owner: string; repo: string } | undefined {
  if (remoteUrl.startsWith('git@')) {
    const match = remoteUrl.match(/git@[^:]+:([^/]+)\/(.+)\.git/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

  try {
    const url = new URL(remoteUrl.replace(/\.git$/, ''));
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return { owner: segments[0], repo: segments[1] };
    }
  } catch {
    // ignore parsing errors
  }

  return undefined;
}

export async function writeFileListToDisk(
  fixes: FixExecutionResult,
  outputPath = path.resolve('autositefix-report', 'applied-fixes.md')
): Promise<void> {
  if (!fixes.details.length) {
    return;
  }

  const lines = fixes.details
    .map((detail) => `- ${detail.file}: ${detail.actions.join(', ')}`)
    .join('\n');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `# Applied fixes\n\n${lines}\n`, 'utf8');
}
