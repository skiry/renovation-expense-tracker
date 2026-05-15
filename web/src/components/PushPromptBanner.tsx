import { Bell, BellOff, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const DISMISS_KEY = 'reno-push-banner-dismissed';

export function PushPromptBanner() {
  const { support, permission, subscribed, loading, enable } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Don't show when: dismissed manually, already subscribed, permission denied,
  // browser doesn't support push, or on iOS Safari outside of PWA.
  if (dismissed) return null;
  if (!support.apiAvailable || support.iosNeedsInstall) return null;
  if (permission === 'denied') return null;
  if (subscribed) return null;

  function permanentDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-3 flex items-start gap-3">
        <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm">
            Vrei să primești <span className="font-medium">notificări</span> când cineva adaugă, șterge sau
            schimbă prețul unei cheltuieli?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={loading}
              onClick={async () => {
                const res = await enable();
                if (res.ok) toast.success('Notificările sunt activate');
                else toast.error(res.reason ?? 'Nu s-au putut activa');
              }}
            >
              {loading ? 'Se activează…' : 'Activează'}
            </Button>
            <Button size="sm" variant="ghost" onClick={permanentDismiss}>
              Mai târziu
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={permanentDismiss}
          aria-label="Închide"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}

export function PushSettingsCard() {
  const { support, permission, subscribed, loading, enable, disable } = usePushNotifications();

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {subscribed ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          <div>
            <div className="text-sm font-medium">Notificări push</div>
            <div className="text-xs text-muted-foreground">
              Te anunțăm când altcineva face modificări importante în acest workspace.
            </div>
          </div>
        </div>

        {!support.apiAvailable ? (
          <p className="text-xs text-muted-foreground">
            Browserul tău nu suportă notificările push.
          </p>
        ) : support.iosNeedsInstall ? (
          <p className="text-xs text-muted-foreground">
            Pe iPhone, notificările funcționează doar din aplicația instalată pe Home Screen. Apasă pe{' '}
            <span className="font-medium">Share → Add to Home Screen</span> în Safari pentru a o instala.
          </p>
        ) : permission === 'denied' ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Ai refuzat permisiunea. Pentru a o reactiva, modifică din setările browser-ului / Home Screen.
          </p>
        ) : subscribed ? (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={async () => {
              await disable();
              toast.success('Notificările au fost dezactivate');
            }}
          >
            <BellOff className="h-4 w-4 mr-1" />
            {loading ? 'Se dezactivează…' : 'Dezactivează'}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={loading}
            onClick={async () => {
              const res = await enable();
              if (res.ok) toast.success('Notificările sunt activate');
              else toast.error(res.reason ?? 'Nu s-au putut activa');
            }}
          >
            <Bell className="h-4 w-4 mr-1" />
            {loading ? 'Se activează…' : 'Activează notificări'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
