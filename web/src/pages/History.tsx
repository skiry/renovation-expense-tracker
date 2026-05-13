import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, FileEdit, Plus, RefreshCw, Trash2, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useHistory } from '@/hooks/useExpenses';
import { HistoryEntry, HistoryAction } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';

const DATE_FORMATTER = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('ro-RO', {
  hour: '2-digit',
  minute: '2-digit',
});

function formatDay(iso: string): string {
  const d = new Date(iso);
  return DATE_FORMATTER.format(d).replace(/^./, (c) => c.toUpperCase());
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Titlu',
  estimatedPrice: 'Preț estimativ',
  estimatedCurrency: 'Monedă',
  description: 'Descriere',
  isPriority: 'Prioritar',
  isPaid: 'Achitat integral',
  priceMode: 'Mod calcul preț',
  name: 'Nume',
  price: 'Preț',
  currency: 'Monedă',
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Da' : 'Nu';
  if (typeof v === 'number') return new Intl.NumberFormat('ro-RO').format(v);
  return String(v);
}

function actionSummary(e: HistoryEntry): string {
  const priceStr =
    e.price !== undefined && e.currency ? ` (${formatCurrency(e.price, e.currency)})` : '';
  switch (e.action) {
    case 'expense.create':
      return `a creat cheltuiala${priceStr}`;
    case 'expense.update': {
      const fields = Object.keys(e.changes ?? {});
      if (fields.length === 0) return 'a modificat cheltuiala';
      return `a modificat ${fields.map((f) => FIELD_LABELS[f] ?? f).join(', ')}`;
    }
    case 'expense.delete':
      return `a șters cheltuiala${priceStr}`;
    case 'detail.create':
      return `a adăugat sub-cheltuiala „${e.detailName ?? ''}"${priceStr}`;
    case 'detail.update': {
      const fields = Object.keys(e.detailChanges ?? {});
      if (fields.length === 0) return `a modificat sub-cheltuiala „${e.detailName ?? ''}"`;
      return `a modificat sub-cheltuiala „${e.detailName ?? ''}" (${fields
        .map((f) => FIELD_LABELS[f] ?? f)
        .join(', ')})`;
    }
    case 'detail.delete':
      return `a șters sub-cheltuiala „${e.detailName ?? ''}"${priceStr}`;
    case 'photo.add':
      return 'a adăugat o poză';
    case 'photo.delete':
      return 'a șters o poză';
    default:
      return e.action;
  }
}

function actionIcon(action: HistoryAction) {
  switch (action) {
    case 'expense.create':
    case 'detail.create':
      return <Plus className="h-3.5 w-3.5" />;
    case 'expense.delete':
    case 'detail.delete':
      return <Trash2 className="h-3.5 w-3.5" />;
    case 'photo.add':
    case 'photo.delete':
      return <ImageIcon className="h-3.5 w-3.5" />;
    default:
      return <FileEdit className="h-3.5 w-3.5" />;
  }
}

function actionColor(action: HistoryAction): string {
  if (action.endsWith('.create') || action === 'photo.add') return 'bg-green-500/15 text-green-700 dark:text-green-400';
  if (action.endsWith('.delete')) return 'bg-red-500/15 text-red-700 dark:text-red-400';
  return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
}

function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

