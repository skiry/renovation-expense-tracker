import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, EyeOff, Eye, ChevronRight, Check, Camera, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  useExpenses,
  useReorderExpenses,
  useExchangeRate,
  useCreateExpense,
  useAddPhoto,
} from '@/hooks/useExpenses';
import { displayPriceRon, spentForExpense } from '@/utils/calculations';
import { formatRon, cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui';
import { Expense, Currency } from '@/types';
import { PushPromptBanner } from '@/components/PushPromptBanner';

type Tab = 'priority' | 'non-priority';

export default function DashboardPage() {
  const { data: expenses = [], isLoading } = useExpenses();
  const { data: rate } = useExchangeRate();
  const eurToRon = rate?.eurToRon ?? 5;
  const hidePaid = useUiStore((s) => s.hidePaid);
  const setHidePaid = useUiStore((s) => s.setHidePaid);

  const [tab, setTab] = useState<Tab>('priority');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  // All items for the selected tab (no UI filters applied yet — used for totals)
  const tabExpenses = useMemo(
    () => expenses.filter((e) => e.isPriority === (tab === 'priority')),
    [expenses, tab]
  );

  // Totals are computed on ALL items in the current tab (paid or not, matched or not)
  const tabTotals = useMemo(() => {
    let total = 0;
    let spent = 0;
    let paidCount = 0;
    for (const e of tabExpenses) {
      total += displayPriceRon(e, eurToRon);
      spent += spentForExpense(e, eurToRon);
      if (e.isPaid) paidCount++;
    }
    return { total, spent, count: tabExpenses.length, paidCount };
  }, [tabExpenses, eurToRon]);

  // Visible list = tab filter + hidePaid + search
  const visibleList = useMemo(() => {
    let list = tabExpenses;
    if (hidePaid) list = list.filter((e) => !e.isPaid);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.details.some((d) => d.name.toLowerCase().includes(q))
      );
    }
    return list.slice().sort((a, b) => a.order - b.order);
  }, [tabExpenses, hidePaid, search]);

  return (
    <div className="space-y-4">
      <PushPromptBanner />
      <SummaryCard tab={tab} totals={tabTotals} />

      {/* Sticky tab bar + search */}
      <div className="sticky top-14 z-20 bg-background -mx-4 px-4 pt-2 pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-muted p-1 text-sm font-medium flex-1">
            <button
              type="button"
              onClick={() => setTab('priority')}
              className={cn(
                'flex-1 px-3 py-1.5 rounded-md transition-colors',
                tab === 'priority' ? 'bg-background shadow font-semibold text-primary' : 'text-muted-foreground'
              )}
            >
              Prioritare
            </button>
            <button
              type="button"
              onClick={() => setTab('non-priority')}
              className={cn(
                'flex-1 px-3 py-1.5 rounded-md transition-colors',
                tab === 'non-priority' ? 'bg-background shadow font-semibold' : 'text-muted-foreground'
              )}
            >
              Neprioritare
            </button>
          </div>
          <Button
            variant={searchOpen || search ? 'default' : 'outline'}
            size="icon"
            onClick={() => {
              if (searchOpen) {
                setSearchOpen(false);
                setSearch('');
              } else {
                setSearchOpen(true);
              }
            }}
            aria-label="Caută"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
        {searchOpen && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută în cheltuieli și sub-cheltuieli…"
              className="flex-1"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearch('')}
                aria-label="Șterge căutare"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {tabTotals.paidCount > 0 && (
        <div className="flex items-center justify-between gap-3 px-1">
          <Label htmlFor="hide-paid" className="text-sm flex items-center gap-2 cursor-pointer">
            {hidePaid ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            Ascunde elementele achitate
          </Label>
          <Switch id="hide-paid" checked={hidePaid} onCheckedChange={setHidePaid} />
        </div>
      )}

      <ExpensesList
        items={visibleList}
        eurToRon={eurToRon}
        emptyText={
          search.trim()
            ? `Nicio cheltuială ${tab === 'priority' ? 'prioritară' : 'neprioritară'} pentru „${search.trim()}".`
            : tab === 'priority'
            ? 'Nicio cheltuială prioritară.'
            : 'Nicio cheltuială neprioritară.'
        }
      />

      {isLoading && <p className="text-center text-muted-foreground text-sm">Se încarcă…</p>}

      <AddExpenseFab defaultPriority={tab === 'priority'} />
    </div>
  );
}

