import { useCallback, useEffect, useState } from 'react';

export interface AsyncList<T> {
  data: T[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}

/** Loads a list once, and again on demand. A failed load is an error, never an empty list. */
export function useAsyncList<T>(fetcher: () => Promise<T[]>): AsyncList<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetcher());
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Could not load the list.');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export const messageOf = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;
