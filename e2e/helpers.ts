import { expect, type Page } from "@playwright/test";

/**
 * Wait for the app to be fully loaded (sidebar workspaces rendered)
 */
export async function waitForAppReady(page: Page) {
  await page.waitForSelector("aside nav button", { timeout: 15000 });
}

/**
 * Navigate to a workspace by clicking its name in the sidebar
 */
export async function navigateToWorkspace(page: Page, workspaceName: string) {
  const btn = page.locator("aside nav button", { hasText: workspaceName });
  await btn.click();
  await page.waitForTimeout(500);
}

/**
 * Get all task cards in a specific column by column header text
 */
export async function getColumnCards(page: Page, columnLabel: string) {
  // Find the column by its label text
  const column = page.locator("div", { hasText: columnLabel }).filter({
    has: page.locator(".text-sm.font-medium", { hasText: columnLabel }),
  }).first();
  return column.locator("[class*='rounded-md'][class*='border'][class*='cursor-pointer']");
}

/**
 * Seed the database with fresh data via the API
 */
export async function reseedDatabase(baseURL: string) {
  // We rely on the seed having already been run before tests
  // For isolated tests, we could call a reset API endpoint
}