function SummaryCard({
  tab,
  totals,
}: {
  tab: Tab;
  totals: { total: number; spent: number; count: number; paidCount: number };
}) {
  const label = tab === 'priority' ? 'Prioritare' : 'Neprioritare';
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat
            label={`Total ${label.toLowerCase()}`}
            sub={`${totals.count} ${totals.count === 1 ? 'element' : 'elemente'}`}
            value={totals.total}
            accent={tab === 'priority' ? 'primary' : undefined}
            bold
          />
          <Stat
            label="Cheltuit"
            sub={`${totals.paidCount} ${totals.paidCount === 1 ? 'achitat' : 'achitate'}`}
            value={totals.spent}
            accent="success"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  sub,
  value,
  accent,
  bold,
}: {
  label: string;
  sub?: string;
  value: number;
  accent?: 'primary' | 'success';
  bold?: boolean;
}) {
  return (
    <div className="space-y-0.5 min-w-0">
      <div className="text-xs text-muted-foreground uppercase tracking-wide truncate">{label}</div>
      <div
        className={cn(
          'text-base sm:text-xl tabular-nums break-words',
          bold ? 'font-bold' : 'font-semibold',
          accent === 'primary' && 'text-primary',
          accent === 'success' && 'text-green-600 dark:text-green-500'
        )}
      >
        {formatRon(value)}
      </div>
      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function ExpensesList({
  items,
  eurToRon,
  emptyText,
}: {
  items: Expense[];
  eurToRon: number;
  emptyText: string;
}) {
  const reorder = useReorderExpenses();
  const [localOrder, setLocalOrder] = useState<Expense[] | null>(null);
  const list = localOrder ?? items;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = list.findIndex((x) => x.id === active.id);
    const newIndex = list.findIndex((x) => x.id === over.id);
    const next = arrayMove(list, oldIndex, newIndex);
    setLocalOrder(next);
    reorder.mutate(
      next.map((e, i) => ({ id: e.id, order: i })),
      { onSettled: () => setLocalOrder(null) }
    );
  }

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">{emptyText}</CardContent>
      </Card>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={list.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {list.map((e) => (
            <SortableExpenseRow key={e.id} expense={e} eurToRon={eurToRon} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableExpenseRow({ expense, eurToRon }: { expense: Expense; eurToRon: number }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: expense.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const display = displayPriceRon(expense, eurToRon);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'overflow-hidden transition-shadow',
        expense.isPaid && 'bg-muted/40',
        isDragging && 'shadow-lg ring-2 ring-primary'
      )}
    >
      <div className="flex items-stretch">
        <button
          {...attributes}
          {...listeners}
          className="flex items-center justify-center px-2 sm:px-3 text-muted-foreground hover:text-foreground touch-none cursor-grab active:cursor-grabbing"
          aria-label="Mută"
          type="button"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => navigate(`/expense/${expense.id}`)}
          className="flex-1 text-left p-3 sm:p-4 flex items-center gap-3 hover:bg-accent/40 transition-colors min-w-0"
        >
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Linia 1: titlu + (opțional) badge "Achitat" — title se înfășoară, nu e truncat */}
            <div className="flex items-start gap-2 flex-wrap">
              <div className={cn('font-medium break-words', expense.isPaid && 'line-through text-muted-foreground')}>
                {expense.title}
              </div>
              {expense.isPaid && (
                <Badge variant="success" className="shrink-0 mt-0.5">
                  <Check className="h-3 w-3 mr-0.5" /> Achitat
                </Badge>
              )}
            </div>
            {/* Linia 2 (mobil) / stanga (desktop): meta. Linia 3 (mobil) / dreapta (desktop): pret. */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="rounded px-1.5 py-0.5 border whitespace-nowrap">
                  {expense.priceMode === 'estimated' ? 'Preț estimativ' : 'Preț detaliat'}
                </span>
                {expense.details.length > 0 && (
                  <span className="whitespace-nowrap">
                    {expense.details.length}{' '}
                    {expense.details.length === 1 ? 'sub-cheltuială' : 'sub-cheltuieli'}
                  </span>
                )}
                {expense.photos.length > 0 && (
                  <span className="whitespace-nowrap">📷 {expense.photos.length}</span>
                )}
              </div>
              <div className="font-semibold tabular-nums whitespace-nowrap">
                {formatRon(display)}
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </button>
      </div>
    </Card>
  );
}

function AddExpenseFab({ defaultPriority = true }: { defaultPriority?: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('RON');
  const [isPriority, setIsPriority] = useState(defaultPriority);
  const [description, setDescription] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const create = useCreateExpense();
  const addPhoto = useAddPhoto();

  const MAX_PHOTOS = 20;

  function reset() {
    setTitle('');
    setPrice('');
    setCurrency('RON');
    setIsPriority(defaultPriority);
    setDescription('');
    setPendingPhotos([]);
  }

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_PHOTOS - pendingPhotos.length;
    if (remaining <= 0) {
      toast.error(`Maxim ${MAX_PHOTOS} poze pe element.`);
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    setPendingPhotos((prev) => [...prev, ...list]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function submit() {
    if (!title.trim()) {
      toast.error('Introdu un titlu');
      return;
    }
    const p = parseFloat(price.replace(',', '.'));
    if (isNaN(p) || p < 0) {
      toast.error('Prețul nu e valid');
      return;
    }
    const created = await create.mutateAsync({
      title: title.trim(),
      estimatedPrice: p,
      estimatedCurrency: currency,
      description: description.trim() || undefined,
      isPriority,
    });

    if (pendingPhotos.length > 0) {
      const tid = toast.loading(`Încarc ${pendingPhotos.length} ${pendingPhotos.length === 1 ? 'poză' : 'poze'}…`);
      try {
        for (const file of pendingPhotos) {
          const compressed = await imageCompression(file, {
            maxSizeMB: 0.7,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            fileType: 'image/jpeg',
            initialQuality: 0.8,
          });
          await addPhoto.mutateAsync({ expenseId: created.id, file: compressed });
        }
        toast.success('Cheltuială adăugată', { id: tid });
      } catch (err: any) {
        toast.error(err?.message ?? 'Cheltuiala s-a creat dar pozele au eșuat', { id: tid });
      }
    } else {
      toast.success('Cheltuială adăugată');
    }

    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          // Opening — align the priority toggle with the current tab
          setIsPriority(defaultPriority);
        } else {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-20"
          aria-label="Adaugă cheltuială"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cheltuială nouă</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t">Titlu</Label>
            <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="p">Preț estimativ</Label>
              <Input id="p" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c">Monedă</Label>
              <select
                id="c"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm"
              >
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="prio">Prioritar</Label>
            <Switch id="prio" checked={isPriority} onCheckedChange={setIsPriority} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Descriere (opțional)</Label>
            <textarea
              id="desc"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Poze (opțional){' '}
                <span className="text-xs text-muted-foreground font-normal">
                  {pendingPhotos.length} / {MAX_PHOTOS}
                </span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={pendingPhotos.length >= MAX_PHOTOS}
              >
                <Camera className="h-4 w-4 mr-1" /> Adaugă
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </div>
            {pendingPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {pendingPhotos.map((f, idx) => (
                  <div key={idx} className="relative aspect-square rounded-md overflow-hidden bg-muted group">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      aria-label="Elimină"
                      onClick={() => setPendingPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-destructive text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pendingPhotos.length > 0 && (
              <p className="text-xs text-muted-foreground">Pozele se vor comprima și încărca după salvare.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending || addPhoto.isPending}>
            Anulează
          </Button>
          <Button onClick={submit} disabled={create.isPending || addPhoto.isPending}>
            {create.isPending || addPhoto.isPending ? 'Se salvează…' : 'Adaugă'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
