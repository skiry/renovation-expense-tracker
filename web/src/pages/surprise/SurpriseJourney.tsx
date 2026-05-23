import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import PuzzlePhase from './PuzzlePhase';
import MemoryPhase from './MemoryPhase';

/**
 * Multi-phase emotional journey shown after a successful unlock on /surprise.
 *
 * Flow: puzzle → memory → timeline → slideshow → final message.
 *
 * Progress is persisted in localStorage so a refresh resumes at the same phase.
 * A discreet "Skip" button (top-right) lets the user (or me, while testing)
 * jump to the next phase without completing the current one.
 */
export type Phase = 'puzzle' | 'memory' | 'final';

const PHASES: Phase[] = ['puzzle', 'memory', 'final'];

const PHASE_LABELS: Record<Phase, string> = {
  puzzle: 'Puzzle',
  memory: 'Memorie',
  final: 'Final',
};

const STORAGE_KEY = 'reno.surprise.journey.phase';

function loadPhase(): Phase {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (PHASES as string[]).includes(v)) return v as Phase;
  } catch {
    /* ignore */
  }
  return 'puzzle';
}

function savePhase(p: Phase) {
  try {
    localStorage.setItem(STORAGE_KEY, p);
  } catch {
    /* ignore */
  }
}

export default function SurpriseJourney() {
  const [phase, setPhase] = useState<Phase>(() => loadPhase());

  useEffect(() => {
    savePhase(phase);
  }, [phase]);

  const phaseIndex = useMemo(() => PHASES.indexOf(phase), [phase]);

  const goNext = useCallback(() => {
    setPhase((prev) => {
      const idx = PHASES.indexOf(prev);
      return PHASES[Math.min(idx + 1, PHASES.length - 1)];
    });
  }, []);

  const restart = useCallback(() => {
    setPhase('puzzle');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-amber-50 dark:from-pink-950/30 dark:via-rose-950/30 dark:to-amber-950/20">
      <ProgressBar phaseIndex={phaseIndex} onSkip={goNext} />

      <main className="px-4 pt-16 pb-10">
        {phase === 'puzzle' && <PuzzlePhase onComplete={goNext} />}
        {phase === 'memory' && <MemoryPhase onComplete={goNext} />}
        {phase === 'final' && <FinalCard onRestart={restart} />}
      </main>
    </div>
  );
}

function ProgressBar({ phaseIndex, onSkip }: { phaseIndex: number; onSkip: () => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-30 backdrop-blur bg-background/60 border-b border-border/40">
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-3">
        <div className="flex-1 flex items-center gap-1">
          {PHASES.map((p, i) => (
            <div
              key={p}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < phaseIndex && 'bg-pink-500',
                i === phaseIndex && 'bg-pink-400 animate-pulse',
                i > phaseIndex && 'bg-border'
              )}
              title={PHASE_LABELS[p]}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-[10px] uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          aria-label="Sari peste"
        >
          skip ›
        </button>
      </div>
    </div>
  );
}

function FinalCard({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="max-w-md mx-auto mt-10">
      <Card className="border-pink-200 dark:border-pink-900/40 shadow-xl">
        <CardContent className="p-8 text-center space-y-5">
          <div className="text-6xl mx-auto">💝</div>
          <h1 className="text-3xl font-bold tracking-tight">Lăf iu</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Gata cu surpriza de astăzi în care celebrăm 1 an de la <s>logodna</s> cununia civilă. O zi plăcută în Visby să ai!
          </p>
          <div className="flex items-center justify-center gap-2 text-pink-600 dark:text-pink-400">
            <Heart className="h-5 w-5 fill-current" />
            <Sparkles className="h-5 w-5" />
            <Heart className="h-5 w-5 fill-current" />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRestart}
            className="text-xs text-muted-foreground/70"
          >
            Joacă-te din nou
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
