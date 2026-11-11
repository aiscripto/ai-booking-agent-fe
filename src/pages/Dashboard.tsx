import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Appointment, CallLog, GoogleSource } from '../services/api';
import { useVocabulary } from '../services/vocabulary';
import { StatusBoard } from '../components/StatusBoard';
import type { BookingItem } from '../components/StatusBoard';
import { CallTranscriptDrawer } from '../components/CallTranscriptDrawer';
import { Calendar, Phone, CheckCircle, AlertCircle, Link, Layers } from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
}

const errorText = (err: unknown, fallback: string): string => (err instanceof Error && err.message ? err.message : fallback);

export const Dashboard: React.FC<DashboardProps> = () => {
  const { vocabulary, industry, timeZone } = useVocabulary();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [googleSource, setGoogleSource] = useState<GoogleSource | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [appts, logs] = await Promise.all([api.getAppointments(), api.getCallLogs()]);
      setAppointments(appts);
      setCallLogs(logs);
    } catch (err: unknown) {
      setError(errorText(err, 'Failed to load the dashboard.'));
    } finally {
      setLoading(false);
    }
    // The calendar status is separate: if it fails, the rest of the page still works.
    api
      .getGoogleStatus()
      .then(setGoogleSource)
      .catch(() => setGoogleSource(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnectCalendar = async () => {
    setGoogleAuthLoading(true);
    setGoogleError('');
    try {
      const authUrl = await api.getGoogleAuthUrl();
      window.open(authUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setGoogleError(errorText(err, 'Could not start the Google connection.'));
    } finally {
      setGoogleAuthLoading(false);
    }
  };

  // Appointments record a customer, a phone number and a time, and (with consultants) who and what for.
  // Older bookings have neither, so none is shown (nothing is made up to fill those columns).
  const mappedBookings: BookingItem[] = appointments.map((a) => ({
    id: a.id,
    customerName: a.customerName,
    customerPhone: a.customerPhone,
    customerEmail: a.customerEmail,
    appointmentDateTime: a.appointmentDateTime,
    status: a.status,
    // Shown only when the booking really records them (consultant mode); empty for older bookings.
    providerName: a.employee?.fullName,
    serviceName: a.category?.name,
  }));

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center min-h-[400px] text-sm text-slate-400">
        Loading the dashboard…
      </div>
    );
  }

  // A failed load is an error, not an empty dashboard with zeros.
  if (error) {
    return (
      <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl p-6 space-y-3">
        <p className="font-semibold">Could not load the dashboard.</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  const calendarState = {
    tenant: { label: 'Connected', detail: "This business's own Google account", ok: true },
    shared: { label: 'Shared account', detail: 'Using the shared Google account from the server settings', ok: true },
    none: { label: 'Not connected', detail: 'No Google account: calendar events are not read or created', ok: false },
  } as const;
  const calendar = googleSource ? calendarState[googleSource] : null;

  return (
    <div className="space-y-8 font-sans">
      {industry && (
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-lg">
              <Layers className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Industry: <span className="text-sky-400">{industry}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Labels used: {vocabulary.resourceLabel} • {vocabulary.customerLabel} • {vocabulary.serviceLabel}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center space-x-5 shadow-lg">
          <div className="bg-sky-500/10 p-4 rounded-xl text-sky-400">
            <Calendar className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Scheduled appointments</p>
            <p className="text-3xl font-extrabold mt-1">{appointments.length}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center space-x-5 shadow-lg">
          <div className="bg-cyan-500/10 p-4 rounded-xl text-cyan-400">
            <Phone className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Latest calls</p>
            <p className="text-3xl font-extrabold mt-1">{callLogs.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Up to the latest 30</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-5">
              <div
                className={`p-4 rounded-xl ${
                  calendar === null
                    ? 'bg-slate-800 text-slate-400'
                    : calendar.ok
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {calendar?.ok ? <CheckCircle className="w-6 h-6" aria-hidden="true" /> : <AlertCircle className="w-6 h-6" aria-hidden="true" />}
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Google Calendar</p>
                <p className="text-sm font-bold mt-1 text-slate-200">{calendar ? calendar.label : 'Status unknown'}</p>
              </div>
            </div>
            {googleSource !== 'tenant' && (
              <button
                onClick={handleConnectCalendar}
                disabled={googleAuthLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-60"
              >
                <Link className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{googleAuthLoading ? 'Opening…' : 'Connect'}</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">{calendar ? calendar.detail : 'The calendar status could not be read.'}</p>
          {googleError && (
            <p role="alert" className="text-xs text-rose-400">
              {googleError}
            </p>
          )}
        </div>
      </div>

      <StatusBoard
        bookings={mappedBookings}
        vocabulary={vocabulary}
        timeZone={timeZone}
        onSelectBooking={(b) => setSelectedBooking(b)}
      />

      <CallTranscriptDrawer
        booking={selectedBooking}
        vocabulary={vocabulary}
        timeZone={timeZone}
        calls={callLogs}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
};
