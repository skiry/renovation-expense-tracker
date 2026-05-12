import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Camera, X, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InfoTooltip } from '@/components/ui/popover';

import {
  useAddDetail,
  useAddPhoto,
  useDeleteDetail,
  useDeleteExpense,
  useDeletePhoto,
  useExchangeRate,
  useExpense,
  useUpdateDetail,
  useUpdateExpense,
} from '@/hooks/useExpenses';
import { Currency, ExpenseDetail, PriceMode } from '@/types';
import { detailedTotalRon, displayPriceRon } from '@/utils/calculations';
import { cn, formatCurrency, formatRon } from '@/lib/utils';

const MAX_PHOTOS = 20;

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: expense, isLoading } = useExpense(id);
  const { data: rate } = useExchangeRate();
  const eurToRon = rate?.eurToRon ?? 5;

  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const addDetail = useAddDetail();
  const updateDetail = useUpdateDetail();
  const deleteDetail = useDeleteDetail();
  const addPhoto = useAddPhoto();
  const deletePhoto = useDeletePhoto();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [titleDraft, setTitleDraft] = useState('');
  const [estPriceDraft, setEstPriceDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');

  useEffect(() => {
    if (expense) {
      setTitleDraft(expense.title);
      setEstPriceDraft(String(expense.estimatedPrice));
      setDescDraft(expense.description ?? '');
    }
  }, [expense?.id]);

  if (isLoading) return <p className="text-center text-muted-foreground">Se încarcă…</p>;
  if (!expense) {
    return (
      <div className="text-center space-y-4">
        <p>Cheltuiala nu a fost găsită.</p>
        <Button onClick={() => navigate('/')}>Înapoi</Button>
      </div>
    );
  }

  const isDetailedMode = expense.priceMode === 'detailed';
  const detailedTotal = detailedTotalRon(expense.details, eurToRon);
  const display = displayPriceRon(expense, eurToRon);
  const detailedEmpty = expense.details.length === 0;

  function patch(p: Parameters<typeof updateExpense.mutate>[0]['patch']) {
    updateExpense.mutate({ id: expense!.id, patch: p });
  }

  function commitTitle() {
    const v = titleDraft.trim();
    if (v && v !== expense!.title) patch({ title: v });
    else setTitleDraft(expense!.title);
  }
  function commitEstPrice() {
    const v = parseFloat(estPriceDraft.replace(',', '.'));
    if (!isNaN(v) && v >= 0 && v !== expense!.estimatedPrice) patch({ estimatedPrice: v });
    else setEstPriceDraft(String(expense!.estimatedPrice));
  }
  function commitDesc() {
    const v = descDraft.trim();
    if (v !== (expense!.description ?? '')) patch({ description: v || undefined });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_PHOTOS - expense!.photos.length;
    if (remaining <= 0) {
      toast.error(`Maxim ${MAX_PHOTOS} poze pe element.`);
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    const tid = toast.loading(`Procesez ${list.length} ${list.length === 1 ? 'poză' : 'poze'}…`);
    try {
      for (const file of list) {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.7,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/jpeg',
          initialQuality: 0.8,
        });
        await addPhoto.mutateAsync({ expenseId: expense!.id, file: compressed });
      }
      toast.success('Poze adăugate', { id: tid });
    } catch (err: any) {
      toast.error(err?.message ?? 'Eroare la încărcarea pozelor', { id: tid });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function trySwitchMode(next: PriceMode) {
    if (next === 'detailed' && expense!.details.length === 0) {
      toast.warning('Adaugă întâi sub-cheltuieli pentru a folosi modul detaliat.');
      return;
    }
    patch({ priceMode: next });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Înapoi
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4 mr-1" /> Șterge
        </Button>
      </div>

      {/* Title + status badges */}
      <div className="space-y-3">
        <Input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="text-xl sm:text-2xl font-semibold h-auto py-2 px-3"
          placeholder="Titlu cheltuială"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={expense.isPriority ? 'default' : 'secondary'}>
            {expense.isPriority ? '⭐ Prioritar' : 'Neprioritar'}
          </Badge>
          {expense.isPaid && (
            <Badge variant="success">
              <Check className="h-3 w-3 mr-0.5" /> Achitat
            </Badge>
          )}
          <Badge variant="outline">
            Total: {formatRon(display)}
          </Badge>
        </div>

        {/* Mode switch - sub titlu, doar in detail page */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  Mod calcul preț
                  <InfoTooltip>
                    <p className="font-medium mb-1">Mod calcul preț</p>
                    <p className="mb-1">
                      <span className="font-medium">Estimativ</span> – folosește prima dată, când nu ai încă informații
                      detaliate (ex: „vopsire pereți ~1000 lei").
                    </p>
                    <p>
                      <span className="font-medium">Detaliat</span> – când ai toate prețurile defalcate (vopsea,
                      manoperă, etc.) și totalul devine definitiv pe baza sumei sub-cheltuielilor.
                    </p>
                  </InfoTooltip>
                </div>
                <div className="text-xs text-muted-foreground">
                  {isDetailedMode ? 'Folosește totalul din lista de mai jos' : 'Folosește prețul estimativ'}
                </div>
              </div>
              <div className="flex rounded-lg border bg-muted p-1 text-xs font-medium shrink-0">
                <button
                  type="button"
                  onClick={() => trySwitchMode('estimated')}
                  className={cn(
                    'px-3 py-1.5 rounded-md transition-colors',
                    !isDetailedMode ? 'bg-background shadow' : 'text-muted-foreground'
                  )}
                >
                  Estimativ
                </button>
                <button
                  type="button"
                  onClick={() => trySwitchMode('detailed')}
                  className={cn(
                    'px-3 py-1.5 rounded-md transition-colors',
                    isDetailedMode ? 'bg-background shadow' : 'text-muted-foreground'
                  )}
                >
                  Detaliat
                </button>
              </div>
            </div>
            {isDetailedMode && detailedEmpty && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  Modul detaliat e activ dar lista de sub-cheltuieli e goală. Total = 0. Adaugă sub-cheltuieli sau revino la
                  modul estimativ.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Toggles: priority & paid */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="prio" className="flex items-center gap-1.5">
                Prioritar
                <InfoTooltip>
                  Marchează cheltuielile care <span className="font-medium">nu pot fi amânate</span>. Apar separat pe
                  pagina principală cu propriul total.
                </InfoTooltip>
              </Label>
              <Switch
                id="prio"
                checked={expense.isPriority}
                onCheckedChange={(v) => patch({ isPriority: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="paid" className="flex items-center gap-1.5">
                Achitat integral
                <InfoTooltip>
                  Bifează când <span className="font-medium">s-au făcut toate plățile</span> aferente acestei cheltuieli.
                  Întreaga sumă se va aduna la „Cheltuit" pe pagina principală.
                </InfoTooltip>
              </Label>
              <Switch id="paid" checked={expense.isPaid} onCheckedChange={(v) => patch({ isPaid: v })} />
            </div>
          </CardContent>
        </Card>

        {/* Estimated price */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm">Preț estimativ</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                inputMode="decimal"
                value={estPriceDraft}
                onChange={(e) => setEstPriceDraft(e.target.value)}
                onBlur={commitEstPrice}
                className="col-span-2 tabular-nums"
              />
              <select
                value={expense.estimatedCurrency}
                onChange={(e) => patch({ estimatedCurrency: e.target.value as Currency })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            {expense.estimatedCurrency === 'EUR' && (
              <div className="text-xs text-muted-foreground">
                ≈ {formatRon(expense.estimatedPrice * eurToRon)} (curs {eurToRon} RON/EUR)
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details list */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium flex items-center gap-1.5">
                  Sub-cheltuieli
                  <InfoTooltip>
                    <p className="font-medium mb-1">Sub-cheltuieli</p>
                    <p className="mb-2">
                      Elementele individuale care alcătuiesc cheltuiala totală a acestui element (ex: vopsea,
                      manoperă, transport). Fiecare are nume, preț și monedă proprie.
                    </p>
                    <p>
                      <span className="font-medium">Bifa din stânga</span> marchează sub-cheltuiala ca{' '}
                      <span className="font-medium">achitată</span> — suma sa va fi adăugată la totalul „Cheltuit"
                      de pe pagina principală.
                    </p>
                  </InfoTooltip>
                </div>
                <div className="text-xs text-muted-foreground">
                  Total: <span className="tabular-nums font-medium">{formatRon(detailedTotal)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {expense.details.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3">Nicio sub-cheltuială.</p>
              )}
              {expense.details.map((d) => (
                <DetailRow
                  key={d.id}
                  detail={d}
                  eurToRon={eurToRon}
                  onUpdate={(patch) => updateDetail.mutate({ expenseId: expense.id, detailId: d.id, patch })}
                  onDelete={() => deleteDetail.mutate({ expenseId: expense.id, detailId: d.id })}
                />
              ))}
            </div>
            <AddDetailButton
              onAdd={(detail) => addDetail.mutate({ expenseId: expense.id, detail })}
              loading={addDetail.isPending}
            />
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm" htmlFor="desc">
              Descriere
            </Label>
            <Textarea
              id="desc"
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={commitDesc}
              placeholder="Note, observații, link-uri…"
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Poze</div>
                <div className="text-xs text-muted-foreground">
                  {expense.photos.length} / {MAX_PHOTOS}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={addPhoto.isPending || expense.photos.length >= MAX_PHOTOS}
              >
                <Camera className="h-4 w-4 mr-1" /> Adaugă
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {expense.photos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">Nicio poză adăugată.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {expense.photos.map((p) => (
                  <div key={p.id} className="relative aspect-square rounded-md overflow-hidden bg-muted group">
                    <img
                      src={p.thumbnailUrl ?? p.blobUrl}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => setLightboxUrl(p.blobUrl)}
                    />
                    <button
                      type="button"
                      aria-label="Șterge poza"
                      onClick={() => deletePhoto.mutate({ expenseId: expense.id, photoId: p.id })}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge cheltuiala?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Această acțiune nu poate fi anulată. Vor fi șterse și sub-cheltuielile și pozele asociate.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await deleteExpense.mutateAsync(expense.id);
                toast.success('Cheltuială ștearsă');
                navigate('/');
              }}
            >
              Șterge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain" />
          <button
            type="button"
            className="absolute top-4 right-4 text-white p-2"
            onClick={() => setLightboxUrl(null)}
            aria-label="Închide"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  detail,
  eurToRon,
  onUpdate,
  onDelete,
}: {
  detail: ExpenseDetail;
  eurToRon: number;
  onUpdate: (patch: Partial<ExpenseDetail>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(detail.name);
  const [price, setPrice] = useState(String(detail.price));
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => {
    setName(detail.name);
    setPrice(String(detail.price));
  }, [detail.id, detail.name, detail.price]);

  function commitName() {
    const v = name.trim();
    if (v && v !== detail.name) onUpdate({ name: v });
    else setName(detail.name);
  }
  function commitPrice() {
    const v = parseFloat(price.replace(',', '.'));
    if (!isNaN(v) && v >= 0 && v !== detail.price) onUpdate({ price: v });
    else setPrice(String(detail.price));
  }

  return (
    <>
      <div className="rounded-md border p-2 bg-card flex flex-col sm:flex-row sm:items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          className={cn('h-9 text-sm sm:flex-1 sm:order-2', detail.isPaid && 'line-through text-muted-foreground')}
          placeholder="Nume produs/serviciu"
        />
        <div className="flex items-center gap-2 sm:contents">
          <input
            type="checkbox"
            checked={detail.isPaid}
            onChange={(e) => onUpdate({ isPaid: e.target.checked })}
            className="h-4 w-4 shrink-0 sm:order-1"
            aria-label="Achitat"
          />
          <Input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commitPrice}
            className="flex-1 sm:flex-none sm:w-24 h-9 text-sm tabular-nums sm:order-3"
          />
          <select
            value={detail.currency}
            onChange={(e) => onUpdate({ currency: e.target.value as Currency })}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs sm:order-4"
          >
            <option value="RON">RON</option>
            <option value="EUR">EUR</option>
          </select>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-destructive sm:order-5"
            onClick={() => setConfirmOpen(true)}
            aria-label="Șterge sub-cheltuiala"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {detail.currency === 'EUR' && (
          <div className="text-xs text-muted-foreground tabular-nums pl-6 sm:hidden">
            ≈ {formatCurrency(detail.price * eurToRon, 'RON')}
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge sub-cheltuiala?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            „<span className="font-medium text-foreground">{detail.name || 'Fără nume'}</span>" —{' '}
            {formatCurrency(detail.price, detail.currency)}. Această acțiune nu poate fi anulată.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete();
                setConfirmOpen(false);
              }}
            >
              Șterge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddDetailButton({
  onAdd,
  loading,
}: {
  onAdd: (d: Omit<ExpenseDetail, 'id'>) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('RON');

  function submit() {
    const v = parseFloat(price.replace(',', '.'));
    if (!name.trim() || isNaN(v) || v < 0) {
      toast.error('Date invalide');
      return;
    }
    onAdd({ name: name.trim(), price: v, currency, isPaid: false });
    setOpen(false);
    setName('');
    setPrice('');
    setCurrency('RON');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)} disabled={loading}>
        <Plus className="h-4 w-4 mr-1" /> Adaugă sub-cheltuială
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sub-cheltuială nouă</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="dn">Nume</Label>
            <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="dp">Preț</Label>
              <Input id="dp" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dc">Monedă</Label>
              <select
                id="dc"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Anulează
          </Button>
          <Button onClick={submit}>Adaugă</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
