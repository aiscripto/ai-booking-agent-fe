import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import type { TenantVocabularyResponse } from './api';
import { browserTimeZone } from './time';
import type { BusinessHours } from './api';

export interface IndustryVocabulary {
  resourceLabel: string;
  customerLabel: string;
  serviceLabel: string;
  statusInProgress: string;
}

// Neutral words for before the tenant's real words have loaded, or if they cannot be loaded.
// They claim nothing about the business (no "Doctor", no "Patient").
const NEUTRAL_VOCABULARY: IndustryVocabulary = {
  resourceLabel: 'Provider',
  customerLabel: 'Customer',
  serviceLabel: 'Appointment',
  statusInProgress: 'In progress',
};

/**
 * The weekly hours, always. An older server sends only start, end and days: then every open day gets that one range.
 * With nothing sent, there are no hours (nothing is made up).
 */
function withWeekly(hours: BusinessHours | undefined | null): BusinessHours | null {
  if (!hours) return null;
  if (Array.isArray(hours.weekly) && hours.weekly.length === 7) return hours;
  const weekly = Array.from({ length: 7 }, (_, day) => (hours.days?.includes(day) ? [{ start: hours.start, end: hours.end }] : []));
  return { ...hours, weekly };
}

/**
 * The tenant's own words, name and time zone, from the server.
 *
 * Until they have loaded (or if loading fails) `vocabulary` holds neutral words, `tenantName` and
 * `industry` are null, and `timeZone` is the browser's zone. `error` says why loading failed so a
 * screen can tell the user.
 */
export function useVocabulary() {
  const [data, setData] = useState<TenantVocabularyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .getVocabulary()
      .then((response) => setData(response))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load the business settings.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    vocabulary: data?.vocabulary ?? NEUTRAL_VOCABULARY,
    industry: data?.industry ?? null,
    tenantName: data?.tenantName ?? null,
    timeZone: data?.timeZone ?? browserTimeZone(),
    /** When appointments can be offered, from the server. Null until loaded (or if loading failed). */
    businessHours: withWeekly(data?.businessHours),
    /** True once the server's zone is known (before that, `timeZone` is only the browser's zone). */
    zoneKnown: Boolean(data?.timeZone),
    loading,
    error,
    reload: load,
  };
}
