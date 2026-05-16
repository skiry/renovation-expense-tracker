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

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

async function sendToSubscribers(subs: PushSubscriptionRecord[], payload: PushPayload) {
  const container = await pushSubscriptionsContainer();
  const json = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag ?? 'reno-generic',
    icon: payload.icon ?? '/pwa-192.png',
    badge: payload.badge ?? '/pwa-192.png',
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          json,
          { TTL: 60 * 60 * 24 }
        );
      } catch (err: any) {
        const status = err?.statusCode;
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
}

/** Send a push to specific user IDs (or all users) inside a workspace. */
export async function sendPushToUsers(
  workspaceId: string,
  targetUserIds: string[] | 'all',
  payload: PushPayload
): Promise<{ delivered: number; total: number }> {
  if (!ensureConfigured()) return { delivered: 0, total: 0 };

  const container = await pushSubscriptionsContainer();
  let query: { query: string; parameters: { name: string; value: any }[] };

  if (targetUserIds === 'all') {
    query = {
      query: 'SELECT * FROM c WHERE c.workspaceId = @ws',
      parameters: [{ name: '@ws', value: workspaceId }],
    };
  } else {
    if (targetUserIds.length === 0) return { delivered: 0, total: 0 };
    // ARRAY_CONTAINS workaround: use IN with bound params
    const placeholders = targetUserIds.map((_, i) => `@u${i}`).join(', ');
    query = {
      query: `SELECT * FROM c WHERE c.workspaceId = @ws AND c.userId IN (${placeholders})`,
      parameters: [
        { name: '@ws', value: workspaceId },
        ...targetUserIds.map((id, i) => ({ name: `@u${i}`, value: id })),
      ],
    };
  }

  const { resources: subs } = await container.items
    .query<PushSubscriptionRecord>(query, { partitionKey: workspaceId })
    .fetchAll();

  await sendToSubscribers(subs, payload);
  return { delivered: subs.length, total: subs.length };
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

function buildAuditPayload(e: HistoryEntry): PushPayload {
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
  };
}

/**
 * Fan-out a push notification to all subscribers in the workspace except the
 * user who performed the action. Failures are logged but never thrown.
 */
export async function notifyImportant(entry: HistoryEntry): Promise<void> {
  if (!ensureConfigured()) return;
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
    await sendToSubscribers(subs, buildAuditPayload(entry));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Push fan-out failed:', err);
  }
}
