import { describe, expect, it } from 'vitest';

import { applyFixes } from '../src/html';

describe('applyFixes(html)', () => {
  it('adds lazy loading, required meta tags, and defers scripts', () => {
    const input = `<!doctype html><html><head><title>Test</title></head><body><img src="hero.jpg"><script src="/app.js"></script><script src="https://www.googletagmanager.com/gtag/js?id=UA-123"></script></body></html>`;

    const output = applyFixes(input);

    expect(output).toContain('<img src="hero.jpg" loading="lazy">');
    expect(output).toContain('<meta charset="utf-8">');
    expect(output).toContain(
      '<meta name="viewport" content="width=device-width,initial-scale=1">'
    );
    expect(output).toContain('<script src="/app.js" defer></script>');
    expect(output).toContain('https://www.googletagmanager.com/gtag/js?id=UA-123');
    expect(output).not.toContain('<script src="https://www.googletagmanager.com/gtag/js?id=UA-123" defer>');
  });

  it('is idempotent when applied multiple times', () => {
    const input = `<!doctype html><html><head><title>Test</title></head><body><img src="hero.jpg"></body></html>`;

    const once = applyFixes(input);
    const twice = applyFixes(once);

    expect(twice).toBe(once);
  });
});
