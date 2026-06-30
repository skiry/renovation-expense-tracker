import { Expense, ExpensePhoto } from '../shared/types';
import { getReadUrl } from '../services/blob';

/** Augment a stored expense with SAS URLs for its photos (blobUrl). */
export function withPhotoUrls(expense: Expense): any {
  const photos = (expense.photos || []).map((p) => ({
    id: p.id,
    blobName: p.blobName,
    uploadedAt: p.uploadedAt,
    contentType: p.contentType,
    fileName: p.fileName,
    blobUrl: getReadUrl(p.blobName, 7),
  }));
  return { ...expense, photos };
}

/** Strip server-only fields (none currently) before persisting. */
export function sanitizeForStorage<T extends Partial<Expense>>(input: T): T {
  // Could strip _etag etc. here if client sends it back. Cosmos handles it via headers anyway.
  const copy: any = { ...input };
  delete copy._etag;
  delete copy.workspaceId; // never trust client; we set this
  return copy;
}

export function newExpensePhoto(blobName: string, contentType?: string, fileName?: string): ExpensePhoto {
  return {
    id: blobName.split('/').pop()!.replace(/\.[^.]+$/, ''),
    blobName,
    uploadedAt: new Date().toISOString(),
    contentType,
    fileName,
  };
}
