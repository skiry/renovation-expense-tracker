import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Sparkles, Lock, Delete } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Cell = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'X' | 'BACK';

const INITIAL_LAYOUT: Cell[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'X', '0', 'BACK'];
const TARGET_LENGTH = 10;

/** Ordered list of cells to reveal one-by-one after the final shuffle storm. */
const REVEAL_ORDER: Cell[] = ['BACK', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'X', '0'];

/** Fisher-Yates shuffle producing a new array. */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Second hidden surprise route. Uses a custom on-screen keypad (digits 0-9,
 * the letter X, and a backspace) instead of the native mobile keyboard.
 *
 * Escalating chaos based on entered code length. On every keypress that
 * lands in a tier, that tier's auto-reshuffle chain restarts from scratch:
 *
 *   - length >= 2     → reshuffle on every keypress (press or backspace)
 *   - length 4 or 5   → auto-reshuffle every 2s, 3 times per keypress
 *   - length 6 or 7   → auto-reshuffle every 1s, 3 times per keypress
 *   - length 8 or 9   → auto-reshuffle every 500ms, 10 times per keypress
 *
 * After the 9th-key chain finishes its 10th shuffle, all cells become "X"
 * and then reveal one-by-one at 1s intervals in REVEAL_ORDER, each landing
 * on a random still-hidden position. While that reveal sequence runs, the
 * keypad is disabled (no keypress takes effect).
 *
 * Validation runs ONLY when the entered code length is exactly TARGET_LENGTH.
 */
