#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';

import { runAudit } from '@autositefix/auditor';
import type { FixExecutionResult } from '@autositefix/fixer';
import { finalizePullRequest, prepareRepository } from '@autositefix/git';
import { summarize, writeReport } from '@autositefix/report';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export interface CliArguments {
  url: string;
  pages: number;
  dryRun: boolean;
  openPr: boolean;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const args = await parseArguments(argv);

  const auditResult = await runAudit({
    url: args.url,
    pages: args.pages
  });

  const locations = await writeReport(auditResult);
  const reportDir = path.dirname(locations.html);
  console.log(`Report generated at ${reportDir}`);

  if (args.openPr && !args.dryRun) {
    const repo = await prepareRepository({ dryRun: false });
    const summary = summarize(auditResult.pages);
    const fixes: FixExecutionResult = {
      filesChanged: 0,
      fixesApplied: ['Generated AutoSiteFix report'],
      details: []
    };

    await finalizePullRequest({
      repo,
      fixes,
      audit: auditResult,
      summary,
      title: 'AutoSiteFix report'
    });
  }
}

async function parseArguments(argv: string[]): Promise<CliArguments> {
  const parser = yargs(hideBin(argv))
    .scriptName('autositefix')
    .usage('$0 --url <url> [options]')
    .option('url', {
      type: 'string',
      describe: 'URL to audit',
      demandOption: true
    })
    .option('pages', {
      type: 'number',
      describe: 'Number of pages to audit',
      default: 5
    })
    .option('dry-run', {
      type: 'boolean',
      describe: 'Skip writing changes or opening pull requests',
      default: false
    })
    .option('open-pr', {
      type: 'boolean',
      describe: 'Open a pull request after generating the report',
      default: false
    })
    .help();

  const parsed = await parser.parseAsync();

  return {
    url: parsed.url as string,
    pages: parsed.pages as number,
    dryRun: Boolean(parsed['dry-run']),
    openPr: Boolean(parsed['open-pr'])
  };
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
