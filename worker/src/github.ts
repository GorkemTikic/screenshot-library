import type { CatalogItem } from './catalog';
import type { Env } from './types';

const API = 'https://api.github.com';

export interface RepoHead {
  commitSha: string;
  treeSha: string;
}

interface RepoState extends RepoHead {
  items: CatalogItem[];
}

interface TreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  content?: string;
  sha?: string | null;
}

function headers(env: Env): HeadersInit {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'fd-screenshot-library-api',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function github<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...headers(env), ...(init.headers || {}) } });
  if (!response.ok) {
    const detail: { message?: string } = await response.json<{ message?: string }>().catch(() => ({}));
    throw new Error(`GitHub ${response.status}: ${detail.message || response.statusText}`);
  }
  return response.json<T>();
}

function decodeFile(content: string): string {
  const binary = atob(content.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return btoa(binary);
}

export async function readRepoHead(env: Env): Promise<RepoHead> {
  const repo = `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
  const ref = await github<{ object: { sha: string } }>(env, `${repo}/git/ref/heads/${env.GITHUB_BRANCH}`);
  const commit = await github<{ tree: { sha: string } }>(env, `${repo}/git/commits/${ref.object.sha}`);
  return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
}

export async function readRepoState(env: Env): Promise<RepoState> {
  const head = await readRepoHead(env);
  const repo = `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
  const data = await github<{ content: string }>(env, `${repo}/contents/src/data/data.json?ref=${head.commitSha}`);
  const parsed = JSON.parse(decodeFile(data.content));
  if (!Array.isArray(parsed)) throw new Error('Remote catalog is not an array.');
  return { ...head, items: parsed as CatalogItem[] };
}

export async function createImageBlob(env: Env, bytes: Uint8Array): Promise<string> {
  const repo = `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
  const blob = await github<{ sha: string }>(env, `${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: encodeBytes(bytes), encoding: 'base64' }),
  });
  return blob.sha;
}

export async function createCommit(env: Env, state: RepoHead, entries: TreeEntry[], message: string): Promise<string> {
  const repo = `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
  const tree = await github<{ sha: string }>(env, `${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: state.treeSha, tree: entries }),
  });
  const commit = await github<{ sha: string }>(env, `${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [state.commitSha] }),
  });
  return commit.sha;
}

export async function advanceBranch(env: Env, commitSha: string): Promise<boolean> {
  const response = await fetch(`${API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/refs/heads/${env.GITHUB_BRANCH}`, {
    method: 'PATCH',
    headers: headers(env),
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
  if (response.status === 409 || response.status === 422) return false;
  if (!response.ok) {
    const detail: { message?: string } = await response.json<{ message?: string }>().catch(() => ({}));
    throw new Error(`GitHub ${response.status}: ${detail.message || response.statusText}`);
  }
  return true;
}

export function dataTreeEntry(items: CatalogItem[]): TreeEntry {
  return { path: 'src/data/data.json', mode: '100644', type: 'blob', content: `${JSON.stringify(items, null, 2)}\n` };
}

export function requestsTreeEntry(requests: unknown[]): TreeEntry {
  return { path: 'src/data/requests.json', mode: '100644', type: 'blob', content: `${JSON.stringify(requests, null, 2)}\n` };
}

export function imageTreeEntry(path: string, sha: string): TreeEntry {
  return { path: `public/${path}`, mode: '100644', type: 'blob', sha };
}

export function deleteTreeEntry(path: string): TreeEntry {
  return { path: `public/${path}`, mode: '100644', type: 'blob', sha: null };
}
