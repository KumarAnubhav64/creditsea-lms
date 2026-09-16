import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:5000/api';
const PW = 'Password@123';

async function registerBorrower(email: string, name = 'E2E Borrower') {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: PW }),
  });
  return res.json();
}

async function login(page: any, email: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
}

// ─── AUTH ───────────────────────────────────────────────────────────────
test.describe('Auth', () => {
  test('login page renders', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('wrong credentials shows error', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrong');
    await page.click('button[type="submit"]');
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
  });

  test('borrower login → borrower portal', async ({ page }) => {
    await login(page, 'borrower@creditsea.com');
    await page.waitForURL('**/borrower**', { timeout: 5000 });
    await expect(page.getByRole('link', { name: /CreditSea/ }).first()).toBeVisible();
  });

  test('admin login → dashboard', async ({ page }) => {
    await login(page, 'admin@creditsea.com');
    await page.waitForURL('**/dashboard**', { timeout: 5000 });
  });
});

// ─── FULL BORROWER FLOW (fresh user) ────────────────────────────────────
test.describe('Borrower full flow', () => {
  const email = `e2eflow-${Date.now()}@test.com`;

  test.beforeAll(async () => {
    await registerBorrower(email, 'E2E Flow User');
  });

  test('step 1: personal details → salary slip', async ({ page }) => {
    await login(page, email);
    await page.waitForURL('**/borrower/personal-details**', { timeout: 8000 });

    await page.fill('input[placeholder="ABCDE1234F"]', 'ABCDE1234F');
    await page.fill('input[type="date"]', '1995-05-15');
    await page.fill('input[type="number"]', '75000');
    await page.selectOption('select', 'SALARIED');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/salary-slip**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Upload Salary Slip' })).toBeVisible();
  });

  test('step 2: salary slip → loan config', async ({ page }) => {
    await login(page, email);
    await page.waitForURL('**/borrower/salary-slip**', { timeout: 8000 });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'slip.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf'),
    });
    await page.click('button[type="submit"]');
    await page.waitForURL('**/loan-config**', { timeout: 8000 });
    await expect(page.getByRole('heading', { name: 'Loan Configuration' })).toBeVisible();
  });

  test('step 3: loan config → my loans', async ({ page }) => {
    await login(page, email);
    await page.waitForURL('**/borrower/loan-config**', { timeout: 8000 });

    await expect(page.getByText('Interest (12% p.a.)')).toBeVisible();
    await page.click('button[type="submit"]');
    await page.waitForURL('**/borrower/loans**', { timeout: 5000 });
  });

  test('step 4: apply for loan', async ({ page }) => {
    await login(page, email);
    await page.waitForURL('**/borrower/loans**', { timeout: 8000 });

    await page.getByRole('button', { name: /New Loan/ }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('.status-applied')).toBeVisible({ timeout: 5000 });
  });
});

// ─── SANCTION ───────────────────────────────────────────────────────────
test.describe('Sanction', () => {
  test('shows pending loans with approve/reject', async ({ page }) => {
    await login(page, 'sanction@creditsea.com');
    await page.waitForURL('**/dashboard/sanction**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Loan Sanction' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('can approve a loan', async ({ page }) => {
    await login(page, 'sanction@creditsea.com');
    await page.waitForURL('**/dashboard/sanction**', { timeout: 5000 });
    await page.getByRole('button', { name: 'Approve' }).first().click();
    await expect(page.getByRole('heading', { name: 'Approve Loan' })).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: 'Approve' }).last().click();
    await page.waitForTimeout(2000);
  });
});

// ─── DISBURSEMENT ───────────────────────────────────────────────────────
test.describe('Disbursement', () => {
  test('shows sanctioned loans', async ({ page }) => {
    await login(page, 'disbursement@creditsea.com');
    await page.waitForURL('**/dashboard/disbursement**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Disbursement' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disburse' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('can record disbursement', async ({ page }) => {
    await login(page, 'disbursement@creditsea.com');
    await page.waitForURL('**/dashboard/disbursement**', { timeout: 5000 });
    await page.getByRole('button', { name: 'Disburse' }).first().click();
    await expect(page.getByRole('heading', { name: 'Record Disbursement' })).toBeVisible({ timeout: 3000 });
    await page.fill('input[placeholder="UTR1234567890"]', `UTRE2E${Date.now()}`);
    await page.getByRole('button', { name: 'Confirm disbursement' }).click();
    await page.waitForTimeout(2000);
  });
});

// ─── COLLECTION ─────────────────────────────────────────────────────────
test.describe('Collection', () => {
  test('shows disbursed loans', async ({ page }) => {
    await login(page, 'collection@creditsea.com');
    await page.waitForURL('**/dashboard/collection**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Collection' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record payment' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('can record a payment', async ({ page }) => {
    await login(page, 'collection@creditsea.com');
    await page.waitForURL('**/dashboard/collection**', { timeout: 5000 });
    await page.getByRole('button', { name: 'Record payment' }).first().click();
    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({ timeout: 3000 });
    await page.fill('input[placeholder="PAY1234567890"]', `PAYE2E${Date.now()}`);
    await page.fill('input[type="number"]', '10000');
    await page.getByRole('button', { name: 'Record payment' }).last().click();
    await page.waitForTimeout(2000);
  });
});

// ─── SALES ──────────────────────────────────────────────────────────────
test.describe('Sales', () => {
  test('shows leads table with columns', async ({ page }) => {
    await login(page, 'sales@creditsea.com');
    await page.waitForURL('**/dashboard/sales**', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Sales Funnel' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Name' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Email' })).toBeVisible();
  });
});

// ─── ADMIN ──────────────────────────────────────────────────────────────
test.describe('Admin', () => {
  test('sees all nav modules', async ({ page }) => {
    await login(page, 'admin@creditsea.com');
    await page.waitForURL('**/dashboard**', { timeout: 5000 });
    await expect(page.getByRole('link', { name: 'Leads' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sanction' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Disbursement' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Collection' })).toBeVisible();
  });
});

// ─── RBAC ───────────────────────────────────────────────────────────────
test.describe('RBAC', () => {
  test('borrower redirected away from dashboard', async ({ page }) => {
    await login(page, 'borrower@creditsea.com');
    await page.waitForTimeout(2000);
    await page.goto(`${BASE}/dashboard/sanction`);
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/dashboard/sanction');
  });

  test('sales redirected away from sanction', async ({ page }) => {
    await login(page, 'sales@creditsea.com');
    await page.waitForTimeout(2000);
    await page.goto(`${BASE}/dashboard/sanction`);
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/dashboard/sanction');
  });
});
