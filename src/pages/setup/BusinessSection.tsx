import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { Business, WeeklyHours } from '../../services/admin-types';
import { coordinateProblems, countries, emailProblem, phoneProblem, statesOf, zipProblem } from '../../services/geo';
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
  country: string;
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
  country: b.country ?? '',
  zip: b.zip ?? '',
  latitude: b.latitude === null ? '' : String(b.latitude),
  longitude: b.longitude === null ? '' : String(b.longitude),
  timeZone: b.timeZone,
  weekly: b.businessHours,
});

const selectClass = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/60';

/**
 * `details`: contact, address and the map (form on the left, map on the right).
 * `hours`: time zone and opening hours. Each part saves the whole business.
 */
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

  const countryList = useMemo(() => countries(), []);

  // What is wrong with the form right now (shown next to each field, while typing).
  const problems = useMemo(() => {
    if (!form) return null;
    const coords = coordinateProblems(form.latitude, form.longitude);
    return {
      name: form.name.trim() === '' ? 'The name is required.' : '',
      phone: phoneProblem(form.phone),
      email: emailProblem(form.email),
      zip: zipProblem(form.country, form.zip),
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
  }, [form]);
  const firstProblem = problems ? Object.values(problems).find(Boolean) ?? '' : '';

  if (loading) return <p role="status" className="py-12 text-center text-sm text-slate-400">Loading…</p>;
  if (loadError || !form || !problems) {
    return (
      <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl p-6 space-y-3">
        <p className="font-semibold">Could not load the business details.</p>
        <p className="text-sm">{loadError}</p>
        <Button kind="secondary" onClick={load}>Try again</Button>
      </div>
    );
  }

  const edit = (patch: Partial<FormState>) => {
    setSaved(false);
    setForm({ ...form, ...patch });
  };
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => edit({ [key]: e.target.value } as Partial<FormState>);

  const hasPoint = form.latitude.trim() !== '' && form.longitude.trim() !== '' && !problems.latitude && !problems.longitude;
  const searchText = [form.address, form.city, form.state, form.zip].filter((p) => p.trim()).join(', ');
  const states = statesOf(form.country);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (firstProblem) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { weekly, latitude, longitude, ...rest } = form;
      const result = await api.admin.saveBusiness({
        ...rest,
        businessHours: weekly,
        latitude: latitude.trim() === '' ? null : Number(latitude),
        longitude: longitude.trim() === '' ? null : Number(longitude),
      });
      setHoursAreDefaults(result.hoursAreDefaults);
      setForm(fromBusiness(result));
      setSaved(true);
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not save the business details.'));
    } finally {
      setSaving(false);
    }
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <Button type="submit" disabled={saving || Boolean(firstProblem)}>{saving ? 'Saving…' : 'Save'}</Button>
      {firstProblem && <span className="text-xs text-amber-300">Fix this before saving: {firstProblem}</span>}
      {error && <span role="alert" className="text-sm text-rose-300">{error}</span>}
      {saved && !error && <span role="status" className="text-sm text-emerald-300">Saved.</span>}
    </div>
  );

  if (part === 'hours') {
    return (
      <Card>
        <form onSubmit={submit} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-5">
          <div className="space-y-4">
            {hoursAreDefaults && <p className="text-xs text-amber-300">These hours come from the server settings. Press Save to keep them as your own.</p>}
            <Field label="Time zone" hint="Opening hours and every time on screen and on the phone use this zone.">
              {(id) => (
                <select id={id} value={form.timeZone} onChange={(e) => edit({ timeZone: e.target.value })} className={selectClass}>
                  {zonesFor(form.timeZone).map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              )}
            </Field>
            <p className="text-xs text-slate-400">Appointments are every 30 minutes inside these hours. A closed day cannot be booked.</p>
            {actions}
          </div>
          <div className="lg:col-span-2">
            <HoursEditor value={form.weekly} onChange={(weekly) => edit({ weekly })} />
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={submit} noValidate className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-5">
        {/* Left: the form, in columns so it fits the screen */}
        <div className="lg:col-span-3 grid grid-cols-2 gap-x-3 gap-y-2.5 content-start">
          <Field label="Name" error={problems.name} className="col-span-2">
            {(id) => <TextInput id={id} value={form.name} onChange={set('name')} maxLength={120} aria-invalid={Boolean(problems.name)} />}
          </Field>
          <Field label="Phone" error={problems.phone}>
            {(id) => <TextInput id={id} type="tel" value={form.phone} onChange={set('phone')} maxLength={40} aria-invalid={Boolean(problems.phone)} />}
          </Field>
          <Field label="Email" error={problems.email}>
            {(id) => <TextInput id={id} type="email" value={form.email} onChange={set('email')} maxLength={254} aria-invalid={Boolean(problems.email)} />}
          </Field>
          <Field label="Address" className="col-span-2">
            {(id) => <TextInput id={id} value={form.address} onChange={set('address')} maxLength={200} />}
          </Field>
          <Field label="Country">
            {(id) => (
              <select id={id} value={form.country} onChange={(e) => edit({ country: e.target.value, state: '' })} className={selectClass}>
                <option value="">— Select country —</option>
                {countryList.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="State" hint={form.country && states.length === 0 ? 'Type the state or region.' : undefined}>
            {(id) =>
              states.length > 0 ? (
                <select id={id} value={form.state} onChange={(e) => edit({ state: e.target.value })} className={selectClass}>
                  <option value="">— Select state —</option>
                  {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              ) : (
                <TextInput id={id} value={form.state} onChange={set('state')} maxLength={80} disabled={!form.country} />
              )
            }
          </Field>
          <Field label="City">{(id) => <TextInput id={id} value={form.city} onChange={set('city')} maxLength={80} />}</Field>
          <Field label="Zip" error={problems.zip}>
            {(id) => <TextInput id={id} value={form.zip} onChange={set('zip')} maxLength={20} aria-invalid={Boolean(problems.zip)} />}
          </Field>
          <Field label="Latitude" hint="-90 to 90" error={problems.latitude}>
            {(id) => <TextInput id={id} inputMode="decimal" value={form.latitude} onChange={set('latitude')} aria-invalid={Boolean(problems.latitude)} />}
          </Field>
          <Field label="Longitude" hint="-180 to 180" error={problems.longitude}>
            {(id) => <TextInput id={id} inputMode="decimal" value={form.longitude} onChange={set('longitude')} aria-invalid={Boolean(problems.longitude)} />}
          </Field>
          <div className="col-span-2">{actions}</div>
        </div>

        {/* Right: the map */}
        <div className="lg:col-span-2 flex flex-col gap-2 min-h-[20rem]">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Location on the map</h3>
          <div className="flex-1 min-h-[18rem]">
            <MapPicker
              latitude={hasPoint ? Number(form.latitude) : null}
              longitude={hasPoint ? Number(form.longitude) : null}
              onPick={(lat, lng) => edit({ latitude: String(lat), longitude: String(lng) })}
            />
          </div>
          <p className="text-xs text-slate-400">
            Click the map to place the pin, or type the numbers.{' '}
            {searchText && (
              <a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(searchText)}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">
                Look up this address on OpenStreetMap
              </a>
            )}
            {hasPoint && (
              <>
                {' '}
                <button type="button" onClick={() => edit({ latitude: '', longitude: '' })} className="text-slate-300 underline">
                  Remove the pin
                </button>
              </>
            )}
          </p>
        </div>
      </form>
    </Card>
  );
};
