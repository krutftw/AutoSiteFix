import process from 'node:process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { runAudit } from '@autositefix/auditor';
import type { AuditProgressEvent, AuditRunResult } from '@autositefix/auditor';
import { applyFixes, FixCategory, FixExecutionResult, generateWordPressPlugin } from '@autositefix/fixer';
import { finalizePullRequest, prepareRepository } from '@autositefix/git';
import { summarize, writeReport } from '@autositefix/report';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const ansi = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  gray: '\u001b[90m',
  red: '\u001b[31m'
};

const colors = {
  bold: (text: string) => `${ansi.bold}${text}${ansi.reset}`,
  cyan: (text: string) => `${ansi.cyan}${text}${ansi.reset}`,
  green: (text: string) => `${ansi.green}${text}${ansi.reset}`,
  yellow: (text: string) => `${ansi.yellow}${text}${ansi.reset}`,
  gray: (text: string) => `${ansi.gray}${text}${ansi.reset}`,
  red: (text: string) => `${ansi.red}${text}${ansi.reset}`
};

export interface CliOptions {
  url: string;
  pages: number;
  fix: FixCategory[];
  dryRun: boolean;
  provider?: string;
  wordpress: boolean;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const args = await parseArguments(argv);

  const audit = await runAudit({
    url: args.url,
    pages: args.pages,
    onProgress: handleProgress
  });

  const summary = summarize(audit.pages);
  const locations = await writeReport(audit, { title: `AutoSiteFix report for ${args.url}` });
  renderSummary(audit, summary, locations.html);

  let fixResult: FixExecutionResult | undefined;

  if (args.wordpress) {
    fixResult = await generateWordPressPlugin({
      siteUrl: args.url,
      dryRun: args.dryRun
    });
  } else if (args.fix.length > 0) {
    fixResult = await applyFixes({
      siteUrl: args.url,
      categories: args.fix,
      dryRun: args.dryRun
    });
  }

  if (!fixResult || args.dryRun) {
    logDryRunNotice(args.dryRun, fixResult);
    return;
  }

  const shouldContinue = await promptYesNo('Apply and open PR? (y/N)');
  if (!shouldContinue) {
    console.log(colors.yellow('Aborted before creating a pull request.'));
    return;
  }

  const repoContext = await prepareRepository({ dryRun: false });

  await finalizePullRequest({
    repo: repoContext,
    fixes: fixResult,
    audit,
    summary
  });

  console.log(colors.green('Pull request opened successfully.'));
}

async function parseArguments(argv: string[]): Promise<CliOptions> {
  const parser = yargs(hideBin(argv))
    .scriptName('autositefix')
    .usage('$0 --url <url> [options]')
    .option('url', {
      type: 'string',
      describe: 'Entry URL to audit',
      demandOption: true
    })
    .option('pages', {
      type: 'number',
      describe: 'Maximum number of pages to audit',
      default: 5
    })
    .option('fix', {
      type: 'string',
      describe: 'Comma-separated fix categories (perf,a11y,seo)',
      default: ''
    })
    .option('dry-run', {
      type: 'boolean',
      describe: 'Preview changes without modifying files or opening a PR',
      default: false
    })
    .option('provider', {
      type: 'string',
      describe: 'Optional AI provider identifier'
    })
    .option('wordpress', {
      type: 'boolean',
      describe: 'Generate WordPress micro-plugin instead of direct edits',
      default: false
    })
    .alias('h', 'help')
    .alias('v', 'version')
    .example('$0 --url https://example.com --pages 5', 'Audit the top five pages')
    .example(
      '$0 --url https://example.com --fix perf,a11y --dry-run',
      'Preview performance and accessibility fixes'
    )
    .check((parsed: Record<string, unknown>) => {
      if (!parsed.url) {
        throw new Error('A URL is required.');
      }

      const pagesValue = typeof parsed.pages === 'number' ? parsed.pages : Number(parsed.pages);

      if (pagesValue && pagesValue <= 0) {
        throw new Error('`--pages` must be a positive integer.');
      }

      return true;
    });

  const parsed = await parser.parseAsync();
  const fixCategories = (parsed.fix as string)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as FixCategory[];

  return {
    url: parsed.url as string,
    pages: parsed.pages as number,
    fix: fixCategories,
    dryRun: Boolean(parsed['dry-run']),
    provider: parsed.provider as string | undefined,
    wordpress: Boolean(parsed.wordpress)
  };
}

function handleProgress(event: AuditProgressEvent): void {
  switch (event.type) {
    case 'discover-start':
      console.log(colors.cyan(`Discovering pages starting from ${event.url}...`));
      break;
    case 'discover-complete':
      console.log(colors.cyan(`Discovered ${event.urls.length} page(s) to audit.`));
      break;
    case 'page-start':
      console.log(colors.gray(`Auditing ${event.url}...`));
      break;
    case 'page-complete':
      console.log(colors.green(`Completed ${event.url}`));
      break;
    case 'error':
      console.error(colors.red(`Failed to audit ${event.url}: ${event.error.message}`));
      break;
    default:
      break;
  }
}

function renderSummary(
  result: AuditRunResult,
  summary: ReturnType<typeof summarize>,
  htmlReportPath: string
): void {
  console.log('\n' + colors.bold('Audit summary'));
  console.log('='.repeat(40));
  console.log(`Pages audited: ${result.pages.length}`);
  console.log(`Average performance: ${summary.averagePerformance}`);
  console.log(`Average accessibility: ${summary.averageAccessibility}`);
  console.log(`Average SEO: ${summary.averageSeo}`);
  console.log(`Total axe violations: ${summary.totalViolations}`);
  console.log(colors.gray(`Detailed report saved to ${htmlReportPath}`));
}

async function promptYesNo(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return false;
  }

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`${question} `);
  await rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

function logDryRunNotice(dryRun: boolean, fixes?: FixExecutionResult): void {
  if (dryRun) {
    console.log(colors.yellow('Dry run enabled: no files were modified.'));
  }

  if (fixes) {
    console.log(colors.gray(`Identified ${fixes.filesChanged} file(s) for updates.`));
  }
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(colors.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
