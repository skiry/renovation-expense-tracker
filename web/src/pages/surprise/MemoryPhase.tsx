import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Phase 2: 4x4 memory game with 8 pairs of photos.
 *
 * TODO (next commit): flip-card grid, pair matching, win detection.
 */
export default function MemoryPhase({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <h2 className="text-xl font-semibold">Nivel 2 · Memorie</h2>
          <p className="text-sm text-muted-foreground">
            Grilă 4×4 cu 8 perechi de poze. Întoarce două cărți pe rând și găsește toate perechile.
          </p>
          <div className="aspect-square rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
            (memory 4×4 — în construcție)
          </div>
          <Button type="button" onClick={onComplete} className="w-full">
            Marchează ca rezolvat (placeholder)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
