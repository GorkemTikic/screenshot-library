import { afterEach, describe, expect, it, vi } from 'vitest';
import { readHistoricalImageBlobSha } from '../src/github';
import type { Env } from '../src/types';

afterEach(() => vi.unstubAllGlobals());

describe('historical image recovery', () => {
  it('resolves the prior image blob from the mutation commit parent', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ parents: [{ sha: 'parent-sha' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: 'historical-blob', type: 'file' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = {
      GITHUB_TOKEN: 'test-token',
      GITHUB_OWNER: 'owner',
      GITHUB_REPO: 'repo',
      GITHUB_BRANCH: 'main',
    } as Env;

    await expect(readHistoricalImageBlobSha(env, 'replacement-commit', 'screenshots/old image.png'))
      .resolves.toBe('historical-blob');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/git/commits/replacement-commit');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/contents/public/screenshots/old%20image.png?ref=parent-sha');
  });
});
