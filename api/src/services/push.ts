import webpush from 'web-push';
import { pushSubscriptionsContainer } from './cosmos';
import { HistoryEntry, PushSubscriptionRecord } from '../shared/types';

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:owner@example.com';
  if (!pub || !priv) {
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

/**
 * Decide whether an audit entry warrants a push notification.
 * Mirrors the "Important" filter in the History UI: creates, deletes, and
 * meaningful price changes given the parent expense's price mode.
 */
export function isImportantForPush(e: HistoryEntry): boolean {
  switch (e.action) {
    case 'expense.create':
    case 'expense.delete':
      return true;
    case 'expense.update':
      return !!e.changes?.estimatedPrice && e.expensePriceMode === 'estimated';
    case 'detail.update':
      return !!e.detailChanges?.price && e.expensePriceMode === 'detailed';
    default:
      return false;
  }
}

function formatMoney(price?: number, currency?: 'RON' | 'EUR'): string {
  if (price === undefined || !currency) return '';
  try {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

function deltaText(from: unknown, to: unknown, currency?: 'RON' | 'EUR'): string {
  if (typeof from === 'number' && typeof to === 'number' && currency) {
    return `${formatMoney(from, currency)} → ${formatMoney(to, currency)}`;
  }
  return `${from} → ${to}`;
}

function buildPayload(e: HistoryEntry) {
  const title = 'RenoTrack';
  let body = '';
  switch (e.action) {
    case 'expense.create':
      body = `${e.userName} a creat „${e.expenseTitle}"${e.price !== undefined ? ` (${formatMoney(e.price, e.currency)})` : ''}`;
      break;
    case 'expense.delete':
      body = `${e.userName} a șters „${e.expenseTitle}"${e.price !== undefined ? ` (${formatMoney(e.price, e.currency)})` : ''}`;
      break;
    case 'expense.update': {
      const d = e.changes?.estimatedPrice;
      const cur = (e.changes?.estimatedCurrency?.to as 'RON' | 'EUR') || (e.changes?.estimatedCurrency?.from as 'RON' | 'EUR') || 'RON';
      body = `${e.userName} a schimbat prețul „${e.expenseTitle}": ${deltaText(d?.from, d?.to, cur)}`;
      break;
    }
    case 'detail.update': {
      const d = e.detailChanges?.price;
      const cur = (e.detailChanges?.currency?.to as 'RON' | 'EUR') || (e.detailChanges?.currency?.from as 'RON' | 'EUR') || 'RON';
      body = `${e.userName} a schimbat „${e.detailName ?? ''}" în „${e.expenseTitle}": ${deltaText(d?.from, d?.to, cur)}`;
      break;
    }
    default:
      body = `${e.userName} a făcut o modificare în „${e.expenseTitle}"`;
  }
  return {
    title,
    body,
    url: `/expense/${e.expenseId}`,
    tag: `reno-${e.expenseId}`,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
  };
}

/**
 * Fan-out a push notification to all subscribers in the workspace except the
 * user who performed the action. Failures are logged but never thrown.
 */
export async function notifyImportant(entry: HistoryEntry): Promise<void> {
  if (!ensureConfigured()) {
    // VAPID keys not set — push disabled. No-op silently.
    return;
  }
  if (!isImportantForPush(entry)) return;

  try {
    const container = await pushSubscriptionsContainer();
    const { resources: subs } = await container.items
      .query<PushSubscriptionRecord>(
        {
          query: 'SELECT * FROM c WHERE c.workspaceId = @ws AND c.userId != @uid',
          parameters: [
            { name: '@ws', value: entry.workspaceId },
            { name: '@uid', value: entry.userId },
          ],
        },
        { partitionKey: entry.workspaceId }
      )
      .fetchAll();

    if (subs.length === 0) return;

    const payload = JSON.stringify(buildPayload(entry));

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload,
            { TTL: 60 * 60 * 24 }
          );
        } catch (err: any) {
          const status = err?.statusCode;
          // 404 / 410 → subscription expired, remove from DB
          if (status === 404 || status === 410) {
            try {
              await container.item(sub.id, sub.workspaceId).delete();
            } catch {
              // ignore
            }
          } else {
            // eslint-disable-next-line no-console
            console.warn('Push send failed:', status, err?.body);
          }
        }
      })
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Push fan-out failed:', err);
  }
}
