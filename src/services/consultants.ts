import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { ConsultantsInfo } from './api';

/**
 * Who can be booked and for what (active consultants and service categories), from the server.
 * `active` is true when the business has at least one consultant; then every booking is with one.
 * Until loaded, or if loading fails, nothing is claimed: `active` is false and `error` says why.
 */
export function useConsultants() {
  const [info, setInfo] = useState<ConsultantsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .getConsultants()
      .then(setInfo)
      .catch((err: unknown) => setError(err instanceof Error && err.message ? err.message : 'Could not load the consultants.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    consultants: info?.consultants ?? [],
    categories: info?.categories ?? [],
    active: (info?.consultants.length ?? 0) > 0,
    loading,
    error,
    reload: load,
  };
}
