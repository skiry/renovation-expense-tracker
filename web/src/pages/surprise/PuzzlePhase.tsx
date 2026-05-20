import { useCallback, useEffect, useMemo, useState } from 'react';
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
 * Interaction: tap a piece to select it, tap another piece to swap their
 * positions. When every piece sits in its original slot, the puzzle is solved
 * and the full photo fades in with a caption.
 */

// ─── Configuration ──────────────────────────────────────────────────────────

const COLS = 3;
const ROWS = 3;
const TOTAL = COLS * ROWS;

/** Body size of each piece, in CSS pixels. Total piece box = PIECE * (1 + 2*KNOB_RATIO). */
const PIECE = 100;
const KNOB_RATIO = 0.2;
const KNOB = PIECE * KNOB_RATIO;
const BOX = PIECE + KNOB * 2; // full bounding box of one piece (including tabs)

/** Placeholder photo (square crop). User will replace with real one later. */
const PUZZLE_IMG = 'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=600&h=600&fit=crop&auto=format';
const PUZZLE_CAPTION = 'Prima noastră poză împreună ✨';

type Edge = 'flat' | 'tab' | 'blank';
type PieceEdges = { top: Edge; right: Edge; bottom: Edge; left: Edge };

// ─── Edge generation ────────────────────────────────────────────────────────

/**
 * Build a 3x3 grid of {top,right,bottom,left} edge specs. Outer edges are
 * 'flat'. Each interior shared edge is randomly 'tab' on one side and 'blank'
 * on the other.
 */
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

// ─── Puzzle-piece SVG path ──────────────────────────────────────────────────

/**
 * Build the SVG path describing the silhouette of one piece, expressed in the
 * piece-box coordinate system (origin top-left, size BOX x BOX). The piece
 * body sits at (KNOB, KNOB) to (KNOB+PIECE, KNOB+PIECE); tabs bump outward
 * into the surrounding KNOB-wide margin.
 */
