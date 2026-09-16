/**
 * Automated demo video recording using Playwright.
 * Records the full borrower → ops flow end-to-end.
 *
 * Usage: npx playwright test e2e/demo-record.spec.ts --project=chromium
 * Output: test-results/.playwright-artifacts-0/*.webm
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'http://localhost:3000';
const EMAIL = `demo.${Date.now()}@example.com`;
const PASSWORD = 'Demo@12345';

test('full demo recording', async ({ page }) => {
  test.setTimeout(120_000);

  // ─── 1. Signup ───────────────────────────────────────────────
  await page.goto(`${BASE}/signup`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'demo/01-signup.png' });

  await page.locator('#name').fill('Ravi Kumar');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.screenshot({ path: 'demo/02-signup-filled.png' });

  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/borrower**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'demo/03-borrower-home.png' });

  // ─── 2. Personal Details ─────────────────────────────────────
  await page.goto(`${BASE}/borrower/personal-details`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'demo/04-personal-details.png' });

  // Fill the form fields by id or placeholder
  const nameInput = page.locator('input[placeholder*="Ravi"], input[id="fullName"], input').first();
  await nameInput.fill('Ravi Kumar');

  const panInput = page.locator('input[placeholder*="PAN"], input[id="pan"], input').nth(1);
  await panInput.fill('ABCDR1234F');

  const dobInput = page.locator('input[type="date"], input[id="dob"]').first();
  await dobInput.fill('1995-06-15');

  const salaryInput = page.locator('input[type="number"], input[id="monthlySalary"]').first();
  await salaryInput.fill('50000');

  // Click salaried button
  const salaried = page.locator('button, label').filter({ hasText: /salaried/i }).first();
  if (await salaried.isVisible().catch(() => false)) await salaried.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'demo/05-personal-filled.png' });

  // Submit
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'demo/06-bre-result.png' });

  // ─── 3. Upload Salary Slip ───────────────────────────────────
  await page.goto(`${BASE}/borrower/salary-slip`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'demo/07-salary-slip.png' });

  const pdfPath = '/tmp/demo-slip.pdf';
  if (!fs.existsSync(pdfPath)) {
    fs.writeFileSync(pdfPath, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF');
  }

  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(pdfPath);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'demo/08-slip-uploaded.png' });

    const uploadBtn = page.locator('button[type="submit"]').first();
    if (await uploadBtn.isVisible().catch(() => false)) {
      await uploadBtn.click();
      await page.waitForTimeout(3000);
    }
  }
  await page.screenshot({ path: 'demo/09-slip-done.png' });

  // ─── 4. Loan Config & Apply ──────────────────────────────────
  await page.goto(`${BASE}/borrower/loan-config`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'demo/10-loan-config.png' });

  // Adjust sliders
  const sliders = page.locator('input[type="range"]');
  const sliderCount = await sliders.count();
  if (sliderCount >= 2) {
    await sliders.nth(0).fill('200000');
    await sliders.nth(1).fill('90');
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'demo/11-loan-filled.png' });

  const applyBtn = page.locator('button[type="submit"]').first();
  if (await applyBtn.isVisible().catch(() => false)) {
    await applyBtn.click();
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: 'demo/12-loan-applied.png' });

  // ─── 5. Borrower Dashboard ───────────────────────────────────
  await page.goto(`${BASE}/borrower/loans`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'demo/13-borrower-dashboard.png' });

  // ─── 6. Logout ───────────────────────────────────────────────
  const logoutBtn = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click();
    await page.waitForTimeout(2000);
  }

  // ─── 7. Sanction Executive ───────────────────────────────────
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('sanction@creditsea.com');
  await page.locator('#password').fill('Password@123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'demo/14-sanction-dashboard.png' });

  // Approve first loan
  const approveBtn = page.locator('button').filter({ hasText: /approve/i }).first();
  if (await approveBtn.isVisible().catch(() => false)) {
    await approveBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'demo/15-sanction-modal.png' });

    const confirmBtn = page.locator('button').filter({ hasText: /confirm|submit|approve/i }).last();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
  }
  await page.screenshot({ path: 'demo/16-sanction-done.png' });

  // Logout
  const logout2 = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
  if (await logout2.isVisible().catch(() => false)) {
    await logout2.click();
    await page.waitForTimeout(2000);
  }

  // ─── 8. Disbursement Executive ───────────────────────────────
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('disbursement@creditsea.com');
  await page.locator('#password').fill('Password@123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'demo/17-disbursement-dashboard.png' });

  const disburseBtn = page.locator('button').filter({ hasText: /disburse/i }).first();
  if (await disburseBtn.isVisible().catch(() => false)) {
    await disburseBtn.click();
    await page.waitForTimeout(1500);
    const utrInput = page.locator('input[placeholder*="UTR"], input').last();
    if (await utrInput.isVisible().catch(() => false)) {
      await utrInput.fill(`UTR${Date.now()}`);
    }
    await page.screenshot({ path: 'demo/18-disbursement-modal.png' });

    const confirmBtn = page.locator('button').filter({ hasText: /confirm|submit|disburse/i }).last();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
  }
  await page.screenshot({ path: 'demo/19-disbursement-done.png' });

  // ─── Final state ─────────────────────────────────────────────
  await page.goto(`${BASE}/borrower/loans`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'demo/20-final-state.png' });
});
