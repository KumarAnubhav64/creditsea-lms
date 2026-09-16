/**
 * Complete demo flow - all roles, BRE fail, payment, auto-close.
 * Output: demo/*.png → stitched into demo-video.mp4
 */
import { test } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'http://localhost:3000';
const DEMO = 'demo';
const PASSWORD = 'Password@123';

test('complete demo flow', async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(DEMO, { recursive: true });

  // ═══════════════════════════════════════════════════════════════
  // PART 1: BORROWER FLOW
  // ═══════════════════════════════════════════════════════════════

  // 1. Login page
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${DEMO}/01-login.png` });

  // 2. Signup
  await page.goto(`${BASE}/signup`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${DEMO}/02-signup.png` });

  const EMAIL = `flow.${Date.now()}@example.com`;
  await page.locator('#name').fill('Ravi Kumar');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill('Flow@12345');
  await page.screenshot({ path: `${DEMO}/03-signup-filled.png` });

  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/borrower**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/04-borrower-home.png` });

  // 3. Personal details - BRE FAIL (unemployed)
  await page.goto(`${BASE}/borrower/personal-details`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/05-personal-details-empty.png` });

  await page.locator('input[placeholder="ABCDE1234F"]').fill('ABCDR1234F');
  await page.locator('input[type="date"]').fill('1995-06-15');
  await page.locator('select').selectOption('UNEMPLOYED');
  await page.locator('input[type="number"]').fill('50000');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/06-bre-fail-filled.png` });

  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DEMO}/07-bre-fail-error.png` });

  // 4. Personal details - BRE PASS
  await page.locator('select').selectOption('SALARIED');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/08-bre-pass-filled.png` });

  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DEMO}/09-bre-pass-success.png` });

  // 5. Salary slip
  await page.goto(`${BASE}/borrower/salary-slip`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/10-salary-slip.png` });

  const pdfPath = '/tmp/demo-slip.pdf';
  if (!fs.existsSync(pdfPath)) {
    fs.writeFileSync(pdfPath, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF');
  }
  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(pdfPath);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${DEMO}/11-slip-uploaded.png` });
  }

  // 6. Loan config
  await page.goto(`${BASE}/borrower/loan-config`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/12-loan-config.png` });

  const sliders = page.locator('input[type="range"]');
  if (await sliders.count() >= 2) {
    await sliders.nth(0).fill('150000');
    await sliders.nth(1).fill('90');
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DEMO}/13-loan-configured.png` });

  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DEMO}/14-loan-applied.png` });

  // 7. Borrower dashboard with applied loan
  await page.goto(`${BASE}/borrower/loans`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/15-borrower-dashboard.png`, fullPage: true });

  // Logout
  const logout = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
  if (await logout.isVisible().catch(() => false)) await logout.click();
  await page.waitForTimeout(1500);

  // ═══════════════════════════════════════════════════════════════
  // PART 2: SALES DASHBOARD
  // ═══════════════════════════════════════════════════════════════

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('sales@creditsea.com');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/16-sales-dashboard.png`, fullPage: true });

  const logout2 = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
  if (await logout2.isVisible().catch(() => false)) await logout2.click();
  await page.waitForTimeout(1500);

  // ═══════════════════════════════════════════════════════════════
  // PART 3: SANCTION - APPROVE
  // ═══════════════════════════════════════════════════════════════

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('sanction@creditsea.com');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/17-sanction-pending.png`, fullPage: true });

  const approveBtn = page.locator('button').filter({ hasText: /approve/i }).first();
  if (await approveBtn.isVisible().catch(() => false)) {
    await approveBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DEMO}/18-sanction-modal.png` });
    const confirm = page.locator('button').filter({ hasText: /confirm|submit|approve/i }).last();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
      await page.waitForTimeout(3000);
    }
  }
  await page.screenshot({ path: `${DEMO}/19-sanction-approved.png` });

  const logout3 = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
  if (await logout3.isVisible().catch(() => false)) await logout3.click();
  await page.waitForTimeout(1500);

  // ═══════════════════════════════════════════════════════════════
  // PART 4: DISBURSEMENT
  // ═══════════════════════════════════════════════════════════════

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('disbursement@creditsea.com');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/20-disbursement-pending.png`, fullPage: true });

  const disburseBtn = page.locator('button').filter({ hasText: /disburse/i }).first();
  if (await disburseBtn.isVisible().catch(() => false)) {
    await disburseBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DEMO}/21-disbursement-modal.png` });
    const utrInput = page.locator('input[placeholder*="UTR"], input').last();
    if (await utrInput.isVisible().catch(() => false)) {
      await utrInput.fill(`UTR${Date.now()}`);
    }
    const confirm2 = page.locator('button').filter({ hasText: /confirm|submit|disburse/i }).last();
    if (await confirm2.isVisible().catch(() => false)) {
      await confirm2.click();
      await page.waitForTimeout(3000);
    }
  }
  await page.screenshot({ path: `${DEMO}/22-disbursement-done.png` });

  const logout4 = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
  if (await logout4.isVisible().catch(() => false)) await logout4.click();
  await page.waitForTimeout(1500);

  // ═══════════════════════════════════════════════════════════════
  // PART 5: COLLECTION - RECORD PAYMENT + AUTO-CLOSE
  // ═══════════════════════════════════════════════════════════════

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('collection@creditsea.com');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/23-collection-pending.png`, fullPage: true });

  const payBtn = page.locator('button').filter({ hasText: /pay|record|payment/i }).first();
  if (await payBtn.isVisible().catch(() => false)) {
    await payBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DEMO}/24-collection-modal.png` });

    const utrInput2 = page.locator('input[placeholder*="UTR"], input').first();
    if (await utrInput2.isVisible().catch(() => false)) {
      await utrInput2.fill(`PAY${Date.now()}`);
    }
    const amtInput = page.locator('input[type="number"]').first();
    if (await amtInput.isVisible().catch(() => false)) {
      await amtInput.fill('155000');
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DEMO}/25-payment-filled.png` });

    const confirm3 = page.locator('button').filter({ hasText: /confirm|submit|record/i }).last();
    if (await confirm3.isVisible().catch(() => false)) {
      await confirm3.click();
      await page.waitForTimeout(3000);
    }
  }
  await page.screenshot({ path: `${DEMO}/26-payment-recorded.png` });

  const logout5 = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
  if (await logout5.isVisible().catch(() => false)) await logout5.click();
  await page.waitForTimeout(1500);

  // ═══════════════════════════════════════════════════════════════
  // PART 6: BORROWER DASHBOARD (see loan status)
  // ═══════════════════════════════════════════════════════════════

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill('Flow@12345');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/borrower**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await page.goto(`${BASE}/borrower/loans`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DEMO}/27-borrower-final.png`, fullPage: true });

  // ═══════════════════════════════════════════════════════════════
  // PART 7: ADMIN DASHBOARD (all modules visible)
  // ═══════════════════════════════════════════════════════════════

  const logout6 = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
  if (await logout6.isVisible().catch(() => false)) await logout6.click();
  await page.waitForTimeout(1500);

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill('admin@creditsea.com');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DEMO}/28-admin-dashboard.png`, fullPage: true });

  console.log(`\nDone! ${DEMO}/ has all screenshots.`);
});
