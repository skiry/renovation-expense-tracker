import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth';
import { api } from '@/services/api';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const setAccessCode = useAuthStore((s) => s.setAccessCode);
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await api.verifyAccessCode(code.trim());
      if (!res.exists) {
        toast.error('Cod inexistent. Verifică sau creează unul nou.');
        return;
      }
      setAccessCode(code.trim());
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (c.length < 6) {
      toast.error('Codul trebuie să aibă minim 6 caractere.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.createWorkspace(c);
      if (!res.created) {
        toast.error(res.reason ?? 'Nu s-a putut crea codul.');
        return;
      }
      toast.success('Cod creat. Bine ai venit!');
      setAccessCode(c);
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 text-3xl">🏠</div>
          <CardTitle>RenoTrack</CardTitle>
          <CardDescription>Evidența cheltuielilor de renovare</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={mode === 'login' ? handleLogin : handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">{mode === 'login' ? 'Cod de acces' : 'Cod nou (min 6 caractere)'}</Label>
              <Input
                id="code"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={mode === 'login' ? 'ex: 1234' : 'ex: RENO123'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Se procesează…' : mode === 'login' ? 'Intră' : 'Creează cod'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              onClick={() => {
                setMode(mode === 'login' ? 'create' : 'login');
                setCode('');
              }}
              disabled={loading}
            >
              {mode === 'login' ? 'Nu ai cod? Creează unul nou' : 'Înapoi la autentificare'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
