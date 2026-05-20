import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Lock, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import SurpriseJourney from './surprise/SurpriseJourney';

const UNLOCK_STORAGE_KEY = 'reno.surprise.unlocked';

function hashCode(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h);
}

/**
 * Hidden surprise route. Anyone can navigate here, but a secret code is required
 * to view the content. The code is validated against the public env var
 * VITE_SURPRISE_CODE (baked at build time).
 *
 * Failure escalation (session-only, resets on refresh):
 *   - wrong attempts 1-3 → the form card "crumbles" (falls + spins) for ~12s
 *     and then resets so the user can try again
 *   - wrong attempt 4    → a "?" square appears at a random position
 *   - taps 1-5 on the "?" → it teleports to another random position
 *   - tap 6              → a placeholder dialog with "test" opens
 */
export default function SurprisePage() {
  const expected = (import.meta.env.VITE_SURPRISE_CODE ?? '').trim();
  const expectedHash = useMemo(() => hashCode(expected.toLowerCase()), [expected]);
  const [code, setCode] = useState('');
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return expected !== '' && localStorage.getItem(UNLOCK_STORAGE_KEY) === expectedHash;
    } catch {
      return false;
    }
  });

  // Failure state
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [crumbleVariant, setCrumbleVariant] = useState<'fall' | 'shatter' | 'quake' | null>(null);
  const [buttonShake, setButtonShake] = useState(false);
  const [questionPos, setQuestionPos] = useState<{ left: number; top: number } | null>(null);
  const [questionTaps, setQuestionTaps] = useState(0);
  /** Once the user has hit the 6th tap, the "?" parks in the bottom-left
   * corner and the dialog stops being one-shot — tapping it reopens. */
  const [hintParked, setHintParked] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** Holds the user's pending unlock until they acknowledge the reminder dialog. */
  const [pendingUnlock, setPendingUnlock] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  function randomPosition(): { left: number; top: number } {
    // Keep the 64x64 square fully inside the viewport with a small margin.
    const margin = 16;
    const size = 64;
    const w = window.innerWidth - size - margin * 2;
    const h = window.innerHeight - size - margin * 2;
    return {
      left: margin + Math.random() * Math.max(0, w),
      top: margin + Math.random() * Math.max(0, h),
    };
  }

  function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!expected) {
      triggerWrong();
      return;
    }
    if (code.trim().toLowerCase() === expected.toLowerCase()) {
      // Show the reminder dialog first; only flip `unlocked` after the user
      // explicitly acknowledges it.
      setPendingUnlock(true);
    } else {
      triggerWrong();
    }
  }

  function triggerWrong() {
    const next = wrongAttempts + 1;
    setWrongAttempts(next);
    if (next < 4) {
      // Pick a different animation per attempt so failures feel escalating.
      // Attempt 1's "fall" is snappier (5s); attempts 2 & 3 are the full 12s.
      const variant = next === 1 ? 'fall' : next === 2 ? 'shatter' : 'quake';
      const duration = variant === 'fall' ? 5000 : 12000;
      setCrumbleVariant(variant);
      window.setTimeout(() => {
        setCrumbleVariant(null);
        setCode('');
      }, duration);
    } else if (next === 4) {
      // Spawn the "?" square at a random position.
      setQuestionPos(randomPosition());
      setQuestionTaps(0);
    } else {
      // Attempt 5 onward: short red-shake feedback on the submit button.
      setButtonShake(true);
      window.setTimeout(() => {
        setButtonShake(false);
        setCode('');
      }, 1000);
    }
  }

  function onQuestionTap() {
    if (hintParked) {
      // Park mode: every tap simply reopens the hint dialog.
      setDialogOpen(true);
      return;
    }
    const taps = questionTaps + 1;
    setQuestionTaps(taps);
    if (taps < 6) {
      // Teleport to a new random position.
      setQuestionPos(randomPosition());
    } else {
      // Tap 6: park the square in the bottom-left corner and open the hint.
      setHintParked(true);
      setQuestionPos(null);
      setDialogOpen(true);
    }
  }

  // Safety: if the viewport resizes while the "?" is shown, clamp it back in.
  useEffect(() => {
    if (!questionPos || hintParked) return;
    function onResize() {
      setQuestionPos(randomPosition());
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [questionPos, hintParked]);

  if (unlocked) {
    return <SurpriseJourney />;
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-muted overflow-hidden relative"
    >
      <Card className={cn('w-full max-w-sm', crumbleVariant && `reno-crumble-${crumbleVariant}`)}>
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
                disabled={!!crumbleVariant}
              />
            </div>
            <Button
              type="submit"
              className={cn(
                'w-full transition-colors',
                buttonShake && 'bg-destructive hover:bg-destructive text-destructive-foreground reno-button-shake'
              )}
              disabled={!!crumbleVariant}
            >
              Deschide
            </Button>
          </form>
        </CardContent>
      </Card>

      {questionPos && (
        <button
          type="button"
          onClick={onQuestionTap}
          aria-label="Pătrat cu semn de întrebare"
          className={cn(
            'fixed h-16 w-16 rounded-lg border-2 border-pink-400 dark:border-pink-500 bg-pink-50 dark:bg-pink-950/50',
            'shadow-lg flex items-center justify-center text-pink-700 dark:text-pink-300',
            'transition-all duration-150 active:scale-95 z-50',
            // Subtle pulse to draw attention while teleporting; once parked
            // it's just a quiet helper icon.
            'animate-pulse'
          )}
          style={{ left: `${questionPos.left}px`, top: `${questionPos.top}px` }}
        >
          <HelpCircle className="h-8 w-8" strokeWidth={2.5} />
        </button>
      )}

      {hintParked && (
        <button
          type="button"
          onClick={onQuestionTap}
          aria-label="Vezi indiciul pentru cod"
          className={cn(
            'fixed bottom-4 left-4 h-12 w-12 rounded-lg border-2 border-pink-400 dark:border-pink-500',
            'bg-pink-50 dark:bg-pink-950/50 shadow-lg flex items-center justify-center',
            'text-pink-700 dark:text-pink-300 transition-transform active:scale-95 z-50'
          )}
        >
          <HelpCircle className="h-6 w-6" strokeWidth={2.5} />
        </button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-pink-500" />
              Indiciu pentru cod
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed">
            Codul va începe cu <span className="font-medium">ziua logodnei noastre</span> și se va termina cu{' '}
            <span className="font-medium">ziua nunții noastre</span>. Iar ceea ce este între aceste numere, vei
            putea afla de la <span className="font-medium">Ionuț</span>… încearcă să scoți codul secret de la
            el, sau dacă nu, dezbracă-l și poate vei găsi codul secret pe el. 💕
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Însă nu uita: <span className="font-medium text-foreground">primele 2 cifre</span> și{' '}
            <span className="font-medium text-foreground">ultimele 2 cifre</span> ale codului secret. Ai nevoie
            de codul complet pentru a putea debloca această surpriză.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingUnlock} onOpenChange={(v) => !v && setPendingUnlock(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-pink-500" />
              Ține minte acest cod
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Nu se știe când vei avea nevoie de el! 💕
          </p>
          <DialogFooter>
            <Button
              onClick={() => {
                setPendingUnlock(false);
                try {
                  localStorage.setItem(UNLOCK_STORAGE_KEY, expectedHash);
                } catch {
                  /* ignore */
                }
                setUnlocked(true);
              }}
            >
              Am înțeles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
