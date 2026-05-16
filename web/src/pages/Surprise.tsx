import { useState } from 'react';
import { Heart, Sparkles, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

/**
 * Hidden surprise route. Anyone can navigate here, but a secret code is required
 * to view the content. The code is validated against the public env var
 * VITE_SURPRISE_CODE (baked at build time).
 */
export default function SurprisePage() {
  const expected = (import.meta.env.VITE_SURPRISE_CODE ?? '').trim();
  const [code, setCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [shake, setShake] = useState(false);

  function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!expected) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (code.trim().toLowerCase() === expected.toLowerCase()) {
      setUnlocked(true);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  if (unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-pink-50 via-rose-50 to-amber-50 dark:from-pink-950/30 dark:via-rose-950/30 dark:to-amber-950/20">
        <Card className="w-full max-w-md border-pink-200 dark:border-pink-900/40 shadow-xl">
          <CardContent className="p-8 text-center space-y-5">
            <div className="text-6xl mx-auto">💝</div>
            <h1 className="text-3xl font-bold tracking-tight">Te iubesc!</h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              Aceasta e o surpriză micuță pentru tine. În curând o să adăugăm aici un slideshow cu amintirile
              noastre și un traseu de aventură doar pentru noi doi.
            </p>
            <div className="flex items-center justify-center gap-2 text-pink-600 dark:text-pink-400">
              <Heart className="h-5 w-5 fill-current" />
              <Sparkles className="h-5 w-5" />
              <Heart className="h-5 w-5 fill-current" />
            </div>
            <p className="text-xs text-muted-foreground pt-3">Verifică din nou pagina curând — va crește 🌱</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-muted">
      <Card className={`w-full max-w-sm transition-transform ${shake ? 'animate-pulse' : ''}`}>
        <CardContent className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-pink-100 dark:bg-pink-950/40 flex items-center justify-center">
              <Lock className="h-6 w-6 text-pink-600 dark:text-pink-400" />
            </div>
            <h1 className="text-xl font-semibold">O surpriză micuță 💕</h1>
            <p className="text-sm text-muted-foreground">Introdu codul ca să o deschizi.</p>
          </div>
          <form onSubmit={tryUnlock} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="surprise-code" className="sr-only">
                Cod
              </Label>
              <Input
                id="surprise-code"
                type="text"
                inputMode="text"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Cod"
              />
            </div>
            <Button type="submit" className="w-full">
              Deschide
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
