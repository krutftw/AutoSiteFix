import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { applyFixes, generateWordPressPlugin } from '../dist/index.js';

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autositefix-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('applyFixes', () => {
  it('updates HTML documents with lazy images and metadata', async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, 'index.html');
    await fs.writeFile(
      filePath,
      '<html><head><title>Test</title></head><body><img src="hero.jpg"><script src="/app.js"></script></body></html>'
    );

    const result = await applyFixes({
      siteUrl: 'https://example.com/',
      categories: ['perf', 'a11y', 'seo'],
      cwd: dir
    });

    expect(result.filesChanged).toBe(1);
    const updated = await fs.readFile(filePath, 'utf8');
    expect(updated).toContain('loading="lazy"');
    expect(updated).toContain('decoding="async"');
    expect(updated).toContain('rel="canonical" href="https://example.com/"');
    expect(updated).toContain('rel="preconnect" href="https://example.com"');
    expect(updated).toContain('meta name="description"');
    expect(updated).toContain('<script src="/app.js" defer></script>');
  });

  it('updates JSX files with lazy images and head metadata', async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, 'page.tsx');
    await fs.writeFile(
      filePath,
      `import Head from 'next/head';

export default function Page() {
  return (
    <>
      <Head>
        <title>Example</title>
      </Head>
      <img src="/hero.jpg" />
      <script src="/bundle.js"></script>
    </>
  );
}
`
    );

    const result = await applyFixes({
      siteUrl: 'https://example.com/',
      categories: ['perf', 'a11y', 'seo'],
      cwd: dir
    });

    expect(result.filesChanged).toBe(1);
    const updated = await fs.readFile(filePath, 'utf8');
    expect(updated).toContain('loading="lazy"');
    expect(updated).toContain('decoding="async"');
    expect(updated).toContain('<link rel="canonical" href="https://example.com/" />');
    expect(updated).toContain('<link rel="preconnect" href="https://example.com" crossorigin />');
    expect(updated).toContain('<meta name="description" content="Automated improvements provided by AutoSiteFix." />');
    expect(updated).toContain('<script src="/bundle.js" defer></script>');
  });

  it('is idempotent when run twice', async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, 'index.html');
    await fs.writeFile(
      filePath,
      '<html><head><title>Test</title></head><body><img src="hero.jpg"></body></html>'
    );

    await applyFixes({ siteUrl: 'https://example.com/', categories: ['perf', 'a11y', 'seo'], cwd: dir });
    const second = await applyFixes({
      siteUrl: 'https://example.com/',
      categories: ['perf', 'a11y', 'seo'],
      cwd: dir
    });

    expect(second.filesChanged).toBe(0);
  });
});

describe('generateWordPressPlugin', () => {
  it('creates plugin files when not in dry run', async () => {
    const dir = await createTempDir();
    const result = await generateWordPressPlugin({ siteUrl: 'https://example.com/', outputDir: dir });

    expect(result.filesChanged).toBe(2);
    const pluginPath = path.join(dir, 'wp-content', 'plugins', 'autositefix-fixes', 'autositefix-fixes.php');
    const pluginContents = await fs.readFile(pluginPath, 'utf8');
    expect(pluginContents).toContain("add_action('wp_head'");
    expect(pluginContents).toContain('loading="lazy"');
  });
});
