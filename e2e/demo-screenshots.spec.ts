/**
 * Quick demo screenshots from the deployed Vercel site.
 * Run: npx playwright test e2e/demo-screenshots.spec.ts --project=chromium
 */
import { test } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'http://localhost:3000';
const EMAIL = `demo.${Date.now()}@example.com`;
const PASSWORD = 'Demo@12345';
const DEMO = 'demo';

test('capture demo screenshots', async ({ page }) => {
  test.setTimeout(90_000);
  fs.mkdirSync(DEMO, { recursive: true });

  // 1. Login page
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${DEMO}/01-login.png`, fullPage: false });

  // 2. Signup page
  await page.goto(`${BASE}/signup`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${DEMO}/02-signup.png`, fullPage: false });

  // 3. Fill signup
  await page.locator('#name').fill('Ravi Kumar');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.screenshot({ path: `${DEMO}/03-signup-filled.png`, fullPage: false });

  // 4. Submit signup → goes to borrower
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/borrower**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/04-borrower-home.png`, fullPage: false });

  // 5. Personal details page
  await page.goto(`${BASE}/borrower/personal-details`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/05-personal-details.png`, fullPage: false });

  // 6. Fill personal details
  await page.locator('input').filter({ hasText: /^$/ }).nth(0).fill('Ravi Kumar');
  await page.locator('input[type="date"]').fill('1995-06-15');
  await page.locator('input[placeholder="ABCDE1234F"]').fill('ABCDR1234F');
  await page.locator('input[type="number"]').fill('50000');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/06-personal-filled.png`, fullPage: false });

  // 7. Submit personal details
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DEMO}/07-bre-result.png`, fullPage: false });

  // 8. Salary slip page
  await page.goto(`${BASE}/borrower/salary-slip`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/08-salary-slip.png`, fullPage: false });

  // Upload a dummy PDF
  const pdfPath = '/tmp/demo-slip.pdf';
  if (!fs.existsSync(pdfPath)) {
    fs.writeFileSync(pdfPath, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF');
  }
  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(pdfPath);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${DEMO}/09-slip-uploaded.png`, fullPage: false });
  }

  // 9. Loan config page
  await page.goto(`${BASE}/borrower/loan-config`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/10-loan-config.png`, fullPage: false });

  // 10. Adjust sliders
  const sliders = page.locator('input[type="range"]');
  if (await sliders.count() >= 2) {
    await sliders.nth(0).fill('200000');
    await sliders.nth(1).fill('90');
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/11-loan-configured.png`, fullPage: false });

  // 11. Apply
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DEMO}/12-loan-applied.png`, fullPage: false });

  // 12. Borrower dashboard with loan
  await page.goto(`${BASE}/borrower/loans`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DEMO}/13-borrower-dashboard.png`, fullPage: true });

  // 13. Logout
  const logout = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
  if (await logout.isVisible().catch(() => false)) {
    await logout.click();
    await page.waitForTimeout(2000);
  }

  // 14. Sanction login
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('sanction@creditsea.com');
  await page.locator('#password').fill('Password@123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DEMO}/14-sanction-dashboard.png`, fullPage: true });

  // 15. Approve
  const approveBtn = page.locator('button').filter({ hasText: /approve/i }).first();
  if (await approveBtn.isVisible().catch(() => false)) {
    await approveBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DEMO}/15-sanction-modal.png`, fullPage: false });
    const confirm = page.locator('button').filter({ hasText: /confirm|submit|approve/i }).last();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
      await page.waitForTimeout(3000);
    }
  }
  await page.screenshot({ path: `${DEMO}/16-sanction-done.png`, fullPage: false });

  // 16. Logout → Disbursement login
  const logout2 = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
  if (await logout2.isVisible().catch(() => false)) {
    await logout2.click();
    await page.waitForTimeout(2000);
  }

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('disbursement@creditsea.com');
  await page.locator('#password').fill('Password@123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DEMO}/17-disbursement-dashboard.png`, fullPage: true });

  // 17. Disburse
  const disburseBtn = page.locator('button').filter({ hasText: /disburse/i }).first();
  if (await disburseBtn.isVisible().catch(() => false)) {
    await disburseBtn.click();
    await page.waitForTimeout(1500);
    const utrInput = page.locator('input[placeholder*="UTR"], input').last();
    if (await utrInput.isVisible().catch(() => false)) {
      await utrInput.fill(`UTR${Date.now()}`);
    }
    await page.screenshot({ path: `${DEMO}/18-disbursement-modal.png`, fullPage: false });
    const confirm2 = page.locator('button').filter({ hasText: /confirm|submit|disburse/i }).last();
    if (await confirm2.isVisible().catch(() => false)) {
      await confirm2.click();
      await page.waitForTimeout(3000);
    }
  }
  await page.screenshot({ path: `${DEMO}/19-disbursement-done.png`, fullPage: false });

  console.log(`\nScreenshots saved to ${DEMO}/`);
});
