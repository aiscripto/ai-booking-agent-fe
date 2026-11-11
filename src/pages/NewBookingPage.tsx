import React, { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, CheckCircle2, AlertCircle, Clock, Phone, Mail, User } from 'lucide-react';
import { api } from '../services/api';
import type { Appointment, AvailableSlots } from '../services/api';
import { useVocabulary } from '../services/vocabulary';
import { formatDateTime, todayKey } from '../services/time';
import { useConsultants } from '../services/consultants';

const errorText = (err: unknown, fallback: string): string => (err instanceof Error && err.message ? err.message : fallback);

/**
 * Book an appointment for a customer (staff use: the whole app is behind the login).
 *
 * The free times come from the server, in the business's time zone. Only what the server records is
 * asked for: time, name, phone and email. The confirmation shows what the server saved.
 */
export const NewBookingPage: React.FC = () => {
  const { vocabulary, timeZone } = useVocabulary();
  // With consultants, a booking is with one of them (or "anyone" free), for a service.
  const consultantInfo = useConsultants();
  const [categoryId, setCategoryId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const offered = consultantInfo.consultants.filter((c) => !categoryId || c.categoryIds.includes(categoryId));

  const [pickedDate, setPickedDate] = useState('');
  const date = pickedDate || todayKey(timeZone);

  const [availability, setAvailability] = useState<AvailableSlots | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState('');
  const [selectedIso, setSelectedIso] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSlotsError('');
    try {
      const result = await api.getAvailableSlots(date, { categoryId: categoryId || undefined, employeeId: employeeId || undefined });
      setAvailability(result);
      // Keep the choice only if that time is still free.
      setSelectedIso((current) => (result.slots.some((s) => s.iso === current) ? current : ''));
    } catch (err: unknown) {
      setAvailability(null);
      setSlotsError(errorText(err, 'Could not load the free times.'));
    } finally {
      setSlotsLoading(false);
    }
  }, [date, categoryId, employeeId]);

  // Wait until we know whether there are consultants, so the first answer already has the right filter.
  const consultantsReady = !consultantInfo.loading;
  useEffect(() => {
    if (consultantsReady) loadSlots();
  }, [loadSlots, consultantsReady]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedIso) {
      setSubmitError('Please choose a time.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setSubmitError('Please enter the name and the phone number.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const saved = await api.createAppointment({
        dateTime: selectedIso,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        employeeId: employeeId || undefined,
        categoryId: categoryId || undefined,
      });
      setConfirmed(saved);
      setSelectedIso('');
      loadSlots(); // the booked time is not free any more
    } catch (err: unknown) {
      setSubmitError(errorText(err, 'The appointment could not be saved.'));
      loadSlots(); // the time may have been taken meanwhile
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setConfirmed(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
  };

  if (confirmed) {
    return (
      <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6 font-sans">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-100">Appointment saved</h1>
          <p className="text-sm text-slate-400">This is what the system recorded.</p>
        </div>
        <dl className="bg-slate-950 border border-slate-800 p-5 rounded-xl text-left space-y-3 text-xs">
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <dt className="text-slate-400">{vocabulary.customerLabel}</dt>
            <dd className="font-bold text-slate-200">{confirmed.customerName}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <dt className="text-slate-400">Phone</dt>
            <dd className="font-mono text-sky-400">{confirmed.customerPhone}</dd>
          </div>
          {confirmed.consultant && (
            <div className="flex justify-between border-b border-slate-800/80 pb-2">
              <dt className="text-slate-400">With</dt>
              <dd className="font-bold text-slate-200">{confirmed.consultant.fullName}</dd>
            </div>
          )}
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <dt className="text-slate-400">Date and time</dt>
            <dd className="font-mono text-sky-400 font-bold">{formatDateTime(confirmed.appointmentDateTime, timeZone)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Status</dt>
            <dd className="font-bold text-emerald-400">{confirmed.status}</dd>
          </div>
        </dl>
        <button
          onClick={startAnother}
          className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition-colors"
        >
          Book another appointment
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
          <CalendarPlus className="w-6 h-6 text-sky-400" aria-hidden="true" /> New {vocabulary.serviceLabel.toLowerCase()}
        </h1>
        <p className="text-sm text-slate-400 mt-1">Choose a date, then one of the free times. Times are shown in {timeZone}.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-8">
        {consultantInfo.error && (
          <div role="alert" className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 text-sm">
            The consultants could not be loaded ({consultantInfo.error}). Times shown may not match a consultant.
          </div>
        )}
        {consultantInfo.active && (
          <section className="space-y-3" aria-labelledby="step-who">
            <h2 id="step-who" className="text-xs font-bold uppercase tracking-wider text-slate-400">Service and consultant</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="booking-category" className="text-xs text-slate-400 font-semibold">Service</label>
                <select
                  id="booking-category"
                  value={categoryId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCategoryId(next);
                    // Keep the chosen consultant only if they offer the new service.
                    const stillOffered = consultantInfo.consultants.find((c) => c.id === employeeId)?.categoryIds.includes(next) ?? false;
                    if (next && !stillOffered) setEmployeeId('');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100"
                >
                  <option value="">Any service</option>
                  {consultantInfo.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="booking-consultant" className="text-xs text-slate-400 font-semibold">Consultant</label>
                <select
                  id="booking-consultant"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100"
                >
                  <option value="">Anyone free</option>
                  {offered.map((c) => <option key={c.id} value={c.id}>{c.fullName}{c.title ? ` (${c.title})` : ''}</option>)}
                </select>
              </div>
            </div>
            {!employeeId && <p className="text-xs text-slate-400">With "Anyone free", the system picks a free consultant when you save.</p>}
          </section>
        )}

        <section className="space-y-3" aria-labelledby="step-date">
          <h2 id="step-date" className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Date</h2>
          <label htmlFor="booking-date" className="sr-only">Date</label>
          <input
            id="booking-date"
            type="date"
            value={date}
            min={todayKey(timeZone)}
            onChange={(e) => setPickedDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-sky-500/50"
          />
        </section>

        <section className="space-y-3" aria-labelledby="step-time">
          <h2 id="step-time" className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-sky-400" aria-hidden="true" /> 2. Free times
          </h2>

          {slotsLoading ? (
            <p role="status" className="text-sm text-slate-400">Loading the free times…</p>
          ) : slotsError ? (
            <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-4 text-sm space-y-2">
              <p>{slotsError}</p>
              <button type="button" onClick={loadSlots} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold">
                Try again
              </button>
            </div>
          ) : availability?.unavailable ? (
            <div role="alert" className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 text-sm space-y-2">
              <p>The calendar cannot be checked right now, so no times can be shown.</p>
              <button type="button" onClick={loadSlots} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold">
                Try again
              </button>
            </div>
          ) : availability && availability.slots.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availability.slots.map((slot) => (
                <button
                  type="button"
                  key={slot.iso}
                  aria-pressed={selectedIso === slot.iso}
                  onClick={() => setSelectedIso(slot.iso)}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    selectedIso === slot.iso
                      ? 'bg-sky-500/10 border-sky-500 text-sky-300 ring-1 ring-sky-500'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {slot.label}
                  {!employeeId && slot.consultants.length > 0 && (
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">{slot.consultants.join(', ')}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{availability?.closed ? 'The business is closed on this date.' : 'There are no free times on this date.'}</p>
          )}
        </section>

        <section className="space-y-4" aria-labelledby="step-details">
          <h2 id="step-details" className="text-xs font-bold uppercase tracking-wider text-slate-400">3. {vocabulary.customerLabel} details</h2>

          {submitError && (
            <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="booking-name" className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" aria-hidden="true" /> Full name
              </label>
              <input
                id="booking-name"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-sky-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="booking-phone" className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" aria-hidden="true" /> Phone number
              </label>
              <input
                id="booking-phone"
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-sky-500/50"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="booking-email" className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" aria-hidden="true" /> Email (optional)
              </label>
              <input
                id="booking-email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-sky-500/50"
              />
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting || !selectedIso}
          className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Save appointment'}
        </button>
      </form>
    </div>
  );
};