export default function Surprise31Page() {
  const expected = (import.meta.env.VITE_SURPRISE_CODE ?? '').trim();
  const [code, setCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [shake, setShake] = useState(false);
  const [cells, setCells] = useState<Cell[]>(INITIAL_LAYOUT);
  /** When true, all cells display "X" and the reveal animation runs. */
  const [revealing, setRevealing] = useState(false);

  /** Currently active auto chain (if any). */
  const activeChainRef = useRef<number | null>(null);
  /** Currently active reveal timeouts (cleared on unmount or re-trigger). */
  const revealTimersRef = useRef<number[]>([]);

  const reshuffle = useCallback(() => {
    setCells((prev) => shuffle(prev));
  }, []);

  const stopActiveChain = useCallback(() => {
    if (activeChainRef.current !== null) {
      window.clearInterval(activeChainRef.current);
      activeChainRef.current = null;
    }
  }, []);

  const stopReveal = useCallback(() => {
    revealTimersRef.current.forEach((id) => window.clearTimeout(id));
    revealTimersRef.current = [];
  }, []);

  /**
   * Begin the reveal sequence: replace all cells with "X", then reveal each
   * cell from REVEAL_ORDER at 1s intervals into a random still-hidden slot.
   */
  const startReveal = useCallback(() => {
    stopReveal();
    setRevealing(true);
    const masked: Cell[] = Array.from({ length: INITIAL_LAYOUT.length }, () => 'X');
    setCells(masked);

    // Pre-pick the slot for every reveal step so we can schedule them all.
    const slots = shuffle(Array.from({ length: INITIAL_LAYOUT.length }, (_, i) => i));

    REVEAL_ORDER.forEach((char, i) => {
      const slot = slots[i];
      const timeoutId = window.setTimeout(() => {
        setCells((prev) => {
          const next = prev.slice();
          next[slot] = char;
          return next;
        });
        if (i === REVEAL_ORDER.length - 1) {
          setRevealing(false);
        }
      }, (i + 1) * 1000);
      revealTimersRef.current.push(timeoutId);
    });
  }, [stopReveal]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopActiveChain();
      stopReveal();
    };
  }, [stopActiveChain, stopReveal]);

  // Reshuffle on every code change once we have at least 2 characters typed.
  // Skipped while revealing so the carefully placed cells don't get scrambled.
  useEffect(() => {
    if (revealing) return;
    if (code.length >= 2) reshuffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Validate ONLY when the entered code length is exactly TARGET_LENGTH.
  useEffect(() => {
    if (!expected || code.length !== TARGET_LENGTH) return;
    if (code.toLowerCase() === expected.toLowerCase()) {
      setUnlocked(true);
    } else {
      setShake(true);
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [code, expected]);

  // On every code length change, (re)start the chain matching the new tier.
  // Each keypress that lands in a tier gets its own fresh round of firings —
  // so e.g. typing the 8th char fires 10x and typing the 9th fires another 10x.
  // After the 9-length chain finishes, kick off the reveal sequence.
  useEffect(() => {
    stopActiveChain();
    // Any code length change cancels an in-flight reveal too. (Should be rare
    // since the keypad is disabled during reveal, but covers edge cases like
    // re-entering the page mid-state.)
    if (revealing) stopReveal();

    const len = code.length;
    let intervalMs = 0;
    let maxFires = 0;
    let isFinalTier = false;
    if (len === 4 || len === 5) {
      intervalMs = 2000;
      maxFires = 3;
    } else if (len === 6 || len === 7) {
      intervalMs = 1000;
      maxFires = 3;
    } else if (len === 8) {
      intervalMs = 500;
      maxFires = 10;
    } else if (len === 9) {
      intervalMs = 500;
      maxFires = 10;
      isFinalTier = true;
    } else {
      return;
    }

    let count = 0;
    const intervalId = window.setInterval(() => {
      count++;
      reshuffle();
      if (count >= maxFires) {
        stopActiveChain();
        if (isFinalTier) startReveal();
      }
    }, intervalMs);
    activeChainRef.current = intervalId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code.length]);

  function press(char: string) {
    if (unlocked || revealing) return;
    setCode((c) => (c.length >= 32 ? c : c + char));
  }

  function backspace() {
    if (unlocked || revealing) return;
    setCode((c) => c.slice(0, -1));
  }

  const tracking = useMemo(() => (code ? 'tracking-[0.4em]' : ''), [code]);

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
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-muted py-6">
      <Card className={cn('w-full max-w-sm transition-transform', shake && 'animate-pulse')}>
        <CardContent className="p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-pink-100 dark:bg-pink-950/40 flex items-center justify-center">
              <Lock className="h-6 w-6 text-pink-600 dark:text-pink-400" />
            </div>
            <h1 className="text-xl font-semibold">O altă surpriză micuță 💕</h1>
            <p className="text-sm text-muted-foreground">Introdu codul ca să o deschizi.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="surprise31-code" className="sr-only">
              Cod
            </Label>
            <Input
              id="surprise31-code"
              type="text"
              inputMode="none"
              readOnly
              value={code}
              onFocus={(e) => e.target.blur()}
              placeholder="Cod"
              className={cn('text-center text-lg font-mono caret-transparent select-none', tracking)}
              aria-label="Cod introdus"
            />
          </div>

          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Tastatură cod">
            {cells.map((cell, idx) => {
              if (cell === 'BACK') {
                return (
                  <KeypadButton
                    key={idx}
                    onClick={backspace}
                    disabled={revealing}
                    aria-label="Șterge ultimul caracter"
                  >
                    <Delete className="h-5 w-5" />
                  </KeypadButton>
                );
              }
              return (
                <KeypadButton
                  key={idx}
                  onClick={() => press(cell)}
                  disabled={revealing}
                  aria-label={cell === 'X' ? 'Litera X' : undefined}
                >
                  {cell}
                </KeypadButton>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KeypadButton({
  children,
  onClick,
  disabled,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      type="button"
      // We avoid the native `disabled` attribute so the button keeps its
      // normal visual styling; the parent simply ignores the click when its
      // own logic decides the keypad shouldn't accept input.
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        // Drop focus immediately so the button doesn't remain visually
        // highlighted after a tap (matters mostly on desktop where mouse
        // focus persists; mobile rarely shows a focus ring).
        (e.currentTarget as HTMLButtonElement).blur();
        if (disabled) return;
        onClick();
      }}
      className={cn(
        'h-14 rounded-lg border bg-card text-xl font-medium transition-colors flex items-center justify-center select-none active:scale-95 hover:bg-accent border-border',
        // Suppress the persistent focus ring on click; keep it for keyboard
        // users via :focus-visible.
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
