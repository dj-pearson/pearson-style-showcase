import { test, expect } from '../fixtures/test-base';
import { seedAdminSession, mockAdminAuth } from '../fixtures/admin-session';

/**
 * US-036: the admin sidebar groups its items into collapsible sections whose
 * expand/collapse state persists across reloads.
 */
test.describe('Admin sidebar groups', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page);
    await mockAdminAuth(page);
  });

  test('groups collapse/expand and the state persists across reload', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();

    // Expand the icon sidebar so group labels/chevrons are visible.
    await page.getByRole('button', { name: /toggle sidebar/i }).click();

    const contentGroup = page.getByRole('button', { name: /Content section/i });
    await expect(contentGroup).toBeVisible();
    await expect(page.getByRole('button', { name: 'Articles', exact: true })).toBeVisible();

    // Collapse Content -> its items hide.
    await contentGroup.click();
    await expect(page.getByRole('button', { name: 'Articles', exact: true })).toBeHidden();

    // Reload keeps Content collapsed (localStorage-backed).
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /toggle sidebar/i }).click();
    await expect(page.getByRole('button', { name: 'Articles', exact: true })).toBeHidden();
  });
});
