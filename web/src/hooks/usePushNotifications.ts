import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';

interface PushConfig {
  publicKey: string;
  enabled: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

export interface PushSupport {
  /** Browser exposes the Push & Notification APIs. */
  apiAvailable: boolean;
  /** On iOS, push only works inside an installed PWA. */
  iosNeedsInstall: boolean;
  /** Can the user actually subscribe right now? */
  canEnable: boolean;
}

export function detectPushSupport(): PushSupport {
  const apiAvailable =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator;
  const iosNeedsInstall = isIos() && !isStandalone();
  return {
    apiAvailable,
    iosNeedsInstall,
    canEnable: apiAvailable && !iosNeedsInstall,
  };
}

interface UsePushResult {
  support: PushSupport;
  /** undefined while we haven't checked yet. */
  permission: NotificationPermission | undefined;
  /** Has this device already subscribed for the current auth context. */
  subscribed: boolean;
  loading: boolean;
  enable: () => Promise<{ ok: boolean; reason?: string }>;
  disable: () => Promise<void>;
}

export function usePushNotifications(): UsePushResult {
  const accessCode = useAuthStore((s) => s.accessCode);
  const userId = useAuthStore((s) => s.userId);
  const userName = useAuthStore((s) => s.userName);

  const [support] = useState<PushSupport>(() => detectPushSupport());
  const [permission, setPermission] = useState<NotificationPermission | undefined>(() =>
    support.apiAvailable ? Notification.permission : undefined
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Refresh subscribed state when we know we have a registration.
  useEffect(() => {
    if (!support.apiAvailable) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!sub);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [support.apiAvailable]);

  // Auto-resubscribe whenever the auth context (workspace + user) changes:
  // if the browser already has a push subscription AND permission granted,
  // silently push the subscription to the backend so the new (workspace,user)
  // combo is registered. Same endpoint in older workspaces is cleaned up
  // server-side.
  useEffect(() => {
    if (!support.canEnable) return;
    if (!accessCode || !userId) return;
    if (permission !== 'granted') return;

    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        const json = sub.toJSON();
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-code': accessCode,
            'x-user-id': userId,
          },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
            deviceLabel: userName ?? undefined,
          }),
        });
        if (!cancelled) setSubscribed(true);
      } catch {
        // silent — user can manually toggle from Settings if needed
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessCode, userId, userName, permission, support.canEnable]);

  const enable = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (!support.canEnable) {
      return {
        ok: false,
        reason: support.iosNeedsInstall
          ? 'Pe iOS, notificările funcționează doar din aplicația instalată pe Home Screen. Apasă pe „Share → Add to Home Screen" pentru a o instala.'
          : 'Browserul nu suportă notificările push.',
      };
    }
    if (!accessCode || !userId) return { ok: false, reason: 'Nu ești autentificat.' };

    setLoading(true);
    try {
      // 1) Ask permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return { ok: false, reason: 'Permisiunea a fost refuzată.' };

      // 2) Get config + register SW
      const cfgRes = await fetch('/api/push/config', { headers: { 'x-access-code': accessCode } });
      const cfg = (await cfgRes.json()) as PushConfig;
      if (!cfg.enabled || !cfg.publicKey) {
        return { ok: false, reason: 'Serverul nu are configurate cheile push.' };
      }

      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 3) Subscribe
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as BufferSource,
        });
      }

      // 4) Send subscription to backend
      const json = sub.toJSON();
      const payload = {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        deviceLabel: userName ?? undefined,
      };
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-code': accessCode,
          'x-user-id': userId,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return { ok: false, reason: `Eroare la salvarea abonamentului (HTTP ${res.status}).` };
      }
      setSubscribed(true);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, reason: err?.message ?? 'Eroare necunoscută.' };
    } finally {
      setLoading(false);
    }
  }, [accessCode, userId, userName, support]);

  const disable = useCallback(async () => {
    if (!support.apiAvailable || !accessCode) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-access-code': accessCode },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => null);
        await sub.unsubscribe().catch(() => null);
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [support.apiAvailable, accessCode]);

  return { support, permission, subscribed, loading, enable, disable };
}
