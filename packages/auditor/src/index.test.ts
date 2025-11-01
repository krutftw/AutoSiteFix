import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  launchMock: vi.fn(),
  newPageMock: vi.fn(),
  closeBrowserMock: vi.fn(),
  axeAnalyzeMock: vi.fn()
}));

vi.mock('puppeteer', () => ({
  default: {
    launch: mocks.launchMock
  },
  launch: mocks.launchMock
}));

vi.mock('@axe-core/puppeteer', () => ({
  AxePuppeteer: class {
    private readonly page: { url: () => string };

    constructor(page: { url: () => string }) {
      this.page = page;
    }

    analyze() {
      return mocks.axeAnalyzeMock(this.page);
    }
  }
}));

import { runAudit } from './index';

const originalFetch = globalThis.fetch;

describe('runAudit', () => {
  beforeEach(() => {
    mocks.fetchMock.mockReset();
    mocks.launchMock.mockReset();
    mocks.newPageMock.mockReset();
    mocks.closeBrowserMock.mockReset();
    mocks.axeAnalyzeMock.mockReset();
    mocks.closeBrowserMock.mockImplementation(async () => undefined);

    mocks.newPageMock.mockImplementation(() => createPageStub());

    mocks.launchMock.mockImplementation(async () => ({
      newPage: mocks.newPageMock,
      close: mocks.closeBrowserMock
    }));

    globalThis.fetch = mocks.fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('crawls up to the requested number of pages', async () => {
    const htmlByUrl = new Map<string, string>([
      [
        'https://example.com/',
        '<a href="/first">First</a><a href="https://example.com/second">Second</a><a href="https://other.com/">Other</a>'
      ],
      ['https://example.com/first', '<a href="/third">Third</a>'],
      ['https://example.com/second', '']
    ]);

    mockFetchResponses(htmlByUrl);
    mocks.axeAnalyzeMock.mockResolvedValue({ violations: [] });

    const result = await runAudit({ url: 'https://example.com/', pages: 2 });

    expect(mocks.launchMock).toHaveBeenCalledWith({
      headless: 'new',
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.newPageMock).toHaveBeenCalledTimes(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]?.url).toBe('https://example.com/');
    expect(result.pages[1]?.url).toBe('https://example.com/first');
  });

  it('records metadata and axe violations for each page', async () => {
    const htmlByUrl = new Map<string, string>([['https://example.com/', '']]);
    mockFetchResponses(htmlByUrl);

    mocks.axeAnalyzeMock.mockImplementation(async (page: { url: () => string }) => ({
      violations: [
        {
          id: `violation-${page.url()}`,
          description: 'Example description',
          impact: 'serious',
          nodes: []
        }
      ]
    }));

    const result = await runAudit({ url: 'https://example.com/', pages: 1 });

    expect(result.pages).toHaveLength(1);
    const page = result.pages[0];
    expect(page.metadata.title).toBeDefined();
    expect(page.metadata.status).toBe(200);
    expect(page.axe.violations[0]?.id).toBe('violation-https://example.com/');
  });
});

function mockFetchResponses(htmlByUrl: Map<string, string>): void {
  mocks.fetchMock.mockImplementation(async (input: any) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url ?? '';
    const html = htmlByUrl.get(url) ?? '';
    return {
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html' : null) },
      text: async () => html
    } as unknown as Response;
  });
}

function createPageStub() {
  let currentUrl = '';

  return {
    goto: vi.fn(async (url: string) => {
      currentUrl = url;
      return { status: () => 200 };
    }),
    url: () => currentUrl || 'about:blank',
    title: vi.fn(async () => `Title for ${currentUrl || 'about:blank'}`),
    setDefaultNavigationTimeout: vi.fn(),
    screenshot: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined)
  };
}
