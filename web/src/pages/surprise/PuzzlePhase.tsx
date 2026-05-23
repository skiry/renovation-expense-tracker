import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Phase 1: 3x3 jigsaw puzzle with real puzzle-piece shapes.
 *
 * Each piece is an absolutely positioned div whose background-image is the full
 * puzzle photo offset so that only its own region shows, and whose `clip-path`
 * is an SVG path describing the puzzle-piece silhouette (tabs/blanks on
 * adjacent edges, flat on outer board edges). Adjacent pieces share
 * complementary edges (one tab + one blank), so they visually interlock when
 * placed next to each other.
 *
 * Interaction: drag a piece onto another to swap them (powered by
 * @dnd-kit/sortable). When every piece sits in its original slot, the full
 * photo fades in with a caption.
 */

// ─── Configuration ──────────────────────────────────────────────────────────

const COLS = 3;
const ROWS = 3;
const TOTAL = COLS * ROWS;

/** Body size of each piece, in CSS pixels. Total piece box = PIECE * (1 + 2*KNOB_RATIO). */
const PIECE = 100;
const KNOB_RATIO = 0.2;
const KNOB = PIECE * KNOB_RATIO;
const BOX = PIECE + KNOB * 2;

const PUZZLE_IMG = '/surprise/puzzle.jpg';
const PUZZLE_CAPTION = 'Felicitări, purkeluso! 💕';

type Edge = 'flat' | 'tab' | 'blank';
type PieceEdges = { top: Edge; right: Edge; bottom: Edge; left: Edge };

// ─── Edge generation ────────────────────────────────────────────────────────

function generateEdges(): PieceEdges[][] {
  const grid: PieceEdges[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      top: 'flat',
      right: 'flat',
      bottom: 'flat',
      left: 'flat',
    }))
  );
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1) {
        const v: Edge = Math.random() < 0.5 ? 'tab' : 'blank';
        grid[r][c].right = v;
        grid[r][c + 1].left = v === 'tab' ? 'blank' : 'tab';
      }
      if (r < ROWS - 1) {
        const v: Edge = Math.random() < 0.5 ? 'tab' : 'blank';
        grid[r][c].bottom = v;
        grid[r + 1][c].top = v === 'tab' ? 'blank' : 'tab';
      }
    }
  }
  return grid;
}

function piecePath(edges: PieceEdges): string {
  const p = PIECE;
  const k = KNOB;
  const o = k;
  const s1 = p * 0.3;
  const s2 = p * 0.7;
  const bump = k;

  let d = `M ${o} ${o}`;
  if (edges.top === 'flat') {
    d += ` L ${o + p} ${o}`;
  } else {
    const dir = edges.top === 'tab' ? -1 : 1;
    d += ` L ${o + s1} ${o}`;
    d += ` C ${o + s1} ${o + dir * bump}, ${o + s2} ${o + dir * bump}, ${o + s2} ${o}`;
    d += ` L ${o + p} ${o}`;
  }
  if (edges.right === 'flat') {
    d += ` L ${o + p} ${o + p}`;
  } else {
    const dir = edges.right === 'tab' ? 1 : -1;
    d += ` L ${o + p} ${o + s1}`;
    d += ` C ${o + p + dir * bump} ${o + s1}, ${o + p + dir * bump} ${o + s2}, ${o + p} ${o + s2}`;
    d += ` L ${o + p} ${o + p}`;
  }
  if (edges.bottom === 'flat') {
    d += ` L ${o} ${o + p}`;
  } else {
    const dir = edges.bottom === 'tab' ? 1 : -1;
    d += ` L ${o + s2} ${o + p}`;
    d += ` C ${o + s2} ${o + p + dir * bump}, ${o + s1} ${o + p + dir * bump}, ${o + s1} ${o + p}`;
    d += ` L ${o} ${o + p}`;
  }
  if (edges.left === 'flat') {
    d += ` L ${o} ${o}`;
  } else {
    const dir = edges.left === 'tab' ? -1 : 1;
    d += ` L ${o} ${o + s2}`;
    d += ` C ${o + dir * bump} ${o + s2}, ${o + dir * bump} ${o + s1}, ${o} ${o + s1}`;
    d += ` L ${o} ${o}`;
  }
  d += ' Z';
  return d;
}

