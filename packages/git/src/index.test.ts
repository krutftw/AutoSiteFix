import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCheckout,
  mockCheckoutLocalBranch,
  mockAdd,
  mockCommit,
  mockStatus,
  mockBranch,
  mockRevparse,
  mockCwd,
  simpleGitMock,
  mockPullsCreate,
  OctokitMock
} = vi.hoisted(() => ({
  mockCheckout: vi.fn(),
  mockCheckoutLocalBranch: vi.fn(),
  mockAdd: vi.fn(),
  mockCommit: vi.fn(),
  mockStatus: vi.fn(),
  mockBranch: vi.fn(),
  mockRevparse: vi.fn(),
  mockCwd: vi.fn(),
  simpleGitMock: vi.fn(),
  mockPullsCreate: vi.fn(),
  OctokitMock: vi.fn()
}));

vi.mock('simple-git', () => ({
  simpleGit: simpleGitMock,
  SimpleGit: function () {
    /* noop */
  }
}));

vi.mock('@octokit/rest', () => ({
  Octokit: OctokitMock
}));

import {
  commitAll,
  createBranch,
  openPullRequest,
  type OpenPullRequestOptions
} from './index';

const gitInstance = {
  checkout: mockCheckout,
  checkoutLocalBranch: mockCheckoutLocalBranch,
  add: mockAdd,
  commit: mockCommit,
  status: mockStatus,
  branch: mockBranch,
  revparse: mockRevparse,
  cwd: mockCwd
};

beforeEach(() => {
  vi.clearAllMocks();
  simpleGitMock.mockReturnValue(gitInstance);
  OctokitMock.mockImplementation(() => ({ pulls: { create: mockPullsCreate } }));
  mockRevparse.mockResolvedValue('/repo');
  delete process.env.GITHUB_TOKEN;
});

afterEach(() => {
  delete process.env.GITHUB_TOKEN;
});

describe('createBranch', () => {
  it('checks out a new branch when it does not exist', async () => {
    mockBranch.mockResolvedValue({ all: [] });

    await createBranch('feature/new');

    expect(simpleGitMock).toHaveBeenCalled();
    expect(mockCheckoutLocalBranch).toHaveBeenCalledWith('feature/new');
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it('checks out an existing branch when present', async () => {
    mockBranch.mockResolvedValue({ all: ['feature/new'] });

    await createBranch('feature/new');

    expect(mockCheckout).toHaveBeenCalledWith('feature/new');
    expect(mockCheckoutLocalBranch).not.toHaveBeenCalled();
  });
});

describe('commitAll', () => {
  it('stages all files and commits when changes are present', async () => {
    mockStatus.mockResolvedValue({ staged: ['file.ts'] });

    await commitAll('feat: commit message');

    expect(mockAdd).toHaveBeenCalledWith(['.']);
    expect(mockCommit).toHaveBeenCalledWith('feat: commit message');
  });

  it('skips commit when there are no staged changes', async () => {
    mockStatus.mockResolvedValue({ staged: [] });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await commitAll('feat: nothing');

    expect(mockCommit).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('No changes to commit.');

    warnSpy.mockRestore();
  });
});

describe('openPullRequest', () => {
  const options: OpenPullRequestOptions = {
    owner: 'octocat',
    repo: 'hello-world',
    head: 'feature/new',
    base: 'main',
    title: 'Add new feature',
    body: 'This is a PR body.'
  };

  it('creates a pull request when token is available', async () => {
    process.env.GITHUB_TOKEN = 'secret';

    await openPullRequest(options);

    expect(OctokitMock).toHaveBeenCalledWith({ auth: 'secret' });
    expect(mockPullsCreate).toHaveBeenCalledWith(options);
  });

  it('returns early when the token is missing', async () => {
    delete process.env.GITHUB_TOKEN;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await openPullRequest(options);

    expect(OctokitMock).not.toHaveBeenCalled();
    expect(mockPullsCreate).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('Skipping PR creation: missing GitHub token.');

    warnSpy.mockRestore();
  });
});
