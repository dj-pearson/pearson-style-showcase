import { test, expect } from '../fixtures/test-base';

test.describe('Contact form', () => {
  test('renders all fields', async ({ page }) => {
    await page.goto('/connect');
    await expect(page.getByPlaceholder('Your full name')).toBeVisible();
    await expect(page.getByPlaceholder('your.email@example.com')).toBeVisible();
    await expect(page.getByLabel('Subject')).toBeVisible();
    await expect(page.getByLabel('Message')).toBeVisible();
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible();
  });

  test('submitting an empty form shows validation errors', async ({ page }) => {
    await page.goto('/connect');
    await page.getByRole('button', { name: /send/i }).click();
    // Zod validation renders inline messages.
    await expect(page.getByText(/Name must be at least 2 characters/i)).toBeVisible();
  });

  test('valid submission shows a success message (mocked backend)', async ({ page }) => {
    // The contact form posts to the send-contact-email edge function; the
    // mockSupabase fixture already fulfills **/functions/v1/** with success.
    await page.goto('/connect');

    await page.getByPlaceholder('Your full name').fill('Jane Doe');
    await page.getByPlaceholder('your.email@example.com').fill('jane@example.com');
    await page.getByLabel('Subject').fill('Consulting inquiry');
    await page
      .getByLabel('Message')
      .fill('I would like to discuss an AI automation project with you.');

    await page.getByRole('button', { name: /send/i }).click();

    // The toast renders the message in both a visible title and an
    // aria-live status region; assert on the visible title specifically.
    await expect(
      page.getByText('Message sent successfully!', { exact: true }).first()
    ).toBeVisible();
  });
});
