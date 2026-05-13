import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { User, Plus, ArrowLeft, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useAuthStore } from '@/store/auth';
import { useUsers, useCreateUser } from '@/hooks/useExpenses';

export default function UserSelectPage() {
  const navigate = useNavigate();
  const { data: users = [], isLoading } = useUsers();
  const createUser = useCreateUser();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const accessCode = useAuthStore((s) => s.accessCode);
  const userId = useAuthStore((s) => s.userId);

  // Already picked a user → go to dashboard
  if (accessCode && userId) return <Navigate to="/" replace />;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');

  function selectUser(id: string, displayName: string) {
    setUser(id, displayName);
    navigate('/');
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Introdu un nume');
      return;
    }
    const res = await createUser.mutateAsync(trimmed);
    if (res.error || !res.user) {
      toast.error(res.error ?? 'Eroare la creare');
      return;
    }
    toast.success('Utilizator creat');
    setDialogOpen(false);
    setName('');
    selectUser(res.user.id, res.user.name);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 text-3xl">👋</div>
          <CardTitle>Alege utilizator</CardTitle>
          <CardDescription>
            Workspace: <span className="font-mono">{accessCode}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center">Se încarcă…</p>
          ) : users.length === 0 ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">Niciun utilizator creat.</p>
              <Button onClick={() => setDialogOpen(true)} className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                Creează unul acum
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {users.map((u) => (
                  <Button
                    key={u.id}
                    variant="outline"
                    className="w-full justify-start h-12"
                    onClick={() => selectUser(u.id, u.name)}
                  >
                    <User className="h-4 w-4 mr-2" />
                    {u.name}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Creează utilizator nou
              </Button>
            </>
          )}

          <div className="border-t pt-3 flex flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Ieși din workspace
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Utilizator nou</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="uname">Nume</Label>
            <Input
              id="uname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Bogdan"
              autoFocus
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Anulează
            </Button>
            <Button onClick={submit} disabled={createUser.isPending}>
              {createUser.isPending ? 'Se creează…' : 'Creează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
