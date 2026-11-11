import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { api } from '../services/api';
import type { Appointment, AvailableSlots } from '../services/api';
import { useVocabulary } from '../services/vocabulary';
import { useConsultants } from '../services/consultants';
import { can, getSessionUser, isOwnOnly } from '../services/session';
import { formatDateLong, formatDateTime, formatTime, timeKey, todayKey, weekdayOf, zonedTimeToUtc } from '../services/time';
import { emailProblem, phoneProblem } from '../services/geo';
import { Button, Field, FormModal, Modal, TextInput } from '../components/setup/ui';

const errorText = (err: unknown, fallback: string): string => (err instanceof Error && err.message ? err.message : fallback);

/** One tile: a time, for nobody in particular (one calendar) or for one consultant. */
interface Cell {
  time: string; // 'HH:MM' in the business's zone
  consultantId: string | null;
  appointment: Appointment | null;
  free: boolean;
}

type Scope = 'all' | 'none' | string; // 'all' consultants, 'none' = older bookings, or one consultant id

/**
 * The day as tiles: green = free (click to book), red = booked (click for the details and to cancel),
 * grey = not available. Every tile also says so in words, so colour is never the only signal.
 * Everything shown comes from the server: the appointments, and the free times it works out.
 */
export const CalendarView: React.FC = () => {
  const { vocabulary, timeZone, businessHours, error: settingsError } = useVocabulary();
  const consultantInfo = useConsultants();

  const [pickedDate, setPickedDate] = useState('');
  const selectedDate = pickedDate || todayKey(timeZone);

  // A consultant login is limited to its own appointments: the day is always shown for that one consultant.
  const ownOnly = isOwnOnly();
  const ownEmployeeId = getSessionUser()?.employeeId ?? null;
  const canBook = can('appointments.create');
  const [scopeChoice, setScopeChoice] = useState<Scope>('all');
  const scope: Scope = ownOnly ? ownEmployeeId ?? 'none' : consultantInfo.active ? scopeChoice : 'all';

  const [filter, setFilter] = useState<'all' | 'free' | 'booked'>('all');
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<AvailableSlots | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const [y, m] = todayKey(Intl.DateTimeFormat().resolvedOptions().timeZone).split('-').map(Number);
    return new Date(y, m - 1, 1);
  });
  useEffect(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    setCurrentMonth(new Date(y, m - 1, 1));
  }, [selectedDate]);

  const [booking, setBooking] = useState<{ time: string; consultantId: string | null } | null>(null);
  const [details, setDetails] = useState<Appointment | null>(null);

  const consultantsReady = !consultantInfo.loading;

  const fetchDay = useCallback(async () => {
    setLoading(true);
    setError('');
    setAvailabilityError('');
    const wantsFree = scope !== 'none'; // older bookings (no consultant) have no free times to offer
    const [appointmentResult, availabilityResult] = await Promise.allSettled([
      api.getAppointments(selectedDate),
      wantsFree
        ? api.getAvailableSlots(selectedDate, scope !== 'all' ? { employeeId: scope } : {})
        : Promise.resolve<AvailableSlots>({ closed: false, unavailable: false, message: '', slots: [] }),
    ]);
    if (appointmentResult.status === 'fulfilled') {
      setAllAppointments(appointmentResult.value);
    } else {
      setAllAppointments([]);
      setError(errorText(appointmentResult.reason, 'Failed to retrieve appointments.'));
    }
    if (availabilityResult.status === 'fulfilled') {
      setAvailability(availabilityResult.value);
    } else {
      setAvailability(null);
      setAvailabilityError(errorText(availabilityResult.reason, 'Could not check which times are free.'));
    }
    setLoading(false);
  }, [selectedDate, scope]);

  useEffect(() => {
    if (consultantsReady) fetchDay();
  }, [fetchDay, consultantsReady]);

  const canCheckFreeTimes = availability !== null && !availability.unavailable;
  const unassignedCount = consultantInfo.active ? allAppointments.filter((a) => !a.employeeId).length : 0;

  // The rows: 30-minute times across the opening hours of that weekday. A booking outside them is added, never hidden.
  const times = useMemo(() => {
    const list: string[] = [];
    for (const range of businessHours?.weekly[weekdayOf(selectedDate)] ?? []) {
      const [startH, startM] = range.start.split(':').map(Number);
      const [endH, endM] = range.end.split(':').map(Number);
      for (let minutes = startH * 60 + startM; minutes + 30 <= endH * 60 + endM; minutes += 30) {
        const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
        if (!list.includes(label)) list.push(label);
      }
    }
    for (const appt of allAppointments) {
      const label = timeKey(appt.appointmentDateTime, timeZone);
      if (!list.includes(label)) list.push(label);
    }
    return list.sort();
  }, [businessHours, selectedDate, allAppointments, timeZone]);

  // Who is free when: time -> set of consultant ids (empty set for one calendar).
  const freeBy = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const slot of availability?.slots ?? []) {
      map.set(timeKey(slot.iso, timeZone), new Set(slot.consultantIds));
    }
    return map;
  }, [availability, timeZone]);

  const columns = useMemo(() => {
    if (!consultantInfo.active) return [{ id: null as string | null, name: '' }];
    if (scope === 'all') return consultantInfo.consultants.map((c) => ({ id: c.id as string | null, name: c.fullName }));
    if (scope === 'none') return [{ id: null, name: 'Older bookings' }];
    return consultantInfo.consultants.filter((c) => c.id === scope).map((c) => ({ id: c.id as string | null, name: c.fullName }));
  }, [consultantInfo.active, consultantInfo.consultants, scope]);

  const cellFor = (time: string, consultantId: string | null): Cell => {
    const appointment =
      allAppointments.find(
        (a) => timeKey(a.appointmentDateTime, timeZone) === time && (consultantInfo.active ? (a.employeeId ?? null) === consultantId : true),
      ) ?? null;
    const free = !appointment && canCheckFreeTimes && freeBy.has(time) && (consultantId === null || freeBy.get(time)?.has(consultantId) === true);
    return { time, consultantId, appointment, free };
  };

  const stats = useMemo(() => {
    let free = 0;
    let booked = 0;
    for (const column of columns) {
      for (const time of times) {
        const c = cellFor(time, column.id);
        if (c.appointment) booked += 1;
        else if (c.free) free += 1;
      }
    }
    return { free, booked };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, times, allAppointments, freeBy, canCheckFreeTimes]);

  const timeLabel = (time: string) => formatTime(zonedTimeToUtc(selectedDate, time, timeZone).toISOString(), timeZone);

  // ── Mini calendar ──────────────────────────────────────────────────────────
  const daysInMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lead = firstDay === 0 ? 6 : firstDay - 1; // the grid starts on Monday
    const days: Array<Date | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) days.push(new Date(year, month, d));
    return days;
  };
  const selectDay = (day: Date) =>
    setPickedDate(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`);
  const monthLabel = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const consultantName = (id: string | null) => consultantInfo.consultants.find((c) => c.id === id)?.fullName ?? '';

  // ── One tile ───────────────────────────────────────────────────────────────
  const Tile: React.FC<{ cell: Cell; compact?: boolean }> = ({ cell, compact }) => {
    const { appointment, free, time } = cell;
    if (appointment) {
      return (
        <button
          type="button"
          onClick={() => setDetails(appointment)}
          className="w-full text-left rounded-lg border border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25 px-2.5 py-1.5 transition-colors"
          aria-label={`${timeLabel(time)}, booked: ${appointment.customerName}. Open the details.`}
        >
          <span className="flex items-center justify-between gap-2 text-[11px] font-bold text-rose-200">
            <span>{timeLabel(time)}</span>
            <span className="uppercase tracking-wide">Booked</span>
          </span>
          <span className="block truncate text-sm font-semibold text-slate-100">{appointment.customerName}</span>
          {!compact && appointment.category && <span className="block truncate text-[11px] text-rose-200/80">{appointment.category.name}</span>}
        </button>
      );
    }
    if (free && !canBook) {
      return (
        <div className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5">
          <span className="flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-200">
            <span>{timeLabel(time)}</span>
            <span className="uppercase tracking-wide">Free</span>
          </span>
          <span className="block text-sm">&nbsp;</span>
        </div>
      );
    }
    if (free) {
      return (
        <button
          type="button"
          onClick={() => setBooking({ time, consultantId: cell.consultantId })}
          className="w-full text-left rounded-lg border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 transition-colors"
          aria-label={`${timeLabel(time)}, free. Book this time.`}
        >
          <span className="flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-200">
            <span>{timeLabel(time)}</span>
            <span className="uppercase tracking-wide">Free</span>
          </span>
          <span className="block text-sm font-semibold text-emerald-100">Book</span>
        </button>
      );
    }
    return (
      <div
        className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 text-slate-400"
        title={canCheckFreeTimes ? 'Not available: past, outside the working hours, on leave, or blocked.' : 'Free times could not be read.'}
      >
        <span className="flex items-center justify-between gap-2 text-[11px] font-bold">
          <span>{timeLabel(time)}</span>
          <span className="uppercase tracking-wide">{canCheckFreeTimes ? 'Not available' : 'Unknown'}</span>
        </span>
        <span className="block text-sm">&nbsp;</span>
      </div>
    );
  };

  const singleColumn = columns.length === 1;

  return (
    <div className="space-y-4 font-sans">
      {(error || settingsError || consultantInfo.error) && (
        <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl text-sm font-semibold flex items-center justify-between gap-4">
          <span>{error || settingsError || consultantInfo.error}</span>
          <Button kind="secondary" onClick={fetchDay}>Try again</Button>
        </div>
      )}
      {availabilityError && (
        <div role="alert" className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3 rounded-xl text-xs font-semibold">
          {availabilityError} Free times cannot be shown, so booking is turned off for now.
        </div>
      )}
      {availability?.unavailable && (
        <div role="alert" className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3 rounded-xl text-xs font-semibold">
          The calendar cannot be checked right now, so free times cannot be shown and booking is turned off for now.
        </div>
      )}

      {ownOnly && (
        <p className="text-sm text-slate-300 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
          {ownEmployeeId ? 'You see only your own appointments.' : 'Your login is not linked to a consultant, so there is nothing to show. Ask an administrator to link it.'}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[17rem_1fr] gap-5 items-start">
        {/* Left: the date */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-sky-400" aria-hidden="true" /> Date
            </h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setPickedDate(e.target.value)}
              aria-label="Choose a date"
              className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-200"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-300">{monthLabel}</span>
            <span className="flex gap-1">
              <button type="button" aria-label="Previous month" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 text-slate-400 hover:text-slate-100 rounded">
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Next month" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 text-slate-400 hover:text-slate-100 rounded">
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {dayNames.map((name, i) => (
              <span key={i} className="text-[10px] font-bold text-slate-400 uppercase">{name}</span>
            ))}
            {daysInMonth(currentMonth).map((day, index) => {
              if (!day) return <div key={index} className="h-7 w-7" />;
              const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
              const isSelected = key === selectedDate;
              const isToday = key === todayKey(timeZone);
              return (
                <button
                  type="button"
                  key={index}
                  onClick={() => selectDay(day)}
                  aria-label={formatDateLong(key)}
                  aria-current={isSelected ? 'date' : undefined}
                  className={`h-7 w-7 text-[11px] font-semibold rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-sky-500 text-slate-950 font-bold' : isToday ? 'border border-sky-500/50 text-sky-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-300 text-center pt-1 border-t border-slate-800">{formatDateLong(selectedDate)}</p>
        </div>

        {/* Right: the day as tiles */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-base font-bold text-slate-100 mr-auto">
              {formatDateLong(selectedDate)}
              {loading && <span className="ml-3 text-xs font-normal text-sky-300 animate-pulse">Loading…</span>}
            </h2>
            {consultantInfo.active && !ownOnly && (
              <div className="flex items-center gap-2">
                <label htmlFor="calendar-scope" className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Consultant</label>
                <select
                  id="calendar-scope"
                  value={scope}
                  onChange={(e) => setScopeChoice(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100"
                >
                  <option value="all">All consultants</option>
                  {consultantInfo.consultants.map((c) => <option key={c.id} value={c.id}>{c.fullName}{c.title ? ` (${c.title})` : ''}</option>)}
                  {unassignedCount > 0 && <option value="none">Older bookings (no consultant)</option>}
                </select>
              </div>
            )}
            {singleColumn && (
              <div role="tablist" aria-label="Show" className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                {([['all', 'All'], ['free', 'Free'], ['booked', 'Booked']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={filter === id}
                    onClick={() => setFilter(id)}
                    className={`px-3 py-1 rounded-md text-xs font-bold ${filter === id ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Legend and real counts */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-emerald-500/60 bg-emerald-500/20" aria-hidden="true" /> Free: {stats.free}</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-rose-500/60 bg-rose-500/25" aria-hidden="true" /> Booked: {stats.booked}</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-slate-700 bg-slate-950" aria-hidden="true" /> Not available</span>
            {unassignedCount > 0 && scope !== 'none' && (
              <span className="text-amber-300">{unassignedCount} older booking(s) have no consultant. Choose "Older bookings" to see them.</span>
            )}
          </div>

          {times.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-300">
              {availability?.closed || (businessHours && !businessHours.weekly[weekdayOf(selectedDate)]?.length) ? 'The business is closed on this date.' : 'There are no times to show for this date.'}
            </p>
          ) : singleColumn ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-2">
              {times
                .map((time) => cellFor(time, columns[0].id))
                .filter((c) => (filter === 'free' ? c.free : filter === 'booked' ? Boolean(c.appointment) : true))
                .map((c) => <Tile key={c.time} cell={c} />)}
            </div>
          ) : (
            <div className="overflow-auto max-h-[60vh] rounded-lg border border-slate-800">
              <div className="grid gap-1.5 p-2 min-w-max" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(9.5rem, 1fr))` }}>
                {columns.map((column) => (
                  <div key={column.id ?? 'none'} className="sticky top-0 z-10 bg-slate-900 pb-1 text-xs font-bold text-slate-100 truncate">
                    {column.name}
                  </div>
                ))}
                {times.map((time) =>
                  columns.map((column) => <Tile key={`${time}-${column.id}`} cell={cellFor(time, column.id)} compact />),
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {booking && (
        <BookDialog
          label={vocabulary.customerLabel}
          when={`${formatDateLong(selectedDate)}, ${timeLabel(booking.time)}`}
          withWhom={booking.consultantId ? consultantName(booking.consultantId) : ''}
          onClose={() => setBooking(null)}
          onSave={async (input) => {
            await api.createAppointment({
              dateTime: zonedTimeToUtc(selectedDate, booking.time, timeZone).toISOString(),
              ...input,
              employeeId: consultantInfo.active && booking.consultantId ? booking.consultantId : undefined,
            });
            setBooking(null);
            await fetchDay();
          }}
          onFailed={fetchDay}
        />
      )}

      {details && (
        <DetailsDialog
          appointment={details}
          customerLabel={vocabulary.customerLabel}
          timeZone={timeZone}
          onClose={() => setDetails(null)}
          onCancelled={async () => {
            setDetails(null);
            await fetchDay();
          }}
        />
      )}
    </div>
  );
};

/** The form to book a free tile. Validated while typing; Save stays visible. */
const BookDialog: React.FC<{
  label: string;
  when: string;
  withWhom: string;
  onClose: () => void;
  onSave: (input: { customerName: string; customerPhone: string; customerEmail: string | null }) => Promise<void>;
  onFailed: () => void;
}> = ({ label, when, withWhom, onClose, onSave, onFailed }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const nameProblem = name.trim() === '' ? `The ${label.toLowerCase()} name is required.` : '';
  const phoneIssue = phone.trim() === '' ? 'The phone number is required.' : phoneProblem(phone);
  const emailIssue = emailProblem(email);
  const firstProblem = nameProblem || phoneIssue || emailIssue;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (firstProblem) return;
    setSaving(true);
    setError('');
    try {
      await onSave({ customerName: name.trim(), customerPhone: phone.trim(), customerEmail: email.trim() || null });
    } catch (err: unknown) {
      setError(errorText(err, 'Failed to book the appointment.'));
      setSaving(false);
      onFailed(); // the time may have been taken meanwhile
    }
  };

  return (
    <FormModal title="Book this time" onClose={onClose} onSubmit={submit} saving={saving} error={error} size="md" canSave={!firstProblem} blockedReason={firstProblem} saveLabel="Book">
      <p className="text-sm text-slate-300 mb-3">
        {when}
        {withWhom && <span className="text-slate-100 font-semibold"> with {withWhom}</span>}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        <Field label={`${label} name`} error={nameProblem} className="sm:col-span-2">
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" aria-invalid={Boolean(nameProblem)} />}
        </Field>
        <Field label="Phone number" error={phoneIssue}>
          {(id) => <TextInput id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} aria-invalid={Boolean(phoneIssue)} />}
        </Field>
        <Field label="Email (optional)" error={emailIssue}>
          {(id) => <TextInput id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} aria-invalid={Boolean(emailIssue)} />}
        </Field>
      </div>
    </FormModal>
  );
};

/** What the system recorded for a booked tile, with a Cancel that asks before it acts. */
const DetailsDialog: React.FC<{
  appointment: Appointment;
  customerLabel: string;
  timeZone: string;
  onClose: () => void;
  onCancelled: () => Promise<void>;
}> = ({ appointment, customerLabel, timeZone, onClose, onCancelled }) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      await api.cancelAppointment(appointment.id);
      await onCancelled();
    } catch (err: unknown) {
      setError(errorText(err, 'The appointment could not be cancelled.'));
      setBusy(false);
    }
  };

  const rows: Array<[string, string]> = [
    ['Date and time', formatDateTime(appointment.appointmentDateTime, timeZone)],
    [`${customerLabel}`, appointment.customerName],
    ['Phone', appointment.customerPhone],
    ['Email', appointment.customerEmail ?? '—'],
    ['Consultant', appointment.employee?.fullName ?? '—'],
    ['Service', appointment.category?.name ?? '—'],
    ['Booked at', formatDateTime(appointment.createdAt, timeZone)],
    ['Status', appointment.status],
  ];

  return (
    <Modal
      title="Appointment details"
      onClose={onClose}
      size="md"
      footer={
        <div className="space-y-2">
          {error && <p role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
          {confirming ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <p className="mr-auto text-sm text-slate-200">Cancel the appointment for {appointment.customerName}? The time becomes free.</p>
              <Button kind="secondary" onClick={() => setConfirming(false)} disabled={busy}>Keep it</Button>
              <Button kind="danger" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Yes, cancel it'}</Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3">
              <Button kind="danger" onClick={() => setConfirming(true)} className="mr-auto">Cancel appointment</Button>
              <Button kind="secondary" onClick={onClose}>Close</Button>
            </div>
          )}
        </div>
      }
    >
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
            <dd className="text-sm font-semibold text-slate-100 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
};