function isImportant(e: HistoryEntry): boolean {
  switch (e.action) {
    case 'expense.create':
    case 'expense.delete':
      return true;
    case 'expense.update': {
      if (!e.changes?.estimatedPrice) return false;
      // Only relevant if the expense is currently in estimated mode
      return e.expensePriceMode === 'estimated';
    }
    case 'detail.update': {
      if (!e.detailChanges?.price) return false;
      // Only relevant if the parent expense is in detailed mode
      return e.expensePriceMode === 'detailed';
    }
    default:
      return false;
  }
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isFetching } = useHistory();
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [filter, setFilter] = useState<'important' | 'detailed'>('important');

  const allEntries = useMemo(() => data?.pages.flatMap((p) => p.entries) ?? [], [data]);
  const entries = useMemo(
    () => (filter === 'important' ? allEntries.filter(isImportant) : allEntries),
    [allEntries, filter]
  );
  const byDay = useMemo(() => {
    const groups = new Map<string, HistoryEntry[]>();
    for (const e of entries) {
      const k = dayKey(e.timestamp);
      const arr = groups.get(k);
      if (arr) arr.push(e);
      else groups.set(k, [e]);
    }
    return Array.from(groups.entries());
  }, [entries]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Înapoi
        </Button>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Reîmprospătează">
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
      </div>

      <h1 className="text-2xl font-bold">Istoric</h1>

      <div className="flex rounded-lg border bg-muted p-1 text-sm font-medium w-fit">
        <button
          type="button"
          onClick={() => setFilter('important')}
          className={cn(
            'px-4 py-1.5 rounded-md transition-colors',
            filter === 'important' ? 'bg-background shadow' : 'text-muted-foreground'
          )}
        >
          Important
        </button>
        <button
          type="button"
          onClick={() => setFilter('detailed')}
          className={cn(
            'px-4 py-1.5 rounded-md transition-colors',
            filter === 'detailed' ? 'bg-background shadow' : 'text-muted-foreground'
          )}
        >
          Detaliat
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center">Se încarcă…</p>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {filter === 'important'
              ? 'Nu există schimbări importante înregistrate. Comută pe „Detaliat" pentru a vedea tot istoricul.'
              : 'Nu există încă schimbări înregistrate.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {byDay.map(([day, dayEntries]) => (
            <section key={day} className="space-y-2">
              <h2 className="text-base font-semibold sticky top-14 bg-background/95 backdrop-blur py-1 z-10">
                {formatDay(day + 'T00:00:00')}
              </h2>
              <div className="space-y-2">
                {dayEntries.map((e) => (
                  <Card key={e.id} className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setSelected(e)}
                      className="w-full text-left p-3 flex items-start gap-3 hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {initial(e.userName)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="font-medium">{e.userName}</span>
                          <span className="text-muted-foreground">{TIME_FORMATTER.format(new Date(e.timestamp))}</span>
                          <Badge variant="outline" className={cn('gap-1', actionColor(e.action))}>
                            {actionIcon(e.action)}
                            <span className="capitalize">{e.action.split('.')[0]}</span>
                          </Badge>
                        </div>
                        <div className="text-sm break-words">
                          <span className="text-muted-foreground">{actionSummary(e)} în </span>
                          <span className="font-medium">{e.expenseTitle}</span>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 -rotate-90" />
                    </button>
                  </Card>
                ))}
              </div>
            </section>
          ))}

          {hasNextPage && (
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full"
            >
              {isFetchingNextPage ? 'Se încarcă…' : 'Mai vechi'}
            </Button>
          )}
        </div>
      )}

      <HistoryDetailDialog entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function HistoryDetailDialog({ entry, onClose }: { entry: HistoryEntry | null; onClose: () => void }) {
  return (
    <Dialog open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle>Detalii schimbare</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{entry.userName}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleString('ro-RO')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Cheltuială: </span>
                <span className="font-medium">{entry.expenseTitle}</span>
              </div>

              <div className="rounded-md border p-3 bg-muted/30 space-y-1.5">
                <div className="font-medium">{actionSummary(entry)}</div>

                {entry.changes && Object.keys(entry.changes).length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {Object.entries(entry.changes).map(([field, delta]) => (
                      <li key={field} className="text-xs flex gap-1 flex-wrap">
                        <span className="font-medium">{FIELD_LABELS[field] ?? field}:</span>
                        <span className="text-muted-foreground line-through">{formatValue(delta.from)}</span>
                        <span>→</span>
                        <span>{formatValue(delta.to)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {entry.detailChanges && Object.keys(entry.detailChanges).length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {Object.entries(entry.detailChanges).map(([field, delta]) => (
                      <li key={field} className="text-xs flex gap-1 flex-wrap">
                        <span className="font-medium">{FIELD_LABELS[field] ?? field}:</span>
                        <span className="text-muted-foreground line-through">{formatValue(delta.from)}</span>
                        <span>→</span>
                        <span>{formatValue(delta.to)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
