import {
  BlobServiceClient,
  ContainerClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { uuid } from '../shared/slug';

let _service: BlobServiceClient | null = null;
let _container: ContainerClient | null = null;
let _cred: StorageSharedKeyCredential | null = null;
let _accountName: string | null = null;

function parseConnString(conn: string): { accountName: string; accountKey: string } {
  const parts = Object.fromEntries(
    conn.split(';').filter(Boolean).map((kv) => {
      const idx = kv.indexOf('=');
      return [kv.slice(0, idx), kv.slice(idx + 1)];
    })
  );
  return { accountName: parts.AccountName, accountKey: parts.AccountKey };
}

function service(): BlobServiceClient {
  if (_service) return _service;
  const conn = process.env.BLOB_CONNECTION;
  if (!conn) throw new Error('BLOB_CONNECTION env variable is not set');
  const { accountName, accountKey } = parseConnString(conn);
  _accountName = accountName;
  _cred = new StorageSharedKeyCredential(accountName, accountKey);
  _service = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, _cred);
  return _service;
}

function container(): ContainerClient {
  if (_container) return _container;
  const name = process.env.BLOB_CONTAINER || 'expense-photos';
  _container = service().getContainerClient(name);
  return _container;
}

/** Upload a file buffer, returns the blob name. */
export async function uploadPhoto(buffer: Buffer, mime: string, workspaceId: string, expenseId: string): Promise<string> {
  const ext = mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
  const blobName = `${workspaceId}/${expenseId}/${uuid()}.${ext}`;
  const block = container().getBlockBlobClient(blobName);
  await block.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mime,
      blobCacheControl: 'public, max-age=31536000',
    },
  });
  return blobName;
}

/** Generate a read-only SAS URL for a blob, valid for `daysValid` days. */
export function getReadUrl(blobName: string, daysValid = 7): string {
  service(); // ensure cred is loaded
  if (!_cred || !_accountName) throw new Error('Blob service not initialized');
  const containerName = process.env.BLOB_CONTAINER || 'expense-photos';

  const expiresOn = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(Date.now() - 60_000),
      expiresOn,
      protocol: 'https' as any,
    },
    _cred
  ).toString();

  return `https://${_accountName}.blob.core.windows.net/${containerName}/${encodeURI(blobName)}?${sas}`;
}

export async function deletePhoto(blobName: string): Promise<void> {
  try {
    await container().getBlockBlobClient(blobName).deleteIfExists();
  } catch {
    // ignore — best effort
  }
}
