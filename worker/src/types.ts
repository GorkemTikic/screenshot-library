import type { SessionRole } from './crypto';

export interface Env {
  DB: D1Database;
  CATALOG_WRITER: DurableObjectNamespace;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  SESSION_SECRET: string;
  OWNER_BOOTSTRAP_CODE: string;
  ALLOWED_ORIGINS: string;
}

export interface ContributorRow {
  id: string;
  display_name: string;
  role: SessionRole;
  code_hash: string;
  code_salt: string;
  status: 'active' | 'disabled';
  code_version: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface Principal {
  id: string;
  displayName: string;
  role: SessionRole;
  sessionId: string;
  codeVersion: number;
}
