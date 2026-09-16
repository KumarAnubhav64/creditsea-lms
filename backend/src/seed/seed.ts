/**
 * Idempotent seed: one account per role + demo data at every loan stage
 * so each dashboard module is instantly testable. Safe to re-run —
 * it upserts by email and rebuilds demo loans from scratch.
 */
import { db } from '../config/db';
import { logger } from '../config/logger';
import bcrypt from 'bcryptjs';
import { User, Role } from '../models/User';
import { Loan, LoanStatus } from '../models/Loan';
import { Payment } from '../models/Payment';
import { simpleInterest, totalRepayment } from '../services/loanMath';

const PASSWORD = 'Password@123';

const ROLE_ACCOUNTS: Array<{ role: Role; name: string; email: string }> = [
  { role: 'admin', name: 'Aarti Admin', email: 'admin@creditsea.com' },
  { role: 'sales', name: 'Sameer Sales', email: 'sales@creditsea.com' },
  { role: 'sanction', name: 'Sanjay Sanction', email: 'sanction@creditsea.com' },
  { role: 'disbursement', name: 'Divya Disbursement', email: 'disbursement@creditsea.com' },
  { role: 'collection', name: 'Chetan Collection', email: 'collection@creditsea.com' },
  { role: 'borrower', name: 'Bhavesh Borrower', email: 'borrower@creditsea.com' },
];

interface DemoBorrower {
  name: string;
  email: string;
  pan: string;
  dob: Date;
  monthlySalary: number;
  employmentMode: 'SALARIED' | 'SELF_EMPLOYED';
  slip: boolean;
  loan?: { amount: number; tenureDays: number; status: LoanStatus; payments?: Array<{ utr: string; amount: number }> };
}

const yearsAgo = (n: number) => new Date(new Date().setFullYear(new Date().getFullYear() - n));

const DEMO_BORROWERS: DemoBorrower[] = [
  // Fresh lead — registered only (Sales sees stage REGISTERED)
  { name: 'Rohit Lead', email: 'rohit.lead@example.com', pan: '', dob: yearsAgo(28), monthlySalary: 0, employmentMode: 'SALARIED', slip: false },
  // Lead that passed BRE but no slip yet (stage SLIP_UPLOADED → BRE_VERIFIED without slip)
  { name: 'Nisha Verified', email: 'nisha.verified@example.com', pan: 'BKLPN4321K', dob: yearsAgo(31), monthlySalary: 48000, employmentMode: 'SALARIED', slip: false },
  // Fully ready, hasn't applied (stage READY_TO_APPLY)
  { name: 'Arjun Ready', email: 'arjun.ready@example.com', pan: 'CDEFG5678H', dob: yearsAgo(27), monthlySalary: 55000, employmentMode: 'SALARIED', slip: true },
  // Applied loan waiting for sanction
  {
    name: 'Priya Applied', email: 'priya.applied@example.com', pan: 'AGHJK9012L', dob: yearsAgo(29),
    monthlySalary: 60000, employmentMode: 'SALARIED', slip: true,
    loan: { amount: 150000, tenureDays: 90, status: 'APPLIED' },
  },
  // Another applied loan so the sanction queue has depth
  {
    name: 'Karan Second', email: 'karan.second@example.com', pan: 'AMNOP3456Q', dob: yearsAgo(35),
    monthlySalary: 38000, employmentMode: 'SELF_EMPLOYED', slip: true,
    loan: { amount: 75000, tenureDays: 120, status: 'APPLIED' },
  },
  // Sanctioned, awaiting disbursement
  {
    name: 'Meera Sanctioned', email: 'meera.sanctioned@example.com', pan: 'AQRST7890J', dob: yearsAgo(33),
    monthlySalary: 72000, employmentMode: 'SALARIED', slip: true,
    loan: { amount: 200000, tenureDays: 180, status: 'SANCTIONED' },
  },
  // Disbursed with a partial payment (Collection module in-progress view)
  {
    name: 'Vikram Partial', email: 'vikram.partial@example.com', pan: 'AVWXY2345Z', dob: yearsAgo(40),
    monthlySalary: 90000, employmentMode: 'SALARIED', slip: true,
    loan: {
      amount: 300000, tenureDays: 365, status: 'DISBURSED',
      payments: [{ utr: 'UTRSEED0001', amount: 50000 }],
    },
  },
  // Disbursed, no payments yet
  {
    name: 'Sana Fresh', email: 'sana.fresh@example.com', pan: 'AZABC6789D', dob: yearsAgo(26),
    monthlySalary: 45000, employmentMode: 'SALARIED', slip: true,
    loan: { amount: 100000, tenureDays: 60, status: 'DISBURSED' },
  },
];

