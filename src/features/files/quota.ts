export type StorageQuotaSnapshot = {
  quotaBytes: string;
  usedBytes: string;
  remainingBytes: string;
  usagePercent: number;
};

export function createStorageQuotaSnapshot(
  usedBytes: bigint,
  quotaBytes: number,
): StorageQuotaSnapshot {
  const safeUsedBytes = usedBytes < 0n ? 0n : usedBytes;
  const quota = BigInt(quotaBytes);
  const remainingBytes = quota > safeUsedBytes ? quota - safeUsedBytes : 0n;
  const usagePercent = Math.min(
    100,
    Math.round((Number(safeUsedBytes) / quotaBytes) * 1_000) / 10,
  );

  return {
    quotaBytes: quota.toString(),
    usedBytes: safeUsedBytes.toString(),
    remainingBytes: remainingBytes.toString(),
    usagePercent,
  };
}

export function canReserveStorage(
  snapshot: StorageQuotaSnapshot,
  requestedBytes: number,
) {
  return BigInt(requestedBytes) <= BigInt(snapshot.remainingBytes);
}
