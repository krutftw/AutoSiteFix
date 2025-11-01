import { vi } from 'vitest';

const createMockPage = () => ({
  setDefaultNavigationTimeout: vi.fn(),
  goto: vi.fn(),
  close: vi.fn()
});

const createMockBrowser = () => ({
  newPage: vi.fn(async () => createMockPage()),
  close: vi.fn(),
  disconnect: vi.fn()
});

vi.mock('puppeteer', () => {
  const browser = createMockBrowser();
  const connect = vi.fn(async () => browser);
  const launch = vi.fn(async () => browser);

  return {
    default: {
      connect,
      launch
    },
    connect,
    launch
  };
});

vi.mock('@axe-core/puppeteer', () => {
  class MockAxePuppeteer {
    constructor(page: unknown) {
      void page;
    }

    analyze = vi.fn(async () => ({ violations: [] }));
  }

  return { AxePuppeteer: MockAxePuppeteer };
});