function piecePath(edges: PieceEdges): string {
  // shorthand
  const p = PIECE;
  const k = KNOB;
  const o = k; // origin offset
  // tab/blank knob "control points": the knob occupies the middle 40% of an
  // edge (from 30% to 70%), then bumps out by ~k.
  const s1 = p * 0.3;
  const s2 = p * 0.7;
  const bump = k; // depth of the knob

  let d = `M ${o} ${o}`;

  // Top edge: o,o -> o+p, o
  if (edges.top === 'flat') {
    d += ` L ${o + p} ${o}`;
  } else {
    const dir = edges.top === 'tab' ? -1 : 1; // tab goes up (negative y), blank goes down
    d += ` L ${o + s1} ${o}`;
    d += ` C ${o + s1} ${o + dir * bump}, ${o + s2} ${o + dir * bump}, ${o + s2} ${o}`;
    d += ` L ${o + p} ${o}`;
  }
  // Right edge: o+p,o -> o+p, o+p
  if (edges.right === 'flat') {
    d += ` L ${o + p} ${o + p}`;
  } else {
    const dir = edges.right === 'tab' ? 1 : -1;
    d += ` L ${o + p} ${o + s1}`;
    d += ` C ${o + p + dir * bump} ${o + s1}, ${o + p + dir * bump} ${o + s2}, ${o + p} ${o + s2}`;
    d += ` L ${o + p} ${o + p}`;
  }
  // Bottom edge: o+p, o+p -> o, o+p
  if (edges.bottom === 'flat') {
    d += ` L ${o} ${o + p}`;
  } else {
    const dir = edges.bottom === 'tab' ? 1 : -1;
    d += ` L ${o + s2} ${o + p}`;
    d += ` C ${o + s2} ${o + p + dir * bump}, ${o + s1} ${o + p + dir * bump}, ${o + s1} ${o + p}`;
    d += ` L ${o} ${o + p}`;
  }
  // Left edge: o, o+p -> o, o
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

/** Ensure the initial shuffle isn't accidentally solved. */
function shuffleNotSolved(): number[] {
  const ids = Array.from({ length: TOTAL }, (_, i) => i);
  for (let tries = 0; tries < 20; tries++) {
    const s = shuffle(ids);
    if (s.some((id, i) => id !== i)) return s;
  }
  // Fallback: swap first two.
  return ids.slice().reverse();
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PuzzlePhase({ onComplete }: { onComplete: () => void }) {
  const edges = useMemo(() => generateEdges(), []);
  const paths = useMemo(
    () => edges.map((row) => row.map((e) => piecePath(e))),
    [edges]
  );

  // placement[slotIndex] = pieceId (original position). solved when placement[i] === i.
  const [placement, setPlacement] = useState<number[]>(() => shuffleNotSolved());
  const [selected, setSelected] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);

  const totalSize = PIECE * COLS;

  const onTapSlot = useCallback(
    (slot: number) => {
      if (solved) return;
      setSelected((prev) => {
        if (prev === null) return slot;
        if (prev === slot) return null;
        // swap
        setPlacement((arr) => {
          const next = arr.slice();
          [next[prev], next[slot]] = [next[slot], next[prev]];
          return next;
        });
        return null;
      });
    },
    [solved]
  );

  useEffect(() => {
    if (placement.every((id, i) => id === i) && !solved) {
      setSolved(true);
      setSelected(null);
    }
  }, [placement, solved]);

  return (
    <div className="max-w-md mx-auto space-y-5">
      <header className="text-center space-y-1">
        <h2 className="text-xl font-semibold">Nivel 1 · Puzzle</h2>
        <p className="text-sm text-muted-foreground">
          Atinge două piese pentru a le schimba între ele. Pune-le în ordinea corectă pentru a
          dezvălui poza.
        </p>
      </header>

      {/* Board */}
      <div
        className="relative mx-auto rounded-xl bg-gradient-to-br from-pink-100/60 to-amber-100/60 dark:from-pink-950/40 dark:to-amber-950/30 shadow-inner overflow-hidden"
        style={{ width: totalSize, height: totalSize }}
      >
        {/* Solved overlay: the full image fades in on top of the puzzle */}
        <img
          src={PUZZLE_IMG}
          alt=""
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 pointer-events-none',
            solved ? 'opacity-100' : 'opacity-0'
          )}
        />

        {/* Slot cells with tap targets (drawn under the pieces) */}
        {Array.from({ length: TOTAL }).map((_, slot) => {
          const c = slot % COLS;
          const r = Math.floor(slot / COLS);
          return (
            <button
              key={`slot-${slot}`}
              type="button"
              onClick={() => onTapSlot(slot)}
              aria-label={`Slot ${slot + 1}`}
              className={cn(
                'absolute border border-dashed transition-colors',
                solved ? 'border-transparent' : 'border-border/30',
                selected === slot && !solved && 'border-pink-500 bg-pink-500/10'
              )}
              style={{
                left: c * PIECE,
                top: r * PIECE,
                width: PIECE,
                height: PIECE,
              }}
            />
          );
        })}

        {/* Pieces (one per slot, rendered with the piece currently at that slot) */}
        {placement.map((pieceId, slot) => {
          const slotC = slot % COLS;
          const slotR = Math.floor(slot / COLS);
          const origC = pieceId % COLS;
          const origR = Math.floor(pieceId / COLS);
          const path = paths[origR][origC];
          const isSelected = selected === slot;
          return (
            <div
              key={pieceId}
              onClick={() => onTapSlot(slot)}
              className={cn(
                'absolute transition-all duration-300 ease-out cursor-pointer',
                solved ? 'opacity-0' : 'opacity-100',
                isSelected && 'z-20'
              )}
              style={{
                width: BOX,
                height: BOX,
                // Position the piece so its body sits in the slot. The piece
                // box extends KNOB pixels beyond on every side.
                left: slotC * PIECE - KNOB,
                top: slotR * PIECE - KNOB,
                clipPath: `path('${path}')`,
                WebkitClipPath: `path('${path}')`,
                // Render the full puzzle photo, offset so that this piece's
                // own region shows under its silhouette.
                backgroundImage: `url(${PUZZLE_IMG})`,
                backgroundSize: `${COLS * PIECE}px ${ROWS * PIECE}px`,
                backgroundPosition: `${-origC * PIECE + KNOB}px ${-origR * PIECE + KNOB}px`,
                filter: isSelected ? 'drop-shadow(0 0 8px rgb(236 72 153))' : undefined,
                transform: isSelected ? 'scale(1.03)' : 'scale(1)',
              }}
            />
          );
        })}

        {/*
          Outline overlay: a single SVG drawn on top with one <path> per piece
          that is NOT yet in its correct position. We draw the outline as a
          separate layer (not as a border on the clipped div, since clip-path
          strips borders) so it can fade as pieces snap into place.
        */}
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
              // The path is in piece-box coords (BOX x BOX, with body at +KNOB).
              // Translate so the body lands at (slotC*PIECE, slotR*PIECE).
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
                    style={{ transition: 'stroke-opacity 300ms' }}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Caption + continue */}
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
            Atinge o piesă pentru a o selecta, apoi atinge alta pentru a le schimba locul.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
