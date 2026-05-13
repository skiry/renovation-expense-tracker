import { useState } from 'react';
import { RefreshCw, Sun, Moon, Monitor, Trash2, Plus, User } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useExchangeRate, useRefreshExchangeRate, useUsers, useCreateUser, useDeleteUser } from '@/hooks/useExpenses';
import { useAuthStore } from '@/store/auth';
import { useThemeStore, type Theme } from '@/store/theme';
import { IS_MOCK } from '@/services/api';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { data: rate, isLoading } = useExchangeRate();
  const refresh = useRefreshExchangeRate();
  const accessCode = useAuthStore((s) => s.accessCode);
  const userName = useAuthStore((s) => s.userName);
  const userId = useAuthStore((s) => s.userId);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const { data: users = [] } = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  async function submitNew() {
    const n = newName.trim();
    if (!n) {
      toast.error('Introdu un nume');
      return;
    }
    const res = await createUser.mutateAsync(n);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Utilizator creat');
    setNewName('');
    setNewUserOpen(false);
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await deleteUser.mutateAsync(confirmDelete.id);
    toast.success('Utilizator șters');
    setConfirmDelete(null);
  }

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
          <CardTitle>Utilizatori</CardTitle>
          <CardDescription>Persoanele care folosesc acest cod</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Niciun utilizator încă.</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {u.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {u.name}
                        {u.id === userId && <span className="ml-1 text-xs text-muted-foreground">(tu)</span>}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setConfirmDelete({ id: u.id, name: u.name })}
                    aria-label="Șterge"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={() => setNewUserOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Adaugă utilizator
          </Button>
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
          <CardTitle>Sesiune</CardTitle>
          <CardDescription>Workspace-ul curent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cod de acces</span>
            <span className="font-mono">{accessCode}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Utilizator</span>
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {userName ?? '—'}
            </span>
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

      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Utilizator nou</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="newuser">Nume</Label>
            <Input
              id="newuser"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitNew();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewUserOpen(false)}>
              Anulează
            </Button>
            <Button onClick={submitNew} disabled={createUser.isPending}>
              {createUser.isPending ? 'Se creează…' : 'Creează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge utilizator?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{confirmDelete?.name}</span> va fi șters. Intrările lor din
            istoric rămân vizibile cu numele snapshot. Această acțiune nu poate fi anulată.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Anulează
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={deleteUser.isPending}>
              Șterge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