// ─── Shuffle ────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleNotSolved(): number[] {
  const ids = Array.from({ length: TOTAL }, (_, i) => i);
  for (let tries = 0; tries < 20; tries++) {
    const s = shuffle(ids);
    if (s.some((id, i) => id !== i)) return s;
  }
  return ids.slice().reverse();
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PuzzlePhase({ onComplete }: { onComplete: () => void }) {
  const edges = useMemo(() => generateEdges(), []);
  const paths = useMemo(
    () => edges.map((row) => row.map((e) => piecePath(e))),
    [edges]
  );

  /** placement[slotIndex] = pieceId. Solved when placement[i] === i for all i. */
  const [placement, setPlacement] = useState<number[]>(() => shuffleNotSolved());
  const [solved, setSolved] = useState(false);

  const totalSize = PIECE * COLS;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPlacement((cur) => {
      const fromSlot = cur.indexOf(active.id as number);
      const toSlot = cur.indexOf(over.id as number);
      if (fromSlot === -1 || toSlot === -1) return cur;
      const next = cur.slice();
      [next[fromSlot], next[toSlot]] = [next[toSlot], next[fromSlot]];
      return next;
    });
  }

  useEffect(() => {
    if (placement.every((id, i) => id === i) && !solved) {
      setSolved(true);
    }
  }, [placement, solved]);

  return (
    <div className="max-w-md mx-auto space-y-5">
      <header className="text-center space-y-1">
        <h2 className="text-xl font-semibold">Nivel 1 · Puzzle</h2>
        <p className="text-sm text-muted-foreground">
          Trage piesele cu degetul pentru a le schimba între ele. Pune-le în ordinea corectă
          pentru a dezvălui poza.
        </p>
      </header>

      {/* Board */}
      <div
        className="relative mx-auto rounded-xl bg-gradient-to-br from-pink-100/60 to-amber-100/60 dark:from-pink-950/40 dark:to-amber-950/30 shadow-inner overflow-hidden touch-none"
        style={{ width: totalSize, height: totalSize }}
      >
        <img
          src={PUZZLE_IMG}
          alt=""
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 pointer-events-none',
            solved ? 'opacity-100' : 'opacity-0'
          )}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={placement} strategy={rectSortingStrategy} disabled={solved}>
            {placement.map((pieceId, slot) => {
              const slotC = slot % COLS;
              const slotR = Math.floor(slot / COLS);
              const origC = pieceId % COLS;
              const origR = Math.floor(pieceId / COLS);
              const path = paths[origR][origC];
              return (
                <PuzzlePiece
                  key={pieceId}
                  pieceId={pieceId}
                  left={slotC * PIECE - KNOB}
                  top={slotR * PIECE - KNOB}
                  path={path}
                  origC={origC}
                  origR={origR}
                  hidden={solved}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Outline overlay: white stroke around each piece that isn't yet
            in its correct slot. */}
        {!solved && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={totalSize}
            height={totalSize}
            viewBox={`0 0 ${totalSize} ${totalSize}`}
          >
            {placement.map((pieceId, slot) => {
              if (pieceId === slot) return null;
              const slotC = slot % COLS;
              const slotR = Math.floor(slot / COLS);
              const origC = pieceId % COLS;
              const origR = Math.floor(pieceId / COLS);
              const path = paths[origR][origC];
              return (
                <g
                  key={`outline-${pieceId}`}
                  transform={`translate(${slotC * PIECE - KNOB}, ${slotR * PIECE - KNOB})`}
                >
                  <path
                    d={path}
                    fill="none"
                    stroke="white"
                    strokeWidth={1.5}
                    strokeOpacity={0.85}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {solved ? (
        <div className="text-center space-y-4 animate-in fade-in duration-700">
          <p className="text-base font-medium">{PUZZLE_CAPTION}</p>
          <Button type="button" onClick={onComplete} className="w-full">
            Continuă ›
          </Button>
        </div>
      ) : (
        <Card className="bg-muted/40 border-dashed">
          <CardContent className="p-3 text-center text-xs text-muted-foreground">
            Apasă pe o piesă și trage-o peste alta pentru a le schimba locul.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PuzzlePiece({
  pieceId,
  left,
  top,
  path,
  origC,
  origR,
  hidden,
}: {
  pieceId: number;
  left: number;
  top: number;
  path: string;
  origC: number;
  origR: number;
  hidden: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pieceId,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'absolute touch-none [-webkit-tap-highlight-color:transparent] cursor-grab active:cursor-grabbing',
        hidden ? 'opacity-0' : 'opacity-100',
        isDragging ? 'z-30' : 'z-10'
      )}
      style={{
        width: BOX,
        height: BOX,
        left,
        top,
        // Combine the sortable transform (from dnd-kit) with our own scale when
        // dragging. Falling back to the identity when no transform is active.
        transform: CSS.Transform.toString(transform) ?? undefined,
        transition,
        clipPath: `path('${path}')`,
        WebkitClipPath: `path('${path}')`,
        backgroundImage: `url(${PUZZLE_IMG})`,
        backgroundSize: `${COLS * PIECE}px ${ROWS * PIECE}px`,
        backgroundPosition: `${-origC * PIECE + KNOB}px ${-origR * PIECE + KNOB}px`,
        filter: isDragging ? 'drop-shadow(0 6px 12px rgba(236, 72, 153, 0.55))' : undefined,
      }}
    />
  );
}
