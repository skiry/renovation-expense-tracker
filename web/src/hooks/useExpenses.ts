import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ConflictError, IS_MOCK } from '@/services/api';
import { Expense, ExpenseDetail } from '@/types';
import { useAuthStore } from '@/store/auth';

export const QK = {
  expenses: (code: string) => ['expenses', code] as const,
  expense: (code: string, id: string) => ['expense', code, id] as const,
  rate: ['rate'] as const,
};

// In real (non-mock) mode, refetch every 20s when window is focused.
const POLL_INTERVAL = IS_MOCK ? false : 20_000;

export function useExpenses() {
  const accessCode = useAuthStore((s) => s.accessCode);
  return useQuery({
    queryKey: QK.expenses(accessCode ?? ''),
    queryFn: () => api.listExpenses(accessCode!),
    enabled: !!accessCode,
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false,
  });
}

export function useExpense(id: string | undefined) {
  const accessCode = useAuthStore((s) => s.accessCode);
  return useQuery({
    queryKey: QK.expense(accessCode ?? '', id ?? ''),
    queryFn: () => api.getExpense(accessCode!, id!),
    enabled: !!accessCode && !!id,
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false,
  });
}

export function useExchangeRate() {
  return useQuery({
    queryKey: QK.rate,
    queryFn: () => api.getExchangeRate(),
    staleTime: 1000 * 60 * 60,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  const accessCode = useAuthStore((s) => s.accessCode);
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: QK.expenses(accessCode ?? '') });
    if (id) qc.invalidateQueries({ queryKey: QK.expense(accessCode ?? '', id) });
  };
}

function handleConflict(err: unknown, invalidate: () => void): void {
  if (err instanceof ConflictError) {
    toast.warning('Cheltuiala a fost modificată de altcineva. Reîncarc datele…');
    invalidate();
  }
}

export function useCreateExpense() {
  const accessCode = useAuthStore((s) => s.accessCode);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: Partial<Expense>) => api.createExpense(accessCode!, data),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateExpense() {
  const accessCode = useAuthStore((s) => s.accessCode);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Expense> }) => api.updateExpense(accessCode!, id, patch),
    onSuccess: (_data, { id }) => invalidate(id),
    onError: (err, { id }) => handleConflict(err, () => invalidate(id)),
  });
}

export function useDeleteExpense() {
  const accessCode = useAuthStore((s) => s.accessCode);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.deleteExpense(accessCode!, id),
    onSuccess: () => invalidate(),
  });
}

export function useReorderExpenses() {
  const accessCode = useAuthStore((s) => s.accessCode);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (ordered: { id: string; order: number }[]) => api.reorderExpenses(accessCode!, ordered),
    onSuccess: () => invalidate(),
  });
}

export function useAddDetail() {
  const accessCode = useAuthStore((s) => s.accessCode);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ expenseId, detail }: { expenseId: string; detail: Omit<ExpenseDetail, 'id'> }) =>
      api.addDetail(accessCode!, expenseId, detail),
    onSuccess: (_data, { expenseId }) => invalidate(expenseId),
    onError: (err, { expenseId }) => handleConflict(err, () => invalidate(expenseId)),
  });
}

export function useUpdateDetail() {
  const accessCode = useAuthStore((s) => s.accessCode);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      expenseId,
      detailId,
      patch,
    }: {
      expenseId: string;
      detailId: string;
      patch: Partial<ExpenseDetail>;
    }) => api.updateDetail(accessCode!, expenseId, detailId, patch),
    onSuccess: (_data, { expenseId }) => invalidate(expenseId),
    onError: (err, { expenseId }) => handleConflict(err, () => invalidate(expenseId)),
  });
}

export function useDeleteDetail() {
  const accessCode = useAuthStore((s) => s.accessCode);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ expenseId, detailId }: { expenseId: string; detailId: string }) =>
      api.deleteDetail(accessCode!, expenseId, detailId),
    onSuccess: (_data, { expenseId }) => invalidate(expenseId),
    onError: (err, { expenseId }) => handleConflict(err, () => invalidate(expenseId)),
  });
}

export function useAddPhoto() {
  const accessCode = useAuthStore((s) => s.accessCode);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ expenseId, file }: { expenseId: string; file: File }) => api.addPhoto(accessCode!, expenseId, file),
    onSuccess: (_data, { expenseId }) => invalidate(expenseId),
  });
}

export function useDeletePhoto() {
  const accessCode = useAuthStore((s) => s.accessCode);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ expenseId, photoId }: { expenseId: string; photoId: string }) =>
      api.deletePhoto(accessCode!, expenseId, photoId),
    onSuccess: (_data, { expenseId }) => invalidate(expenseId),
  });
}

export function useRefreshExchangeRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.refreshExchangeRate(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.rate }),
  });
}
