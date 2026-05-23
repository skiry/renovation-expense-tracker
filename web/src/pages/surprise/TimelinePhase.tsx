import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Phase 3: drag-to-order timeline puzzle.
 *
 * 8 photos start in shuffled order. Each list slot is labelled with a year
 * (2019..2026, top to bottom). The user reorders the photos by dragging until
 * each photo sits next to the year it was actually taken.
 *
 * Each photo has a stable id (its "correct" year). Win condition:
 *   order[i] === YEARS[i] for all i
 *
 * (Photos are placeholders; user will swap the URLs and per-year captions
 * once they have the real assets.)
 */

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;

/**
 * Map of year -> placeholder photo URL. The "id" of a draggable item is the
 * year it belongs to, so we can detect a correct placement by comparing
 * the item id with the year label of the slot it currently occupies.
 */
const PHOTOS_BY_YEAR: Record<number, string> = {
  2019: 'https://images.unsplash.com/photo-1502635385003-ee1e6a1a742d?w=300&h=300&fit=crop&auto=format',
  2020: 'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=300&h=300&fit=crop&auto=format',
  2021: 'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=300&h=300&fit=crop&auto=format',
  2022: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&h=300&fit=crop&auto=format',
  2023: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=300&h=300&fit=crop&auto=format',
  2024: 'https://images.unsplash.com/photo-1521334884684-d80222895322?w=300&h=300&fit=crop&auto=format',
  2025: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=300&h=300&fit=crop&auto=format',
  2026: 'https://images.unsplash.com/photo-1492288991661-058aa541ff43?w=300&h=300&fit=crop&auto=format',
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleNotSolved(): number[] {
  for (let tries = 0; tries < 20; tries++) {
    const s = shuffle([...YEARS]);
    if (s.some((y, i) => y !== YEARS[i])) return s;
  }
  return [...YEARS].reverse();
}

export default function TimelinePhase({ onComplete }: { onComplete: () => void }) {
  const [order, setOrder] = useState<number[]>(() => shuffleNotSolved());
  const [won, setWon] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const correctCount = useMemo(
    () => order.reduce((acc, y, i) => acc + (y === YEARS[i] ? 1 : 0), 0),
    [order]
  );

  useEffect(() => {
    if (correctCount === YEARS.length && !won) setWon(true);
  }, [correctCount, won]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((cur) => {
      const oldIndex = cur.indexOf(active.id as number);
      const newIndex = cur.indexOf(over.id as number);
      if (oldIndex === -1 || newIndex === -1) return cur;
      // Swap semantics: only the dragged photo and its drop target swap.
      // Avoids the cascade where already-correct rows get shifted out of
      // place when reordering elsewhere.
      const next = cur.slice();
      [next[oldIndex], next[newIndex]] = [next[newIndex], next[oldIndex]];
      return next;
    });
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      <header className="text-center space-y-1">
        <h2 className="text-xl font-semibold">Nivel 3 · Cronologie</h2>
        <p className="text-sm text-muted-foreground">
          Mută pozele în sus și în jos pentru a le pune în ordine, din 2019 până în 2026.
        </p>
        <p className="text-xs text-muted-foreground">
          {correctCount} / {YEARS.length} potrivite
        </p>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <div className="flex gap-3">
          {/* Fixed year column */}
          <ul className="space-y-2 shrink-0" aria-hidden="true">
            {YEARS.map((y, i) => {
              const correct = order[i] === y;
              return (
                <li
                  key={y}
                  className={cn(
                    'h-16 w-14 rounded-lg border flex items-center justify-center text-sm font-semibold tabular-nums transition-colors',
                    correct
                      ? 'border-pink-400/70 bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400'
                      : 'border-border bg-muted/30 text-muted-foreground'
                  )}
                >
                  {y}
                </li>
              );
            })}
          </ul>

          {/* Sortable photo column */}
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="flex-1 space-y-2 select-none">
              {order.map((year, i) => (
                <TimelineRow key={year} year={year} slotYear={YEARS[i]} disabled={won} />
              ))}
            </ul>
          </SortableContext>
        </div>
      </DndContext>

      {won ? (
        <div className="text-center space-y-4 animate-in fade-in duration-700">
          <div className="text-3xl">🕰️</div>
          <p className="text-base font-medium">
            Nici nu mă așteptam să ai dificultăți în a-ți aduce aminte când a fost făcută fiecare
            poză... 💞
          </p>
          <Button type="button" onClick={onComplete} className="w-full">
            Continuă ›
          </Button>
        </div>
      ) : (
        <Card className="bg-muted/40 border-dashed">
          <CardContent className="p-3 text-center text-xs text-muted-foreground">
            Apasă pe o poză și trage-o până ajunge lângă anul corect.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TimelineRow({
  year,
  slotYear,
  disabled,
}: {
  year: number;
  slotYear: number;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: year,
    disabled,
  });
  const correct = year === slotYear;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-2 h-16',
        'touch-none [-webkit-tap-highlight-color:transparent]',
        correct ? 'border-pink-400/70 ring-1 ring-pink-400/50' : 'border-border',
        isDragging && 'opacity-80 shadow-lg ring-2 ring-pink-500/40'
      )}
    >
      <div
        className="h-12 w-12 shrink-0 rounded-md bg-cover bg-center"
        style={{ backgroundImage: `url(${PHOTOS_BY_YEAR[year]})` }}
      />
      <div className="flex-1 text-xs text-muted-foreground">
        {correct ? (
          <span className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400">
            <Check className="h-3.5 w-3.5" /> potrivit
          </span>
        ) : (
          <span>—</span>
        )}
      </div>
      <button
        type="button"
        aria-label="Mută"
        className="p-2 text-muted-foreground touch-none cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
    </li>
  );
}
