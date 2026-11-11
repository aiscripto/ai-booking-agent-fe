import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { AuditEntry, AuditFilter } from '../../services/admin-types';
import { useVocabulary } from '../../services/vocabulary';
import { formatDateTime } from '../../services/time';
import { messageOf } from '../../components/setup/useAsyncList';
import { Button, Card, ListState, Td, TextInput, Th } from '../../components/setup/ui';

/**
 * The audit log: who did what and when, newest first. Read only: nothing on this screen can change or
 * delete an entry. Everything shown comes from the server.
 */
export const AuditTab: React.FC = () => {
  const { timeZone } = useVocabulary();
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<AuditFilter>({});
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async (filter: AuditFilter) => {
    setLoading(true);
    setError('');
    try {
      const page = await api.admin.listAudit(filter);
      setEntries(page.entries);
      setNextCursor(page.nextCursor);
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not load the audit log.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(applied);
  }, [load, applied]);

  const more = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await api.admin.listAudit({ ...applied, cursor: nextCursor });
      setEntries((list) => [...list, ...page.entries]);
      setNextCursor(page.nextCursor);
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not load more entries.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const dateProblem = from && to && to < from ? 'The end date is before the start date.' : '';

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (dateProblem) return;
    setApplied({ q: q.trim() || undefined, from: from || undefined, to: to || undefined });
  };

  const clear = () => {
    setQ('');
    setFrom('');
    setTo('');
    setApplied({});
  };

  const filtered = Boolean(applied.q || applied.from || applied.to);

  return (
    <Card>
      <form onSubmit={search} className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-800">
        <div className="flex-1 min-w-[14rem]">
          <label htmlFor="audit-q" className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">Search</label>
          <TextInput id="audit-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="User, action or words in the sentence" maxLength={100} />
        </div>
        <div>
          <label htmlFor="audit-from" className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">From</label>
          <TextInput id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={Boolean(dateProblem)} />
        </div>
        <div>
          <label htmlFor="audit-to" className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">To</label>
          <TextInput id="audit-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-invalid={Boolean(dateProblem)} />
        </div>
        <Button type="submit" disabled={Boolean(dateProblem)}>Search</Button>
        {filtered && <Button kind="secondary" onClick={clear}>Clear</Button>}
        {dateProblem && <p role="alert" className="w-full text-xs text-rose-300">{dateProblem}</p>}
      </form>

      <ListState
        loading={loading}
        error={error && entries.length === 0 ? error : ''}
        onRetry={() => load(applied)}
        empty={entries.length === 0}
        emptyText={filtered ? 'No entry matches this search.' : 'Nothing has been recorded yet.'}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What happened</Th>
                <Th>From</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.map((e) => (
                <React.Fragment key={e.id}>
                  <tr>
                    <Td className="whitespace-nowrap">{formatDateTime(e.createdAt, timeZone)}</Td>
                    <Td>
                      <span className="font-semibold">{e.actorName}</span>
                      {e.actorRole && <span className="block text-xs text-slate-400">{e.actorRole}</span>}
                    </Td>
                    <Td>
                      {e.summary}
                      <span className="block font-mono text-[11px] text-slate-400">{e.action}</span>
                    </Td>
                    <Td className="font-mono text-xs">{e.ip ?? '—'}</Td>
                    <Td>
                      {e.details ? (
                        <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id} className="text-sm text-sky-300 hover:text-sky-200 underline">
                          {open === e.id ? 'Hide' : 'Show'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </Td>
                  </tr>
                  {open === e.id && e.details && (
                    <tr>
                      <td colSpan={5} className="px-4 pb-3">
                        <pre className="text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto">{JSON.stringify(e.details, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 p-3 border-t border-slate-800 text-xs text-slate-300">
          <span>{entries.length} entr{entries.length === 1 ? 'y' : 'ies'} shown, newest first. Entries cannot be changed or deleted here.</span>
          {error && <span role="alert" className="text-rose-300">{error}</span>}
          {nextCursor && <Button kind="secondary" onClick={more} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button>}
        </div>
      </ListState>
    </Card>
  );
};
