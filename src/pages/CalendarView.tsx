import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Appointment, AvailableSlots } from '../services/api';
import { useVocabulary } from '../services/vocabulary';
import { useConsultants } from '../services/consultants';
import { formatDateLong, formatDateTime, timeKey, todayKey, weekdayOf, zonedTimeToUtc } from '../services/time';
import { Plus, Trash2, Calendar as CalendarIcon, User, Phone, Mail, X, ChevronLeft, ChevronRight } from 'lucide-react';

export const CalendarView: React.FC = () => {
  // All times are shown and booked in the business's time zone (times are stored in UTC).
  const { timeZone, businessHours, error: settingsError } = useVocabulary();

  const [pickedDate, setPickedDate] = useState<string>('');
  const selectedDate = pickedDate || todayKey(timeZone);

  // With consultants the day is shown for ONE consultant at a time (their bookings and their free times).
  // "none" shows older bookings that were made before consultants were set up.
  const consultantInfo = useConsultants();
  const [consultantChoice, setConsultantChoice] = useState('');
  const consultantId = consultantInfo.active ? consultantChoice || consultantInfo.consultants[0]?.id || '' : '';
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const appointments = consultantInfo.active
    ? allAppointments.filter((a) => (consultantId === 'none' ? !a.employeeId : a.employeeId === consultantId))
    : allAppointments;
  const unassignedCount = consultantInfo.active ? allAppointments.filter((a) => !a.employeeId).length : 0;
  // Which times can really be booked (appointments plus Google Calendar), from the server.
  const [availability, setAvailability] = useState<AvailableSlots | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mini-Calendar State (the month being shown follows the selected date)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const [y, m] = todayKey(Intl.DateTimeFormat().resolvedOptions().timeZone).split('-').map(Number);
    return new Date(y, m - 1, 1);
  });
  useEffect(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    setCurrentMonth(new Date(y, m - 1, 1));
  }, [selectedDate]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalTime, setModalTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Filter State: 'all' | 'available' | 'booked'
  const [filter, setFilter] = useState<'all' | 'available' | 'booked'>('all');

  // Fetch the day's appointments and the day's free times
  const fetchDay = async () => {
    setLoading(true);
    setError('');
    setAvailabilityError('');
    const [appointmentResult, availabilityResult] = await Promise.allSettled([
      api.getAppointments(selectedDate),
      // Older bookings (no consultant) have no free times to offer.
      consultantId === 'none' ? Promise.resolve<AvailableSlots>({ closed: false, unavailable: false, message: '', slots: [] }) : api.getAvailableSlots(selectedDate, { employeeId: consultantId || undefined }),
    ]);
    if (appointmentResult.status === 'fulfilled') {
      setAllAppointments(appointmentResult.value);
    } else {
      setAllAppointments([]);
      const reason: unknown = appointmentResult.reason;
      setError(reason instanceof Error && reason.message ? reason.message : 'Failed to retrieve appointments.');
    }
    if (availabilityResult.status === 'fulfilled') {
      setAvailability(availabilityResult.value);
    } else {
      setAvailability(null);
      const reason: unknown = availabilityResult.reason;
      setAvailabilityError(reason instanceof Error && reason.message ? reason.message : 'Could not check which times are free.');
    }
    setLoading(false);
  };

  const consultantsReady = !consultantInfo.loading;
  useEffect(() => {
    if (consultantsReady) fetchDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, consultantId, consultantsReady]);

  // Find the appointment that starts at a specific slot time on the selected date
  const getAppointmentForSlot = (slotTime: string) =>
    appointments.find((appt) => timeKey(appt.appointmentDateTime, timeZone) === slotTime);

  // Times the server says can be booked right now.
  const freeTimes = new Set((availability?.slots ?? []).map((s) => timeKey(s.iso, timeZone)));
  const canCheckFreeTimes = availability !== null && !availability.unavailable;

  // 30-minute rows across the business's opening hours for that weekday (from the server).
  // Nothing on a closed day; a break between two ranges leaves a gap.
  const timeSlots: string[] = [];
  for (const range of businessHours?.weekly[weekdayOf(selectedDate)] ?? []) {
    const [startH, startM] = range.start.split(':').map(Number);
    const [endH, endM] = range.end.split(':').map(Number);
    for (let minutes = startH * 60 + startM; minutes + 30 <= endH * 60 + endM; minutes += 30) {
      const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      if (!timeSlots.includes(label)) timeSlots.push(label);
    }
  }

  // Add any booked appointment that falls outside the opening hours, so it is never hidden
  appointments.forEach((appt) => {
    const slotStr = timeKey(appt.appointmentDateTime, timeZone);
    if (!timeSlots.includes(slotStr)) {
      timeSlots.push(slotStr);
    }
  });

  // Sort time slots chronologically
  timeSlots.sort((a, b) => {
    const [aHour, aMin] = a.split(':').map(Number);
    const [bHour, bMin] = b.split(':').map(Number);
    return (aHour * 60 + aMin) - (bHour * 60 + bMin);
  });

  // Filter slots based on state
  const filteredSlots = timeSlots.filter((slot) => {
    const appointment = getAppointmentForSlot(slot);
    if (filter === 'available') {
      return !appointment && freeTimes.has(slot);
    }
    if (filter === 'booked') {
      return !!appointment;
    }
    return true;
  });

  // Helper: Get days list in currentMonth
  const getDaysInMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // Day of week (0 = Sunday)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Align grid so 0 represents Monday, 6 represents Sunday
    const startDayIndex = firstDay === 0 ? 6 : firstDay - 1;

    const days = [];
    // Padding for empty blocks before start of month
    for (let i = 0; i < startDayIndex; i++) {
      days.push(null);
    }
    // Date objects for actual month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const selectDay = (day: Date) => {
    const yyyy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, '0');
    const dd = String(day.getDate()).padStart(2, '0');
    setPickedDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleOpenBookModal = (slotTime: string) => {
    setModalTime(slotTime);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setBookingError('');
    setShowModal(true);
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    setBookingLoading(true);

    try {
      // The clicked time is in the business's zone, so convert it to the right UTC instant.
      const dateTimeIso = zonedTimeToUtc(selectedDate, modalTime, timeZone).toISOString();
      await api.createAppointment({
        dateTime: dateTimeIso,
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        employeeId: consultantInfo.active && consultantId !== 'none' ? consultantId : undefined,
      });

      setShowModal(false);
      fetchDay();
    } catch (err: unknown) {
      setBookingError(err instanceof Error && err.message ? err.message : 'Failed to book appointment.');
      fetchDay(); // the time may have been taken meanwhile
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelAppointment = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to cancel the appointment for ${name}?`)) {
      return;
    }

    try {
      await api.cancelAppointment(id);
      fetchDay();
    } catch (err: unknown) {
      setError(`Cancellation failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  const monthLabel = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="space-y-6 font-sans">
      {/* Errors notifications */}
      {(error || settingsError) && (
        <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm font-semibold flex items-center justify-between gap-4">
          <span>{error || settingsError}</span>
          <button onClick={fetchDay} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold">
            Try again
          </button>
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

      {/* Grid Layout: Mini Calendar Panel (left) + Day Timeline (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Left Column: Interactive Date Picker Card */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <CalendarIcon className="w-4 h-4 text-sky-400" />
              <span>DatePicker</span>
              {loading && <span className="text-xs text-sky-400 font-normal animate-pulse">Loading...</span>}
            </h3>

            {/* Native input element fallback */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setPickedDate(e.target.value)}
              aria-label="Choose a date"
              className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-350 focus:outline-none"
            />
          </div>

          {/* Custom Mini Calendar UI */}
          <div className="space-y-4">
            {/* Header Month / Nav Buttons */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-300">{monthLabel}</span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days headers M T W T F S S */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {dayNames.map((name, i) => (
                <span key={i} className="text-[10px] font-bold text-slate-500 uppercase">
                  {name}
                </span>
              ))}
            </div>

            {/* Calendar grid cells */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {getDaysInMonth(currentMonth).map((day, index) => {
                if (!day) {
                  return <div key={index} className="h-7 w-7" />; // empty padding block
                }

                const dayString = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                const isSelected = dayString === selectedDate;
                const isToday = dayString === todayKey(timeZone);

                return (
                  <button
                    key={index}
                    onClick={() => selectDay(day)}
                    className={`h-7 w-7 text-[11px] font-semibold rounded-lg flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/10'
                        : isToday
                        ? 'border border-sky-500/40 text-sky-400 font-bold'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Summary details */}
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-850 text-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Browsing Date</span>
            <p className="text-xs font-semibold text-slate-300 mt-1">
              {formatDateLong(selectedDate)}
            </p>
          </div>
        </div>

        {/* Right Column: Detailed vertical slots Timeline view */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-3.5">
            <div>
              <h3 className="text-md font-bold text-slate-200">Daily Appointment Slots</h3>
              <p className="text-xs text-slate-500 mt-0.5">Showing scheduled times and open reservations.</p>
            </div>
            <span className="text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-400 font-semibold uppercase tracking-wider">
              {selectedDate}
            </span>
          </div>

          {consultantInfo.active && (
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="calendar-consultant" className="text-xs font-bold uppercase tracking-wider text-slate-400">Consultant</label>
              <select
                id="calendar-consultant"
                value={consultantId}
                onChange={(e) => setConsultantChoice(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100"
              >
                {consultantInfo.consultants.map((c) => <option key={c.id} value={c.id}>{c.fullName}{c.title ? ` (${c.title})` : ''}</option>)}
                {unassignedCount > 0 && <option value="none">Older bookings (no consultant)</option>}
              </select>
              {unassignedCount > 0 && consultantId !== 'none' && (
                <span className="text-xs text-amber-300">{unassignedCount} older booking(s) today have no consultant; choose "Older bookings" to see them.</span>
              )}
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-850 max-w-sm animate-fade-in">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                filter === 'all'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              All Slots
            </button>
            <button
              onClick={() => setFilter('available')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                filter === 'available'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-355'
              }`}
            >
              Available
            </button>
            <button
              onClick={() => setFilter('booked')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                filter === 'booked'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-355'
              }`}
            >
              Booked
            </button>
          </div>

          <div className="divide-y divide-slate-850 max-h-[600px] overflow-y-auto pr-2">
            {filteredSlots.length === 0 ? (
              <div className="text-center py-16 space-y-2 animate-fade-in">
                <p className="text-sm text-slate-500 font-bold">
                  {filter === 'booked' 
                    ? 'No booked appointments scheduled for this date.' 
                    : availability?.closed
                      ? 'The business is closed on this date.'
                    : !canCheckFreeTimes
                      ? 'Free times cannot be shown right now.'
                      : 'No free times for this date.'}
                </p>
                <p className="text-xs text-slate-600">Select another date or adjust the filter.</p>
              </div>
            ) : (
              filteredSlots.map((slot) => {
                const appointment = getAppointmentForSlot(slot);

                return (
                <div key={slot} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  {/* Left Column: Time Label */}
                  <div className="w-20 flex-shrink-0">
                    <span className="text-xs font-bold text-slate-500">{slot}</span>
                  </div>

                  {/* Right Column: Appointment Status Card / Reserve Action */}
                  <div className="flex-1 ml-4">
                    {appointment ? (
                      <div className="flex items-center justify-between bg-gradient-to-r from-sky-950/30 to-cyan-950/10 border border-sky-900/40 rounded-xl px-4 py-3 shadow-sm hover:border-sky-700/50 transition-all">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-100 flex items-center">
                            <span className="bg-sky-400 text-slate-950 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase mr-3">
                              Booked
                            </span>
                            {appointment.customerName}
                          </p>
                          <p className="text-xs text-slate-400 flex flex-wrap gap-x-4 mt-1">
                            <span className="inline-flex items-center">
                              <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                              {appointment.customerPhone}
                            </span>
                            {appointment.customerEmail && (
                              <span className="inline-flex items-center">
                                <Mail className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                                {appointment.customerEmail}
                              </span>
                            )}
                          </p>
                          {appointment.googleEventId && (
                            <p className="text-[10px] font-mono text-emerald-400/90 mt-1">
                              Google Sync ID: {appointment.googleEventId}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-500 mt-1">
                            Booked at: {formatDateTime(appointment.createdAt, timeZone)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCancelAppointment(appointment.id, appointment.customerName)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Cancel Appointment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      freeTimes.has(slot) && canCheckFreeTimes ? (
                      <div className="flex items-center justify-between bg-slate-950/30 hover:bg-slate-950/60 border border-dashed border-slate-800/80 rounded-xl px-4 py-3 transition-all">
                        <span className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">Free</span>
                        <button
                          onClick={() => handleOpenBookModal(slot)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-sky-400 hover:text-sky-300 font-bold text-xs rounded-lg border border-slate-800/80 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Reserve</span>
                        </button>
                      </div>
                      ) : (
                      <div className="flex items-center justify-between bg-slate-950/20 border border-slate-800/50 rounded-xl px-4 py-3">
                        <span className="text-xs text-slate-500 font-semibold tracking-wide uppercase">
                          {canCheckFreeTimes ? 'Not available' : 'Unknown'}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          {canCheckFreeTimes ? 'Past, blocked in the calendar, or overlaps a booking' : 'Free times could not be read'}
                        </span>
                      </div>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl relative">
            <div className="flex items-center justify-between p-6 border-b border-slate-850">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Schedule Slot</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Booking for {selectedDate} at {modalTime}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-500 hover:text-slate-350 hover:bg-slate-850 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookAppointment} className="p-6 space-y-4">
              {bookingError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs font-semibold leading-relaxed">
                  {bookingError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Patient Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Tariq Mahmood"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Phone Number</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="+923221414831"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Email (Optional)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    placeholder="tariq.sulehri@gmail.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-slate-950 font-bold rounded-xl text-sm shadow-md transition-all"
                >
                  {bookingLoading ? 'Reserving...' : 'Book Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
