import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Expense } from '@/types';
import { QK, useReorderExpenses } from './useExpenses';

test('keeps reordering pending until the refreshed expense list reaches the cache', async (t) => {
  const client = new QueryClient();
  // Server rendering uses the auth store's initial state (no access code).
  const queryKey = QK.expenses('');
  client.setQueryData(queryKey, []);

  let finishRead: (items: Expense[]) => void = () => {
    throw new Error('Read promise was not initialized');
  };
  const delayedRead = new Promise<Expense[]>((resolve) => {
    finishRead = resolve;
  });
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: () => delayedRead,
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  t.mock.method(api, 'reorderExpenses', async () => {});

  let reorder: ReturnType<typeof useReorderExpenses> | undefined;
  function CaptureReorder() {
    reorder = useReorderExpenses();
    return null;
  }
  renderToString(
    createElement(QueryClientProvider, { client }, createElement(CaptureReorder))
  );
  assert(reorder);

  let settled = false;
  const mutation = reorder.mutateAsync([{ id: 'expense', order: 1 }]).then(() => {
    settled = true;
  });
  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(client.getQueryState(queryKey)?.fetchStatus, 'fetching');
    assert.equal(settled, false, 'Reordering must not settle while the refresh is pending');
    assert.equal(client.getMutationCache().getAll()[0].state.status, 'pending');

    finishRead([]);
    await mutation;
    assert.equal(settled, true);
    assert.equal(client.getQueryState(queryKey)?.fetchStatus, 'idle');
  } finally {
    finishRead([]);
    await mutation;
    unsubscribe();
    client.clear();
  }
});
