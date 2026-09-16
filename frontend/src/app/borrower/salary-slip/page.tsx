'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, ApiClientError } from '@/lib/api';

export default function SalarySlipPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      await api('/api/borrower/salary-slip', { method: 'POST', formData: fd });
      toast.success('Uploaded');
      setSuccess(true);
      setTimeout(() => router.push('/borrower/loan-config'), 600);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card p-4 lg:col-span-2">
        <h2 className="mb-3 text-[15px] font-bold text-[var(--navy)]">Upload Salary Slip</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-6 text-center transition-colors hover:border-[var(--blue)] hover:bg-[var(--blue-light)]">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <div>
                <p className="text-[13px] font-medium text-[var(--navy)]">{file.name}</p>
                <p className="text-[11px] text-[var(--text-dim)]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <svg className="mx-auto text-[var(--text-dim)] mb-1" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-[12px] font-medium text-[var(--text-dim)]">PDF, JPG, or PNG - max 5 MB</p>
              </div>
            )}
          </label>
          <button type="submit" className="btn-primary w-full" disabled={uploading || !file || success}>
            {success ? '✓ Saved' : uploading ? 'Uploading…' : 'Upload & continue'}
          </button>
        </form>
      </div>

      <div className="card p-4 self-start">
        <h3 className="mb-2 text-[13px] font-bold text-[var(--navy)]">Why is this needed?</h3>
        <p className="text-[12px] leading-relaxed text-[var(--text-dim)]">
          Your salary slip verifies income for loan eligibility. It is stored securely and only shared with the credit team during sanction review.
        </p>
        <div className="mt-3 rounded-md bg-[var(--surface-2)] p-2 text-[11px] text-[var(--text-dim)]">
          Accepted formats: PDF, JPG, PNG. Max file size: 5 MB.
        </div>
      </div>
    </div>
  );
}
