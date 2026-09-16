/**
 * Essential demo screenshots - fast, no BRE fail test.
 */
import { test } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'http://localhost:3000';
const DEMO = 'demo';
const PASSWORD = 'Password@123';

test('essential demo', async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(DEMO, { recursive: true });

  const EMAIL = `demo.${Date.now()}@example.com`;

  // 1. Login
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${DEMO}/01-login.png` });

  // 2. Signup
  await page.goto(`${BASE}/signup`);
  await page.waitForLoadState('networkidle');
  await page.locator('#name').fill('Ravi Kumar');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill('Demo@12345');
  await page.screenshot({ path: `${DEMO}/02-signup.png` });

  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/borrower**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/03-borrower-home.png` });

  // 3. Personal details
  await page.goto(`${BASE}/borrower/personal-details`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/04-personal-details.png` });

  await page.locator('input[placeholder="ABCDE1234F"]').fill('ABCDR1234F');
  await page.locator('input[type="date"]').fill('1995-06-15');
  await page.locator('select').selectOption('SALARIED');
  await page.locator('input[type="number"]').fill('50000');
  await page.waitForTimeout(500);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DEMO}/05-bre-pass.png` });

  // 4. Salary slip
  await page.goto(`${BASE}/borrower/salary-slip`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/06-salary-slip.png` });

  // 5. Loan config
  await page.goto(`${BASE}/borrower/loan-config`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const sliders = page.locator('input[type="range"]');
  if (await sliders.count() >= 2) {
    await sliders.nth(0).fill('150000');
    await sliders.nth(1).fill('90');
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/07-loan-config.png` });

  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  // 6. Borrower dashboard
  await page.goto(`${BASE}/borrower/loans`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/08-borrower-dashboard.png`, fullPage: true });

  // Logout
  await page.locator('button, a').filter({ hasText: /logout|sign out/i }).first().click();
  await page.waitForTimeout(1500);

  // 7. Sales
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('sales@creditsea.com');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/09-sales.png`, fullPage: true });
  await page.locator('button, a').filter({ hasText: /logout|sign out/i }).first().click();
  await page.waitForTimeout(1500);

  // 8. Sanction
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('sanction@creditsea.com');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/10-sanction.png`, fullPage: true });

  const approveBtn = page.locator('button').filter({ hasText: /approve/i }).first();
  if (await approveBtn.isVisible().catch(() => false)) {
    await approveBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${DEMO}/11-sanction-modal.png` });
    await page.locator('button').filter({ hasText: /confirm|submit|approve/i }).last().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${DEMO}/12-sanction-approved.png` });
  }
  await page.locator('button, a').filter({ hasText: /logout|sign out/i }).first().click();
  await page.waitForTimeout(1500);

  // 9. Disbursement
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('disbursement@creditsea.com');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/13-disbursement.png`, fullPage: true });

  const disburseBtn = page.locator('button').filter({ hasText: /disburse/i }).first();
  if (await disburseBtn.isVisible().catch(() => false)) {
    await disburseBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${DEMO}/14-disbursement-modal.png` });
    const utrInput = page.locator('input[placeholder*="UTR"], input').last();
    if (await utrInput.isVisible().catch(() => false)) await utrInput.fill(`UTR${Date.now()}`);
    await page.locator('button').filter({ hasText: /confirm|submit|disburse/i }).last().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${DEMO}/15-disbursement-done.png` });
  }
  await page.locator('button, a').filter({ hasText: /logout|sign out/i }).first().click();
  await page.waitForTimeout(1500);

  // 10. Collection
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('collection@creditsea.com');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/16-collection.png`, fullPage: true });
  await page.locator('button, a').filter({ hasText: /logout|sign out/i }).first().click();
  await page.waitForTimeout(1500);

  // 11. Admin
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('admin@creditsea.com');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/17-admin.png`, fullPage: true });

  console.log('Done!');
});
