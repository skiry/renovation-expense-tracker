import { useCallback, useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Phase 2: 4x4 memory game with 8 pairs of photos.
 *
 * Layout: 16 face-down cards (4 cols × 4 rows). Each click flips a card.
 *   - 0 or 1 card up: clicking flips that card up.
 *   - 2 cards up matching: they stay revealed.
 *   - 2 cards up not matching: after a short delay they flip back.
 *
 * When all 8 pairs are matched, a success message + Continuă button appear.
 */

const COLS = 4;
const ROWS = 4;
const TOTAL = COLS * ROWS; // 16
const PAIRS = TOTAL / 2; // 8

/**
 * 8 placeholder photos (square crops). User will replace with real ones later.
 * Each photo appears exactly twice in the shuffled deck.
 */
const MEMORY_PHOTOS: string[] = [
  '/surprise/memory1.jpg',
  '/surprise/memory2.jpg',
  '/surprise/memory3.jpg',
  '/surprise/memory4.jpg',
  '/surprise/memory5.jpg',
  '/surprise/memory6.jpg',
  '/surprise/memory7.jpg',
  '/surprise/memory8.jpg',
];

type Card = {
  id: number; // stable per-card id
  photoIndex: number; // 0..PAIRS-1, two cards share each index
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Card[] {
  const pairs: Card[] = [];
  for (let p = 0; p < PAIRS; p++) {
    pairs.push({ id: p * 2, photoIndex: p });
    pairs.push({ id: p * 2 + 1, photoIndex: p });
  }
  return shuffle(pairs);
}

export default function MemoryPhase({ onComplete }: { onComplete: () => void }) {
  const [deck] = useState<Card[]>(() => buildDeck());
  const [flipped, setFlipped] = useState<Set<number>>(new Set()); // card ids currently face-up but not yet matched
  const [matched, setMatched] = useState<Set<number>>(new Set()); // card ids permanently matched
  const [busy, setBusy] = useState(false); // true while a non-match pair is waiting to flip back

  const won = matched.size === TOTAL;

  const onTap = useCallback(
    (cardId: number) => {
      if (busy) return;
      if (matched.has(cardId)) return;
      if (flipped.has(cardId)) return;
      setFlipped((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
    },
    [busy, flipped, matched]
  );

  // When exactly two cards are flipped, check for a match.
  useEffect(() => {
    if (flipped.size !== 2) return;
    const [a, b] = Array.from(flipped);
    const cardA = deck.find((c) => c.id === a)!;
    const cardB = deck.find((c) => c.id === b)!;
    if (cardA.photoIndex === cardB.photoIndex) {
      // Match: promote to matched, clear flipped immediately.
      setMatched((prev) => {
        const next = new Set(prev);
        next.add(a);
        next.add(b);
        return next;
      });
      setFlipped(new Set());
    } else {
      // No match: keep both visible briefly, then flip back.
      setBusy(true);
      const t = window.setTimeout(() => {
        setFlipped(new Set());
        setBusy(false);
      }, 900);
      return () => window.clearTimeout(t);
    }
  }, [flipped, deck]);

  // Once won, kick the celebration in.
  useEffect(() => {
    if (!won) return;
    // Optional: do something dramatic later (confetti?). For now just show the
    // success block via render.
  }, [won]);

  return (
    <div className="max-w-md mx-auto space-y-5">
      <header className="text-center space-y-1">
        <h2 className="text-xl font-semibold">Nivel 2 · Memorie</h2>
        <p className="text-sm text-muted-foreground">
          Întoarce două cărți pe rând și găsește cele 8 perechi.
        </p>
      </header>

      <div className="grid grid-cols-4 gap-2 select-none">
        {deck.map((card) => {
          const isMatched = matched.has(card.id);
          const isFlipped = flipped.has(card.id) || isMatched;
          return (
            <MemoryCard
              key={card.id}
              card={card}
              flipped={isFlipped}
              matched={isMatched}
              onTap={() => onTap(card.id)}
            />
          );
        })}
      </div>

      {won ? (
        <div className="text-center space-y-4 animate-in fade-in duration-700">
          <div className="text-3xl">💞</div>
          <p className="text-base font-medium">Purkelusa scumpika și deșteaptă, prafo! 💞</p>
          <Button type="button" onClick={onComplete} className="w-full">
            Continuă ›
          </Button>
        </div>
      ) : (
        <Card className="bg-muted/40 border-dashed">
          <CardContent className="p-3 text-center text-xs text-muted-foreground">
            Atinge o carte pentru a o întoarce. Două cărți la rând.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MemoryCard({
  card,
  flipped,
  matched,
  onTap,
}: {
  card: Card;
  flipped: boolean;
  matched: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={flipped ? `Pereche ${card.photoIndex + 1}` : 'Carte ascunsă'}
      className={cn(
        'relative aspect-square rounded-lg overflow-hidden',
        // Gate hover on hover-capable pointers (avoids iOS sticky hover) and
        // suppress the iOS tap flash.
        '[@media(hover:hover)]:hover:scale-[1.02] transition-transform',
        '[-webkit-tap-highlight-color:transparent]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500',
        matched && 'ring-2 ring-pink-400/70'
      )}
      style={{ perspective: 600 }}
    >
      <div
        className="absolute inset-0 transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Back (hidden) */}
        <div
          className="absolute inset-0 rounded-lg bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <Heart className="h-7 w-7 text-white/90 fill-white/90" />
        </div>
        {/* Front (photo) */}
        <div
          className="absolute inset-0 rounded-lg bg-cover bg-center"
          style={{
            backgroundImage: `url(${MEMORY_PHOTOS[card.photoIndex]})`,
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
          }}
        />
      </div>
    </button>
  );
}
