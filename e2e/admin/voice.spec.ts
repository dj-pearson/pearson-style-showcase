import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test-base';
import { seedAdminSession, mockAdminAuth } from '../fixtures/admin-session';

/**
 * Admin > Voice: each sub-tab renders the rows the API returns. Runs as an
 * authenticated admin with the voice_ tables mocked at the REST layer.
 */

const STORIES = [
  {
    id: 's1',
    body: 'Tried tacos tonight, ate the shell only.',
    tracks: ['eatpal'],
    products: ['eatpal'],
    confirmed: true,
    source: 'manual',
    source_ref: null,
    times_used: 1,
    last_used_at: '2026-11-12T17:00:00Z',
    created_at: '2026-11-10T12:00:00Z',
  },
];

const ASSETS = [
  {
    id: 'a1',
    kind: 'screenshot',
    product: 'eatpal',
    storage_path: 'screenshot/eatpal/a1.png',
    caption: 'Meal plan screen',
    created_at: '2026-11-11T00:00:00Z',
  },
];

const TRACKS = [
  {
    key: 'gradethread',
    enabled: true,
    post_time: '08:30:00',
    timezone: 'America/Chicago',
    products: ['gradethread'],
    rotation_index: 0,
    updated_at: '2026-11-16T00:00:00Z',
  },
  {
    key: 'eatpal',
    enabled: true,
    post_time: '12:15:00',
    timezone: 'America/Chicago',
    products: ['eatpal'],
    rotation_index: 0,
    updated_at: '2026-11-16T00:00:00Z',
  },
  {
    key: 'platform',
    enabled: true,
    post_time: '16:30:00',
    timezone: 'America/Chicago',
    products: ['brikly', 'printyx', 'agentbio'],
    rotation_index: 0,
    updated_at: '2026-11-16T00:00:00Z',
  },
];

const TARGETS = ['x', 'linkedin', 'instagram', 'facebook', 'threads', 'youtube'].map(
  (platform) => ({
    platform,
    url: platform === 'instagram' ? 'https://hook.us1.make.com/example' : '',
    enabled: platform === 'instagram',
    reels: false,
    updated_at: '2026-11-16T00:00:00Z',
  })
);

const POSTS = [
  {
    id: 'p1',
    track: 'platform',
    product: 'brikly',
    run_date: '2026-11-16',
    topic_id: null,
    format: null,
    status: 'skipped',
    copy: null,
    slides: null,
    image_urls: [],
    video_url: null,
    skip_reason: 'unsourced claim in the draft',
    skip_stage: 'check',
    attempts: 2,
    dry_run: false,
    notified_at: null,
    created_at: '2026-11-16T22:30:00Z',
    updated_at: '2026-11-16T22:31:00Z',
  },
];

const TABLES: Record<string, unknown[]> = {
  voice_stories: STORIES,
  voice_assets: ASSETS,
  voice_tracks: TRACKS,
  voice_webhook_targets: TARGETS,
  voice_posts: POSTS,
  voice_webhook_log: [],
};

async function mockVoiceTables(page: Page): Promise<void> {
  await page.route('**/rest/v1/voice_*', (route) => {
    const table = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TABLES[table] ?? []),
    });
  });
}

test.describe('Admin voice tab', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page);
    await mockAdminAuth(page);
    await mockVoiceTables(page);
  });

  test('each sub-tab renders its rows', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Voice', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Voice', exact: true })).toBeVisible();

    // Story Bank is the default sub-tab.
    await expect(page.getByText('Tried tacos tonight, ate the shell only.')).toBeVisible();
    await expect(page.getByText(/Used 1 time, last used/)).toBeVisible();

    await page.getByRole('tab', { name: 'Assets' }).click();
    await expect(page.getByRole('region', { name: 'Screenshots: EatPal' })).toBeVisible();
    await expect(page.getByAltText('Meal plan screen')).toBeVisible();

    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.locator('#voice-track-time-eatpal')).toHaveValue('12:15');
    await expect(page.getByRole('switch', { name: 'Instagram enabled' })).toBeChecked();
    await expect(page.getByRole('switch', { name: 'LinkedIn enabled' })).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Move Printyx up' })).toBeEnabled();

    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByText('Stopped at check: unsourced claim in the draft')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dry run: EatPal' })).toBeVisible();
  });
});