async function seed(): Promise<void> {
  await db.connect();

  const collectionExec = await User.findOne({ role: 'collection' }).lean();
  const sanctionExec = await User.findOne({ role: 'sanction' }).lean();
  const disbursementExec = await User.findOne({ role: 'disbursement' }).lean();

  // --- Role accounts (upsert by email) ---
  // Hash explicitly here: updateOne upserts bypass the pre-save hook, so a raw
  // password would be stored as-is and every login would 401. Re-running the
  // seed also acts as a password reset for every role account.
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  for (const acc of ROLE_ACCOUNTS) {
    await User.updateOne(
      { email: acc.email },
      {
        $set: { name: acc.name, role: acc.role, passwordHash: hashedPassword },
        $setOnInsert: { brePassed: false },
      },
      { upsert: true }
    );
    logger.info(`[seed] role account ready: ${acc.email} / ${PASSWORD} (${acc.role})`);
  }

  // --- Demo borrowers + loans (rebuild from scratch for idempotence) ---
  const demoEmails = DEMO_BORROWERS.map((b) => b.email);
  const existing = await User.find({ email: { $in: demoEmails } }).select('_id').lean();
  if (existing.length > 0) {
    const ids = existing.map((u) => u._id);
    const oldLoans = await Loan.find({ borrower: { $in: ids } }).select('_id').lean();
    await Payment.deleteMany({ loan: { $in: oldLoans.map((l) => l._id) } });
    await Loan.deleteMany({ borrower: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
  }

  for (const demo of DEMO_BORROWERS) {
    const user = await User.create({
      name: demo.name,
      email: demo.email,
      passwordHash: PASSWORD,
      role: 'borrower',
      pan: demo.pan || undefined,
      dob: demo.dob,
      monthlySalary: demo.monthlySalary || undefined,
      employmentMode: demo.monthlySalary ? demo.employmentMode : undefined,
      brePassed: Boolean(demo.pan && demo.monthlySalary),
      breCheckedAt: demo.pan ? new Date() : undefined,
      salarySlipUrl: demo.slip ? '/uploads/demo-salary-slip.pdf' : undefined,
    });

    if (!demo.loan) {
      logger.info(`[seed] lead: ${demo.email}`);
      continue;
    }

    const si = simpleInterest(demo.loan.amount, 12, demo.loan.tenureDays);
    const total = totalRepayment(demo.loan.amount, si);
    const now = new Date();

    const loan = await Loan.create({
      borrower: user._id,
      amount: demo.loan.amount,
      tenureDays: demo.loan.tenureDays,
      interestRate: 12,
      simpleInterest: si,
      totalRepayment: total,
      paidAmount: 0,
      status: 'APPLIED',
      appliedAt: now,
      statusHistory: [{ status: 'APPLIED', by: user._id, at: now, note: 'Loan application submitted' }],
    });

    if (['SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED'].includes(demo.loan.status) && sanctionExec) {
      loan.status = 'SANCTIONED';
      loan.sanctionedAt = now;
      loan.decidedBy = sanctionExec._id;
      loan.statusHistory.push({ status: 'SANCTIONED', by: sanctionExec._id, at: now, note: 'Approved by sanction executive (seed)' });
    }

    if (['DISBURSED', 'CLOSED'].includes(demo.loan.status) && disbursementExec) {
      loan.status = 'DISBURSED';
      loan.disbursedAt = now;
      loan.disbursedBy = disbursementExec._id;
      loan.statusHistory.push({ status: 'DISBURSED', by: disbursementExec._id, at: now, note: 'Funds released (seed)' });
    }

    let utrSeq = 1;
    for (const p of demo.loan.payments ?? []) {
      if (!collectionExec) break;
      const [payment] = await Payment.create([
        { loan: loan._id, utr: p.utr, amount: p.amount, paymentDate: now, recordedBy: collectionExec._id },
      ]);
      loan.paidAmount = Math.round((loan.paidAmount + payment.amount) * 100) / 100;
      loan.statusHistory.push({
        status: 'DISBURSED', by: collectionExec._id, at: now, note: `Payment ${p.utr} of ₹${p.amount} recorded (seed)`,
      });
      utrSeq++;
    }

    if (demo.loan.status === 'CLOSED' && collectionExec) {
      // Pay off the remainder so the demo data includes one auto-closed loan.
      const remaining = Math.round((loan.totalRepayment - loan.paidAmount) * 100) / 100;
      const [finalPayment] = await Payment.create([
        { loan: loan._id, utr: `UTRSEEDCLOSE${utrSeq}`, amount: remaining, paymentDate: now, recordedBy: collectionExec._id },
      ]);
      loan.paidAmount = Math.round((loan.paidAmount + finalPayment.amount) * 100) / 100;
      loan.status = 'CLOSED';
      loan.closedAt = now;
      loan.statusHistory.push({
        status: 'CLOSED', by: collectionExec._id, at: now, note: `Final payment ${finalPayment.utr} - loan auto-closed (seed)`,
      });
    }

    await loan.save();
    logger.info(`[seed] loan ${demo.loan.status}: ${demo.email} ₹${demo.loan.amount}/${demo.loan.tenureDays}d`);
  }

  // Fully-ready demo borrower for the evaluator's own login walkthrough
  await User.updateOne(
    { email: 'borrower@creditsea.com' },
    {
      $set: {
        pan: 'ABCDE1234F',
        dob: yearsAgo(28),
        monthlySalary: 45000,
        employmentMode: 'SALARIED',
        brePassed: true,
        breCheckedAt: new Date(),
        salarySlipUrl: '/uploads/demo-salary-slip.pdf',
      },
    }
  );
  logger.info('[seed] main borrower borrower@creditsea.com is BRE-verified with a slip on file');

  logger.info('\n[seed] done. Login with any account below (password: Password@123):');
  for (const acc of ROLE_ACCOUNTS) {
    logger.info(`  ${acc.role.padEnd(13)} ${acc.email}`);
  }
  logger.info('  demo borrowers (password: Password@123): rohit.lead@, nisha.verified@, arjun.ready@, priya.applied@, meera.sanctioned@, vikram.partial@, sana.fresh@ (…@example.com)');

  await db.disconnect();
}

seed().catch(async (err) => {
  logger.error('Seed failed:', err);
  await db.disconnect();
  process.exit(1);
});
