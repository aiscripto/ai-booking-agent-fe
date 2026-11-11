import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Business, WeeklyHours } from '../../services/admin-types';
import { Button, Card, Field, TextInput } from '../../components/setup/ui';
import { messageOf } from '../../components/setup/useAsyncList';
import { MapPicker } from '../../components/setup/MapPicker';
import { HoursEditor } from '../../components/setup/HoursEditor';

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: string;
  longitude: string;
  timeZone: string;
  weekly: WeeklyHours;
}

/** Every time zone this browser knows (falls back to just the saved one on an old browser). */
const zonesFor = (current: string): string[] => {
  const known = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return known.includes(current) ? known : [current, ...known];
};

const fromBusiness = (b: Business): FormState => ({
  name: b.name,
  phone: b.phone ?? '',
  email: b.email ?? '',
  address: b.address ?? '',
  city: b.city ?? '',
  state: b.state ?? '',
  zip: b.zip ?? '',
  latitude: b.latitude === null ? '' : String(b.latitude),
  longitude: b.longitude === null ? '' : String(b.longitude),
  timeZone: b.timeZone,
  weekly: b.businessHours,
});

const toNumber = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** `details`: name, contact, address, map. `hours`: time zone and opening hours. Each part saves the whole business. */
export const BusinessSection: React.FC<{ part: 'details' | 'hours' }> = ({ part }) => {
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [hoursAreDefaults, setHoursAreDefaults] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const business = await api.admin.getBusiness();
      // An older server does not send the opening hours or the time zone. Say so; do not show a broken editor.
      if (!business.timeZone || !Array.isArray(business.businessHours) || business.businessHours.length !== 7) {
        throw new Error('The server did not send the opening hours or the time zone. Please ask your administrator to update the system.');
      }
      setForm(fromBusiness(business));
      setHoursAreDefaults(business.hoursAreDefaults);
    } catch (err: unknown) {
      setLoadError(messageOf(err, 'Could not load the business details.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p role="status" className="py-12 text-center text-sm text-slate-400">Loading…</p>;
  if (loadError || !form) {
    return (
      <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl p-6 space-y-3">
        <p className="font-semibold">Could not load the business details.</p>
        <p className="text-sm">{loadError}</p>
        <Button kind="secondary" onClick={load}>Try again</Button>
      </div>
    );
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setForm({ ...form, [key]: e.target.value });
  };

  const latitude = toNumber(form.latitude);
  const longitude = toNumber(form.longitude);
  const hasPoint = latitude !== null && longitude !== null;
  const searchText = [form.address, form.city, form.state, form.zip].filter((p) => p.trim()).join(', ');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { weekly, ...rest } = form;
      const result = await api.admin.saveBusiness({ ...rest, businessHours: weekly, latitude, longitude });
      setHoursAreDefaults(result.hoursAreDefaults);
      setForm(fromBusiness(result));
      setSaved(true);
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not save the business details.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="p-6 space-y-5">
        {part === 'details' && (
          <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name" className="sm:col-span-2">{(id) => <TextInput id={id} value={form.name} onChange={set('name')} required maxLength={120} />}</Field>
          <Field label="Phone">{(id) => <TextInput id={id} type="tel" value={form.phone} onChange={set('phone')} maxLength={40} />}</Field>
          <Field label="Email">{(id) => <TextInput id={id} type="email" value={form.email} onChange={set('email')} maxLength={254} />}</Field>
          <Field label="Address" className="sm:col-span-2">{(id) => <TextInput id={id} value={form.address} onChange={set('address')} maxLength={200} />}</Field>
          <Field label="City">{(id) => <TextInput id={id} value={form.city} onChange={set('city')} maxLength={80} />}</Field>
          <Field label="State">{(id) => <TextInput id={id} value={form.state} onChange={set('state')} maxLength={80} />}</Field>
          <Field label="Zip">{(id) => <TextInput id={id} value={form.zip} onChange={set('zip')} maxLength={20} />}</Field>
        </div>

        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Location on the map</h3>
          <MapPicker
            latitude={latitude}
            longitude={longitude}
            onPick={(lat, lng) => {
              setSaved(false);
              setForm((f) => (f ? { ...f, latitude: String(lat), longitude: String(lng) } : f));
            }}
          />
          <p className="text-xs text-slate-400">
            Click on the map to place the pin, or type the numbers.{' '}
            {searchText && (
              <a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(searchText)}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">
                Look up this address on OpenStreetMap
              </a>
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Latitude" hint="-90 to 90">{(id) => <TextInput id={id} inputMode="decimal" value={form.latitude} onChange={set('latitude')} />}</Field>
            <Field label="Longitude" hint="-180 to 180">{(id) => <TextInput id={id} inputMode="decimal" value={form.longitude} onChange={set('longitude')} />}</Field>
          </div>
          {hasPoint && (
            <button type="button" onClick={() => { setSaved(false); setForm({ ...form, latitude: '', longitude: '' }); }} className="text-sm text-slate-300 underline">
              Remove the pin
            </button>
          )}
        </div>

          </>
        )}

        {part === 'hours' && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Opening hours</h3>
          {hoursAreDefaults && (
            <p className="text-xs text-amber-300">These hours come from the server settings. Press Save to keep them as your own.</p>
          )}
          <Field label="Time zone" hint="Opening hours and every time on screen and on the phone use this zone.">
            {(id) => (
              <select
                id={id}
                value={form.timeZone}
                onChange={(e) => { setSaved(false); setForm({ ...form, timeZone: e.target.value }); }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                {zonesFor(form.timeZone).map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            )}
          </Field>
          <HoursEditor value={form.weekly} onChange={(weekly) => { setSaved(false); setForm({ ...form, weekly }); }} />
          <p className="text-xs text-slate-400">Appointments are every 30 minutes inside these hours. A closed day cannot be booked.</p>
        </div>

        )}

        {error && <p role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
        {saved && <p role="status" className="text-sm text-emerald-300">Saved.</p>}
        <div>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Card>
  );
};
