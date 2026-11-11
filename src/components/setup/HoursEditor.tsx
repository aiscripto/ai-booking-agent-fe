import React from 'react';
import type { TimeRange, WeeklyHours } from '../../services/admin-types';

// Editor for weekly opening hours: seven days (shown Monday first), each with zero or more time ranges.
// A day with no range is closed. Times are picked from a list in 30 minute steps, so a wrong time
// cannot be typed; the end of the day can be 24:00 (midnight).

const DAYS: Array<{ index: number; name: string }> = [
  { index: 1, name: 'Monday' },
  { index: 2, name: 'Tuesday' },
  { index: 3, name: 'Wednesday' },
  { index: 4, name: 'Thursday' },
  { index: 5, name: 'Friday' },
  { index: 6, name: 'Saturday' },
  { index: 0, name: 'Sunday' },
];

const MAX_RANGES = 4;

const STARTS: string[] = [];
for (let m = 0; m < 24 * 60; m += 30) STARTS.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
const ENDS = [...STARTS.slice(1), '24:00'];

const PRESETS: Array<{ label: string; range: TimeRange }> = [
  { label: '8 hours (09:00 to 17:00)', range: { start: '09:00', end: '17:00' } },
  { label: '12 hours (08:00 to 20:00)', range: { start: '08:00', end: '20:00' } },
  { label: '24 hours (all day)', range: { start: '00:00', end: '24:00' } },
];

const selectClass = 'bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/60';

interface Props {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
}

export const HoursEditor: React.FC<Props> = ({ value, onChange }) => {
  const setDay = (day: number, ranges: TimeRange[]) => onChange(value.map((r, i) => (i === day ? ranges : r)));

  // A preset sets the same single range on every day that is open now (Monday to Friday if none is).
  const applyPreset = (range: TimeRange) => {
    const anyOpen = value.some((r) => r.length > 0);
    onChange(value.map((r, i) => (anyOpen ? (r.length > 0 ? [{ ...range }] : []) : i >= 1 && i <= 5 ? [{ ...range }] : [])));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-300">Quick set for the open days:</span>
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => applyPreset(p.range)} className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100">
            {p.label}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
        {DAYS.map(({ index, name }) => {
          const ranges = value[index] ?? [];
          const open = ranges.length > 0;
          return (
            <li key={index} className="flex flex-col sm:flex-row sm:items-start gap-3 p-3">
              <label className="flex items-center gap-2 w-40 text-sm font-semibold text-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={open}
                  onChange={(e) => setDay(index, e.target.checked ? [{ start: '09:00', end: '17:00' }] : [])}
                  className="w-4 h-4 accent-sky-500"
                />
                {name}
              </label>

              {!open && <span className="text-sm text-slate-400 py-1.5">Closed</span>}
              <div className="space-y-2">
                {ranges.map((range, n) => (
                  <div key={n} className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`${name} range ${n + 1} opens`}
                      value={range.start}
                      onChange={(e) => setDay(index, ranges.map((r, i) => (i === n ? { ...r, start: e.target.value } : r)))}
                      className={selectClass}
                    >
                      {STARTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-sm text-slate-400">to</span>
                    <select
                      aria-label={`${name} range ${n + 1} closes`}
                      value={range.end}
                      onChange={(e) => setDay(index, ranges.map((r, i) => (i === n ? { ...r, end: e.target.value } : r)))}
                      className={selectClass}
                    >
                      {ENDS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {ranges.length > 1 && (
                      <button type="button" onClick={() => setDay(index, ranges.filter((_, i) => i !== n))} className="text-sm text-rose-400 hover:text-rose-300">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {open && ranges.length < MAX_RANGES && (
                  <button type="button" onClick={() => setDay(index, [...ranges, { start: '13:00', end: '17:00' }])} className="text-sm text-sky-400 hover:text-sky-300">
                    + Add a time range (for a break)
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
