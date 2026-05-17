import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ConflictError, IS_MOCK, RateLimitError } from '@/services/api';
import { Expense, ExpenseDetail, WorkspaceUser } from '@/types';
import { useAuthStore } from '@/store/auth';

export const QK = {
  expenses: (code: string) => ['expenses', code] as const,
  expense: (code: string, id: string) => ['expense', code, id] as const,
  rate: ['rate'] as const,
  users: (code: string) => ['users', code] as const,
  history: (code: string) => ['history', code] as const,
};

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

export function useUsers() {
  const accessCode = useAuthStore((s) => s.accessCode);
  return useQuery({
    queryKey: QK.users(accessCode ?? ''),
    queryFn: () => api.listUsers(accessCode!),
    enabled: !!accessCode,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  const accessCode = useAuthStore((s) => s.accessCode);
  return useMutation({
    mutationFn: (name: string) => api.createUser(accessCode!, name),
    onSuccess: (res) => {
      if (res.users) qc.setQueryData(QK.users(accessCode!), res.users);
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  const accessCode = useAuthStore((s) => s.accessCode);
  return useMutation({
    mutationFn: (userId: string) => api.deleteUser(accessCode!, userId),
    onSuccess: (users) => qc.setQueryData(QK.users(accessCode!), users),
  });
}

export function useHistory() {
  const accessCode = useAuthStore((s) => s.accessCode);
  return useInfiniteQuery({
    queryKey: QK.history(accessCode ?? ''),
    queryFn: ({ pageParam }) => api.listHistory(accessCode!, pageParam, 50),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextBefore,
    enabled: !!accessCode,
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  const accessCode = useAuthStore((s) => s.accessCode);
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: QK.expenses(accessCode ?? '') });
    qc.invalidateQueries({ queryKey: QK.history(accessCode ?? '') });
    if (id) qc.invalidateQueries({ queryKey: QK.expense(accessCode ?? '', id) });
  };
}

function handleConflict(err: unknown, invalidate: () => void): void {
  if (err instanceof ConflictError) {
    toast.warning('Cheltuiala a fost modificată de altcineva. Reîncarc datele…');
    invalidate();
    return;
  }
  if (err instanceof RateLimitError) {
    const wait = err.retryAfterSec ? ` Reîncearcă peste ${err.retryAfterSec} secunde.` : '';
    toast.error(`Prea multe încercări.${wait}`);
    return;
  }
  // Surface other errors so they don't fall through silently as unhandled rejections.
  const message = err instanceof Error ? err.message : 'Eroare necunoscută';
  toast.error(message);
}

function useAuthCode() {
  return useAuthStore((s) => s.accessCode);
}
function useAuthUserId() {
  return useAuthStore((s) => s.userId);
}

export function useCreateExpense() {
  const accessCode = useAuthCode();
  const userId = useAuthUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: Partial<Expense>) => api.createExpense(accessCode!, userId!, data),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateExpense() {
  const accessCode = useAuthCode();
  const userId = useAuthUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Expense> }) =>
      api.updateExpense(accessCode!, userId!, id, patch),
    onSuccess: (_data, { id }) => invalidate(id),
    onError: (err, { id }) => handleConflict(err, () => invalidate(id)),
  });
}

export function useDeleteExpense() {
  const accessCode = useAuthCode();
  const userId = useAuthUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.deleteExpense(accessCode!, userId!, id),
    onSuccess: () => invalidate(),
  });
}

export function useReorderExpenses() {
  const accessCode = useAuthCode();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (ordered: { id: string; order: number }[]) => api.reorderExpenses(accessCode!, ordered),
    onSuccess: () => invalidate(),
  });
}

export function useAddDetail() {
  const accessCode = useAuthCode();
  const userId = useAuthUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ expenseId, detail }: { expenseId: string; detail: Omit<ExpenseDetail, 'id'> }) =>
      api.addDetail(accessCode!, userId!, expenseId, detail),
    onSuccess: (_data, { expenseId }) => invalidate(expenseId),
    onError: (err, { expenseId }) => handleConflict(err, () => invalidate(expenseId)),
  });
}

export function useUpdateDetail() {
  const accessCode = useAuthCode();
  const userId = useAuthUserId();
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
    }) => api.updateDetail(accessCode!, userId!, expenseId, detailId, patch),
    onSuccess: (_data, { expenseId }) => invalidate(expenseId),
    onError: (err, { expenseId }) => handleConflict(err, () => invalidate(expenseId)),
  });
}

export function useDeleteDetail() {
  const accessCode = useAuthCode();
  const userId = useAuthUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ expenseId, detailId }: { expenseId: string; detailId: string }) =>
      api.deleteDetail(accessCode!, userId!, expenseId, detailId),
    onSuccess: (_data, { expenseId }) => invalidate(expenseId),
    onError: (err, { expenseId }) => handleConflict(err, () => invalidate(expenseId)),
  });
}

export function useAddPhoto() {
  const accessCode = useAuthCode();
  const userId = useAuthUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ expenseId, file }: { expenseId: string; file: File }) =>
      api.addPhoto(accessCode!, userId!, expenseId, file),
    onSuccess: (_data, { expenseId }) => invalidate(expenseId),
  });
}

export function useDeletePhoto() {
  const accessCode = useAuthCode();
  const userId = useAuthUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ expenseId, photoId }: { expenseId: string; photoId: string }) =>
      api.deletePhoto(accessCode!, userId!, expenseId, photoId),
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

export type { WorkspaceUser };
