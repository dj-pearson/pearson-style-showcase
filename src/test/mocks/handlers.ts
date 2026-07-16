/**
 * Mock data factories for tests.
 *
 * Each factory returns a plain object shaped like the corresponding domain
 * entity, with sensible defaults that can be overridden per-test via the
 * `overrides` argument. Keeping these here (rather than inline in tests) gives
 * the suite a single source of truth for fixture data.
 *
 * The factories are intentionally loosely typed (`Record<string, unknown>`
 * merged with overrides) so they stay decoupled from the auto-generated
 * Supabase row types, which change as the schema evolves.
 */

let idCounter = 0;

/** Deterministic-ish unique id helper for fixtures (no Math.random/Date use). */
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Reset the internal id counter (call in beforeEach if a test asserts on ids). */
export function resetFactoryIds(): void {
  idCounter = 0;
}

const FIXED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export interface MockArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  published: boolean;
  tags: string[];
  author_id: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export function createMockArticle(overrides: Partial<MockArticle> = {}): MockArticle {
  const id = overrides.id ?? nextId('article');
  return {
    id,
    title: 'Sample Article',
    slug: `sample-article-${id}`,
    content: '# Sample Article\n\nBody content.',
    excerpt: 'A short excerpt.',
    published: true,
    tags: ['AI', 'Technology'],
    author_id: 'user-1',
    created_at: FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
    ...overrides,
  };
}

export interface MockProject {
  id: string;
  title: string;
  slug: string;
  description: string;
  url: string;
  featured: boolean;
  tags: string[];
  created_at: string;
  [key: string]: unknown;
}

export function createMockProject(overrides: Partial<MockProject> = {}): MockProject {
  const id = overrides.id ?? nextId('project');
  return {
    id,
    title: 'Sample Project',
    slug: `sample-project-${id}`,
    description: 'A sample project description.',
    url: 'https://example.com/project',
    featured: false,
    tags: ['React', 'TypeScript'],
    created_at: FIXED_TIMESTAMP,
    ...overrides,
  };
}

export interface MockUser {
  id: string;
  email: string;
  username: string;
  roles: Array<'admin' | 'editor' | 'viewer'>;
  permissions: string[];
  created_at: string;
  [key: string]: unknown;
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  const id = overrides.id ?? nextId('user');
  return {
    id,
    email: `user-${id}@example.com`,
    username: `user_${id}`,
    roles: ['viewer'],
    permissions: [],
    created_at: FIXED_TIMESTAMP,
    ...overrides,
  };
}

/** An admin fixture: convenience wrapper over createMockUser. */
export function createMockAdmin(overrides: Partial<MockUser> = {}): MockUser {
  return createMockUser({
    roles: ['admin'],
    permissions: ['manage_articles', 'manage_projects', 'manage_users'],
    ...overrides,
  });
}

export interface MockAccount {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  balance: number;
  [key: string]: unknown;
}

export function createMockAccount(overrides: Partial<MockAccount> = {}): MockAccount {
  const id = overrides.id ?? nextId('account');
  return {
    id,
    code: '1000',
    name: 'Cash',
    type: 'asset',
    balance: 0,
    ...overrides,
  };
}

export interface MockInvoice {
  id: string;
  number: string;
  contact_id: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  subtotal: number;
  tax: number;
  total: number;
  issued_at: string;
  due_at: string;
  [key: string]: unknown;
}

export function createMockInvoice(overrides: Partial<MockInvoice> = {}): MockInvoice {
  const id = overrides.id ?? nextId('invoice');
  return {
    id,
    number: `INV-${id}`,
    contact_id: 'contact-1',
    status: 'draft',
    subtotal: 100,
    tax: 8.25,
    total: 108.25,
    issued_at: FIXED_TIMESTAMP,
    due_at: FIXED_TIMESTAMP,
    ...overrides,
  };
}

export interface MockJournalEntry {
  id: string;
  date: string;
  description: string;
  lines: Array<{ account_id: string; debit: number; credit: number }>;
  posted: boolean;
  [key: string]: unknown;
}

export function createMockJournalEntry(
  overrides: Partial<MockJournalEntry> = {}
): MockJournalEntry {
  const id = overrides.id ?? nextId('journal');
  return {
    id,
    date: FIXED_TIMESTAMP,
    description: 'Office supplies purchase',
    lines: [
      { account_id: 'account-office', debit: 150, credit: 0 },
      { account_id: 'account-cash', debit: 0, credit: 150 },
    ],
    posted: false,
    ...overrides,
  };
}

/** Build an array of `count` entities using the given factory. */
export function createMany<T>(factory: (overrides?: Partial<T>) => T, count: number): T[] {
  return Array.from({ length: count }, () => factory());
}
