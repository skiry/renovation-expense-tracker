import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Phase 3: drag-to-order timeline puzzle. 8 photos shuffled, user re-orders
 * them by year (2019, 2020, ..., 2026).
 *
 * TODO (next commit): @dnd-kit sortable list, year labels, win detection.
 */
export default function TimelinePhase({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <h2 className="text-xl font-semibold">Nivel 3 · Cronologie</h2>
          <p className="text-sm text-muted-foreground">
            Pune cele 8 poze în ordine cronologică, din 2019 până în 2026.
          </p>
          <div className="aspect-square rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
            (timeline 2019–2026 — în construcție)
          </div>
          <Button type="button" onClick={onComplete} className="w-full">
            Marchează ca rezolvat (placeholder)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
