import { RefreshCw, Sun, Moon, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useExchangeRate, useRefreshExchangeRate } from '@/hooks/useExpenses';
import { useAuthStore } from '@/store/auth';
import { useThemeStore, type Theme } from '@/store/theme';
import { IS_MOCK } from '@/services/api';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { data: rate, isLoading } = useExchangeRate();
  const refresh = useRefreshExchangeRate();
  const accessCode = useAuthStore((s) => s.accessCode);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Aspect</CardTitle>
          <CardDescription>Alege tema aplicației</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <ThemeOption value="light" current={theme} onChange={setTheme} icon={<Sun className="h-5 w-5" />} label="Luminos" />
            <ThemeOption value="dark" current={theme} onChange={setTheme} icon={<Moon className="h-5 w-5" />} label="Întunecat" />
            <ThemeOption value="system" current={theme} onChange={setTheme} icon={<Monitor className="h-5 w-5" />} label="Sistem" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Curs de schimb EUR → RON</CardTitle>
          <CardDescription>Sursă: BNR (Banca Națională a României)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Se încarcă…</p>
          ) : rate ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">{rate.eurToRon.toFixed(4)}</span>
                <span className="text-sm text-muted-foreground">RON pentru 1 EUR</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Actualizat: {new Date(rate.updatedAt).toLocaleString('ro-RO')} ({rate.source})
              </p>
            </>
          ) : null}
          <Button
            variant="outline"
            onClick={async () => {
              await refresh.mutateAsync();
              toast.success('Curs actualizat');
            }}
            disabled={refresh.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refresh.isPending ? 'animate-spin' : ''}`} />
            Actualizează acum
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Date despre contul tău</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cod de acces</span>
            <span className="font-mono">{accessCode}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mod</span>
            <span>{IS_MOCK ? 'POC (mock local)' : 'Producție'}</span>
          </div>
        </CardContent>
      </Card>

      {IS_MOCK && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-amber-600 dark:text-amber-400">Mod POC activ</p>
            <p>
              Datele sunt salvate local în browser (localStorage). La trecerea pe Azure (Cosmos DB + Blob Storage), datele
              vor fi sincronizate prin API-ul Azure Functions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ThemeOption({
  value,
  current,
  onChange,
  icon,
  label,
}: {
  value: Theme;
  current: Theme;
  onChange: (t: Theme) => void;
  icon: React.ReactNode;
  label: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
      )}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}
