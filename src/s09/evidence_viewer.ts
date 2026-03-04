import type { EvidenceReceipt, EvidenceRow } from './types.ts';

export function buildEvidenceRows(receipts: EvidenceReceipt[]): EvidenceRow[] {
  return [...receipts]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((receipt) => ({
      id: receipt.id,
      label: `${receipt.id} (${receipt.exitCode})`,
      exitCode: receipt.exitCode,
      command: receipt.command,
      openRawPath: receipt.stdoutPath,
      durablePath: receipt.durablePath ?? null,
    }));
}

export function summarizeEvidence(rows: EvidenceRow[]): { total: number; failed: number; success: number } {
  const failed = rows.filter((row) => row.exitCode !== 0).length;
  return {
    total: rows.length,
    failed,
    success: rows.length - failed,
  };
}
