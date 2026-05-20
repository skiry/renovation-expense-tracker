import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Phase 1: 3x3 jigsaw puzzle with real puzzle-piece shapes.
 *
 * TODO (next commit): SVG clipPath per piece with tab/blank edges, swap-by-tap.
 */
export default function PuzzlePhase({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <h2 className="text-xl font-semibold">Nivel 1 · Puzzle</h2>
          <p className="text-sm text-muted-foreground">
            Aici va fi un puzzle 3×3 cu o poză specială. Pune piesele la locul lor pentru a o
            dezvălui.
          </p>
          <div className="aspect-square rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
            (puzzle 3×3 — în construcție)
          </div>
          <Button type="button" onClick={onComplete} className="w-full">
            Marchează ca rezolvat (placeholder)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
