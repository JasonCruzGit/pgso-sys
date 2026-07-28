import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Check, Ban, Play, Flag, ChevronLeft, ChevronRight,
  Search, MapPin, Users, Printer, FileText,
} from 'lucide-react';
import api from '../../api/client';
import Badge from '../../components/Badge';
import { useAuth } from '../../context/AuthContext';
import type { Department, FleetBorrowerSlip, FleetSchedule, FleetVehicle, User } from '../../types';
import {
  openFleetBorrowerSlipPrintPreview,
  slipToPrintForm,
} from '../../utils/fleetBorrowerSlipPrint';
import toast from 'react-hot-toast';

type ViewMode = 'week' | 'month' | 'year';

const VEHICLE_TYPE_OPTIONS = ['any', 'sedan', 'van', 'pickup', 'truck', 'motorcycle', 'bus', 'utility'] as const;

const HOUR_START = 6;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const PX_PER_HOUR = 64;

const STATUS_META: Record<string, { label: string; dot: string; chip: string; bar: string }> = {
  pending_approval: { label: 'Pending', dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800 border-amber-200', bar: 'bg-amber-400' },
  approved: { label: 'Approved', dot: 'bg-sky-500', chip: 'bg-sky-100 text-sky-800 border-sky-200', bar: 'bg-sky-400' },
  scheduled: { label: 'Scheduled', dot: 'bg-indigo-500', chip: 'bg-indigo-100 text-indigo-800 border-indigo-200', bar: 'bg-indigo-400' },
  ongoing: { label: 'Ongoing', dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', bar: 'bg-emerald-500' },
  completed: { label: 'Completed', dot: 'bg-teal-500', chip: 'bg-teal-100 text-teal-800 border-teal-200', bar: 'bg-teal-400' },
  cancelled: { label: 'Cancelled', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 border-slate-200', bar: 'bg-slate-300' },
  rejected: { label: 'Rejected', dot: 'bg-rose-500', chip: 'bg-rose-100 text-rose-800 border-rose-200', bar: 'bg-rose-400' },
  draft: { label: 'Draft', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 border-slate-200', bar: 'bg-slate-300' },
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** True when calendar day falls within departure → expected return (inclusive). */
function scheduleCoversDay(s: FleetSchedule, day: Date) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime();
  const start = new Date(s.departure_at).getTime();
  const end = new Date(s.expected_return_at).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start <= dayEnd && end >= dayStart;
}

function formatHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Keep hours/minutes from an existing local input while changing the calendar day. */
function applyDateKeepTime(baseLocalInput: string, day: Date, fallbackHour: number, fallbackMin = 0) {
  const pad = (n: number) => String(n).padStart(2, '0');
  let h = fallbackHour;
  let m = fallbackMin;
  if (baseLocalInput) {
    const d = new Date(baseLocalInput);
    if (!Number.isNaN(d.getTime())) {
      h = d.getHours();
      m = d.getMinutes();
    }
  }
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(h)}:${pad(m)}`;
}

const BLOCKING_STATUSES = new Set(['pending_approval', 'approved', 'scheduled', 'ongoing']);

function minutesFromMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function scheduleMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.draft;
}

export default function FleetSchedules() {
  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const canSchedule = hasPermission('fleet.schedule') || hasPermission('fleet.*');
  const canApprove = hasPermission('fleet.approve') || hasPermission('fleet.*');

  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [miniMonth, setMiniMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [enabledStatuses, setEnabledStatuses] = useState<Record<string, boolean>>({
    pending_approval: true,
    scheduled: true,
    ongoing: true,
    completed: true,
    cancelled: false,
    rejected: false,
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<FleetSchedule | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [timeError, setTimeError] = useState('');
  const [override, setOverride] = useState(false);
  const [now, setNow] = useState(new Date());
  const [draftSlot, setDraftSlot] = useState<{ day: Date; hour: number } | null>(null);
  const [formCalMonth, setFormCalMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [rangePick, setRangePick] = useState<'start' | 'end'>('start');
  const [showBorrowerSlip, setShowBorrowerSlip] = useState(false);
  const [savedSlip, setSavedSlip] = useState<FleetBorrowerSlip | null>(null);
  const [borrowerSlipId, setBorrowerSlipId] = useState<number | null>(null);
  const [slipDraftSlot, setSlipDraftSlot] = useState<{ day?: Date; hour?: number } | null>(null);
  const [slipForm, setSlipForm] = useState({
    borrower_name: '',
    department_id: '',
    contact_no: '',
    purpose: '',
    destination: '',
    departure_at: '',
    expected_return_at: '',
    passengers: '1',
    requested_vehicle_type: 'any',
    driver_needed: true,
    preferred_driver_note: '',
    remarks: '',
  });
  const [slipTimeError, setSlipTimeError] = useState('');

  const [form, setForm] = useState({
    fleet_vehicle_id: '',
    driver_id: '',
    department_id: '',
    purpose: '',
    destination: '',
    departure_at: '',
    expected_return_at: '',
    passengers: '1',
    priority: 'normal',
    remarks: '',
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const range = useMemo(() => {
    if (view === 'year') {
      const from = new Date(anchor.getFullYear(), 0, 1);
      const to = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (view === 'month') {
      const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    const from = startOfWeek(anchor);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [view, anchor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

  const { data: calendar = [] } = useQuery({
    queryKey: ['fleet-calendar', view, range.from, range.to],
    queryFn: () => api.get('/fleet/schedules/calendar', {
      params: { from: range.from, to: range.to, view },
    }).then((r) => r.data.data as FleetSchedule[]),
  });

  const { data: vehicles } = useQuery({
    queryKey: ['fleet-vehicles-select'],
    queryFn: () => api.get('/fleet/vehicles', { params: { per_page: 100, status: 'active' } }).then((r) => r.data.data as FleetVehicle[]),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments-active'],
    queryFn: () => api.get('/departments', { params: { is_active: true } }).then((r) => (r.data.data ?? r.data) as Department[]),
  });

  const { data: custodians } = useQuery({
    queryKey: ['fleet-drivers'],
    queryFn: () => api.get('/custodians').then((r) => r.data.data as User[]),
  });

  const formCalRange = useMemo(() => {
    const from = new Date(formCalMonth.getFullYear(), formCalMonth.getMonth(), 1);
    from.setDate(from.getDate() - from.getDay());
    const to = new Date(formCalMonth.getFullYear(), formCalMonth.getMonth() + 1, 0);
    to.setDate(to.getDate() + (6 - to.getDay()));
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [formCalMonth]);

  const { data: formMonthSchedules = [] } = useQuery({
    queryKey: ['fleet-calendar', 'form-month', formCalRange.from, formCalRange.to],
    queryFn: () => api.get('/fleet/schedules/calendar', {
      params: { from: formCalRange.from, to: formCalRange.to, view: 'month' },
    }).then((r) => r.data.data as FleetSchedule[]),
    enabled: showForm,
  });

  const availWindow = useMemo(() => {
    if (!form.departure_at || !form.expected_return_at) return null;
    const from = new Date(form.departure_at);
    const to = new Date(form.expected_return_at);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return null;
    return { from: from.toISOString(), to: to.toISOString() };
  }, [form.departure_at, form.expected_return_at]);

  const { data: windowSchedules = [] } = useQuery({
    queryKey: ['fleet-calendar', 'avail-window', availWindow?.from, availWindow?.to],
    queryFn: () => api.get('/fleet/schedules/calendar', {
      params: { from: availWindow!.from, to: availWindow!.to, view: 'month' },
    }).then((r) => r.data.data as FleetSchedule[]),
    enabled: showForm && !!availWindow,
  });

  const formCalDays = useMemo(() => {
    const start = new Date(formCalMonth.getFullYear(), formCalMonth.getMonth(), 1);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [formCalMonth]);

  const formDaysBooked = useMemo(() => {
    const set = new Set<string>();
    for (const s of formMonthSchedules) {
      if (!BLOCKING_STATUSES.has(s.status)) continue;
      const cur = startOfDay(new Date(s.departure_at));
      const end = startOfDay(new Date(s.expected_return_at));
      if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) continue;
      while (cur.getTime() <= end.getTime()) {
        set.add(`${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return set;
  }, [formMonthSchedules]);

  const vehicleAvailability = useMemo(() => {
    const map: Record<number, { available: boolean; label?: string }> = {};
    for (const v of vehicles ?? []) {
      map[v.id] = { available: true };
    }
    if (!availWindow) return map;
    const start = new Date(availWindow.from).getTime();
    const end = new Date(availWindow.to).getTime();
    for (const s of windowSchedules) {
      if (!BLOCKING_STATUSES.has(s.status)) continue;
      const sStart = new Date(s.departure_at).getTime();
      const sEnd = new Date(s.expected_return_at).getTime();
      if (sStart >= end || sEnd <= start) continue;
      map[s.fleet_vehicle_id] = {
        available: false,
        label: `${s.schedule_number} · ${s.destination}`,
      };
    }
    return map;
  }, [vehicles, windowSchedules, availWindow]);

  useEffect(() => {
    if (!form.fleet_vehicle_id || !availWindow) return;
    const id = Number(form.fleet_vehicle_id);
    if (vehicleAvailability[id]?.available === false) {
      setForm((f) => ({ ...f, fleet_vehicle_id: '' }));
    }
  }, [vehicleAvailability, availWindow, form.fleet_vehicle_id]);

  const filtered = useMemo(() => {
    return calendar.filter((s) => {
      if (enabledStatuses[s.status] === false) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.schedule_number.toLowerCase().includes(q)
        || s.destination.toLowerCase().includes(q)
        || s.purpose.toLowerCase().includes(q)
        || (s.vehicle?.plate_number ?? '').toLowerCase().includes(q)
        || (s.driver?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [calendar, enabledStatuses, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of calendar) {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
    }
    return counts;
  }, [calendar]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fleet-schedules'] });
    queryClient.invalidateQueries({ queryKey: ['fleet-calendar'] });
    queryClient.invalidateQueries({ queryKey: ['fleet-dashboard'] });
  };

  const openBorrowerSlip = (day?: Date, hour?: number) => {
    const start = day ? new Date(day) : new Date();
    if (hour != null) start.setHours(hour, 0, 0, 0);
    else {
      start.setMinutes(0, 0, 0);
      if (start.getHours() < HOUR_START) start.setHours(Math.max(HOUR_START, 8));
    }
    const end = new Date(start);
    end.setHours(start.getHours() + 2);
    setSlipForm({
      borrower_name: user?.name ?? '',
      department_id: String(user?.department?.id ?? ''),
      contact_no: user?.phone ?? '',
      purpose: '',
      destination: '',
      departure_at: toLocalInput(start),
      expected_return_at: toLocalInput(end),
      passengers: '1',
      requested_vehicle_type: 'any',
      driver_needed: true,
      preferred_driver_note: '',
      remarks: '',
    });
    setSlipDraftSlot(day || hour != null ? { day, hour } : null);
    setSavedSlip(null);
    setBorrowerSlipId(null);
    setSlipTimeError('');
    setShowBorrowerSlip(true);
  };

  const openCreateFromSlip = (slip: FleetBorrowerSlip) => {
    const start = new Date(slip.departure_at);
    const end = new Date(slip.expected_return_at);
    setForm({
      fleet_vehicle_id: '',
      driver_id: '',
      department_id: String(slip.department_id),
      purpose: slip.purpose,
      destination: slip.destination,
      departure_at: toLocalInput(start),
      expected_return_at: toLocalInput(end),
      passengers: String(slip.passengers || 1),
      priority: 'normal',
      remarks: [
        slip.remarks,
        slip.requested_vehicle_type && slip.requested_vehicle_type !== 'any'
          ? `Requested vehicle type: ${slip.requested_vehicle_type}`
          : '',
        slip.driver_needed === false
          ? 'Driver not needed'
          : slip.preferred_driver_note
            ? `Preferred driver: ${slip.preferred_driver_note}`
            : '',
      ].filter(Boolean).join('\n'),
    });
    setBorrowerSlipId(slip.id);
    setFormCalMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    setRangePick('end');
    setDraftSlot(
      slipDraftSlot?.day && slipDraftSlot.hour != null
        ? { day: slipDraftSlot.day, hour: slipDraftSlot.hour }
        : null,
    );
    setConflicts([]);
    setTimeError('');
    setOverride(false);
    setShowBorrowerSlip(false);
    setShowForm(true);
  };

  const validateSlipTimes = (departure: string, expectedReturn: string): boolean => {
    if (!departure || !expectedReturn) {
      setSlipTimeError('');
      return true;
    }
    const start = new Date(departure).getTime();
    const end = new Date(expectedReturn).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) {
      setSlipTimeError('Enter valid departure and return date/time.');
      return false;
    }
    if (start >= end) {
      setSlipTimeError('Expected return must be later than departure.');
      return false;
    }
    setSlipTimeError('');
    return true;
  };

  const saveSlip = useMutation({
    mutationFn: () => api.post('/fleet/borrower-slips', {
      ...slipForm,
      department_id: Number(slipForm.department_id),
      passengers: Number(slipForm.passengers || 1),
      driver_needed: slipForm.driver_needed,
      requested_vehicle_type: slipForm.requested_vehicle_type === 'any' ? null : slipForm.requested_vehicle_type,
      preferred_driver_note: slipForm.preferred_driver_note || null,
      remarks: slipForm.remarks || null,
      contact_no: slipForm.contact_no || null,
      requester_id: user?.id,
    }).then((r) => r.data as FleetBorrowerSlip),
    onSuccess: (slip) => {
      setSavedSlip(slip);
      setBorrowerSlipId(slip.id);
      toast.success(`Borrower's slip ${slip.slip_number} saved`);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to save borrower\'s slip');
    },
  });

  const onFormDayClick = (day: Date) => {
    if (rangePick === 'start' || !form.departure_at) {
      const dep = applyDateKeepTime(form.departure_at, day, Math.max(HOUR_START, 8), 0);
      const depDate = new Date(dep);
      let ret = form.expected_return_at
        ? applyDateKeepTime(form.expected_return_at, day, depDate.getHours() + 2, depDate.getMinutes())
        : '';
      if (!ret || new Date(ret).getTime() <= depDate.getTime()) {
        const bumped = new Date(depDate);
        bumped.setHours(bumped.getHours() + 2);
        ret = toLocalInput(bumped);
      }
      setForm((f) => ({ ...f, departure_at: dep, expected_return_at: ret, fleet_vehicle_id: '' }));
      validateReturnAfterDeparture(dep, ret);
      setRangePick('end');
      return;
    }

    const depDay = startOfDay(new Date(form.departure_at));
    if (startOfDay(day).getTime() < depDay.getTime()) {
      const dep = applyDateKeepTime(form.departure_at, day, Math.max(HOUR_START, 8), 0);
      const depDate = new Date(dep);
      const bumped = new Date(depDate);
      bumped.setHours(bumped.getHours() + 2);
      const ret = toLocalInput(bumped);
      setForm((f) => ({ ...f, departure_at: dep, expected_return_at: ret, fleet_vehicle_id: '' }));
      validateReturnAfterDeparture(dep, ret);
      setRangePick('end');
      return;
    }

    const ret = applyDateKeepTime(form.expected_return_at, day, 17, 0);
    let nextRet = ret;
    if (new Date(ret).getTime() <= new Date(form.departure_at).getTime()) {
      const dep = new Date(form.departure_at);
      const bumped = new Date(day);
      bumped.setHours(dep.getHours() + 2, dep.getMinutes(), 0, 0);
      nextRet = toLocalInput(bumped);
    }
    setForm((f) => ({ ...f, expected_return_at: nextRet, fleet_vehicle_id: '' }));
    validateReturnAfterDeparture(form.departure_at, nextRet);
    setRangePick('start');
  };

  const validateReturnAfterDeparture = (departure: string, expectedReturn: string): boolean => {
    if (!departure || !expectedReturn) {
      setTimeError('');
      return true;
    }
    const start = new Date(departure).getTime();
    const end = new Date(expectedReturn).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) {
      setTimeError('Enter valid departure and return date/time.');
      return false;
    }
    if (start >= end) {
      setTimeError('Expected return must be later than departure.');
      return false;
    }
    setTimeError('');
    return true;
  };

  const onDepartureChange = (value: string) => {
    setForm((f) => {
      const next = { ...f, departure_at: value };
      if (f.expected_return_at && new Date(value).getTime() >= new Date(f.expected_return_at).getTime()) {
        const bumped = new Date(value);
        bumped.setHours(bumped.getHours() + 2);
        next.expected_return_at = toLocalInput(bumped);
      }
      validateReturnAfterDeparture(next.departure_at, next.expected_return_at);
      return next;
    });
  };

  const onReturnChange = (value: string) => {
    setForm((f) => {
      const next = { ...f, expected_return_at: value };
      validateReturnAfterDeparture(next.departure_at, next.expected_return_at);
      return next;
    });
  };

  const create = useMutation({
    mutationFn: () => api.post('/fleet/schedules', {
      ...form,
      fleet_vehicle_id: Number(form.fleet_vehicle_id),
      driver_id: form.driver_id ? Number(form.driver_id) : null,
      department_id: Number(form.department_id),
      passengers: Number(form.passengers || 1),
      requester_id: user?.id,
      conflict_override: override,
      status: 'pending_approval',
      borrower_slip_id: borrowerSlipId,
    }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Schedule submitted for approval');
      setShowForm(false);
      setDraftSlot(null);
      setSlipDraftSlot(null);
      setSavedSlip(null);
      setBorrowerSlipId(null);
      setConflicts([]);
      setOverride(false);
      refresh();
    },
    onError: (e: { response?: { data?: { message?: string; conflicts?: string[] } } }) => {
      setConflicts(e.response?.data?.conflicts ?? []);
      toast.error(e.response?.data?.message ?? 'Failed to create schedule');
    },
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action, reason }: { id: number; action: string; reason?: string }) =>
      api.post(`/fleet/schedules/${id}/${action}`, reason ? { reason } : {}).then((r) => r.data),
    onSuccess: (_, vars) => {
      toast.success(`Schedule ${vars.action} successful`);
      setViewing(null);
      refresh();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Action failed');
    },
  });

  const openDetail = async (id: number) => {
    const { data } = await api.get(`/fleet/schedules/${id}`);
    setViewing(data as FleetSchedule);
  };

  const shiftAnchor = (dir: -1 | 1) => {
    const next = new Date(anchor);
    if (view === 'week') next.setDate(next.getDate() + dir * 7);
    else if (view === 'month') next.setMonth(next.getMonth() + dir);
    else next.setFullYear(next.getFullYear() + dir);
    setAnchor(next);
    setMiniMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const toolbarLabel = (() => {
    if (view === 'week') {
      const a = weekDays[0];
      const b = weekDays[6];
      return `${a.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (view === 'month') {
      return anchor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    }
    return String(anchor.getFullYear());
  })();

  const nowTop = ((minutesFromMidnight(now) - HOUR_START * 60) / 60) * PX_PER_HOUR;
  const showNowLine = now.getHours() >= HOUR_START && now.getHours() < HOUR_END;

  function eventsForDay(day: Date) {
    return filtered.filter((s) => scheduleCoversDay(s, day));
  }

  function eventStyle(s: FleetSchedule, day: Date) {
    const start = new Date(s.departure_at);
    const end = new Date(s.expected_return_at);
    const onStart = sameDay(start, day);
    const onEnd = sameDay(end, day);

    let startMin = HOUR_START * 60;
    let endMin = HOUR_END * 60;
    if (onStart) startMin = Math.max(minutesFromMidnight(start), HOUR_START * 60);
    if (onEnd) endMin = Math.min(minutesFromMidnight(end), HOUR_END * 60);
    if (!onStart && !onEnd) {
      // Middle day of a multi-day trip — full visible workday
      startMin = HOUR_START * 60;
      endMin = HOUR_END * 60;
    }
    endMin = Math.min(Math.max(endMin, startMin + 30), HOUR_END * 60);
    const top = ((startMin - HOUR_START * 60) / 60) * PX_PER_HOUR;
    const height = Math.max(((endMin - startMin) / 60) * PX_PER_HOUR, 28);
    return { top, height, onStart, onEnd, multiDay: !sameDay(start, end) };
  }

  const miniDays = useMemo(() => {
    const first = new Date(miniMonth.getFullYear(), miniMonth.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [miniMonth]);

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const s of calendar) {
      const start = startOfDay(new Date(s.departure_at));
      const end = startOfDay(new Date(s.expected_return_at));
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      const cursor = new Date(start);
      while (cursor.getTime() <= end.getTime()) {
        set.add(`${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return set;
  }, [calendar]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="grid min-h-[720px] lg:grid-cols-[17.5rem_minmax(0,1fr)]">
        {/* Left contextual sidebar */}
        <aside className="border-b border-slate-100 bg-slate-50/80 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              {miniMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
                onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() - 1, 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
                onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
          </div>
          <div className="mb-6 grid grid-cols-7 gap-1">
            {miniDays.map((d) => {
              const inMonth = d.getMonth() === miniMonth.getMonth();
              const isToday = sameDay(d, now);
              const isSelected = sameDay(d, anchor);
              const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
              const hasEvent = daysWithEvents.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setAnchor(new Date(d));
                    if (view === 'year') setView('week');
                  }}
                  className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-palawan-700 text-white shadow-sm'
                      : isToday
                        ? 'bg-palawan-100 text-palawan-800'
                        : inMonth
                          ? 'text-slate-700 hover:bg-white'
                          : 'text-slate-300'
                  }`}
                >
                  {d.getDate()}
                  {hasEvent && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-palawan-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Categories</p>
            <div className="space-y-1.5">
              {Object.entries(STATUS_META)
                .filter(([key]) => ['pending_approval', 'scheduled', 'ongoing', 'completed', 'cancelled', 'rejected'].includes(key))
                .map(([key, meta]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-palawan-600 focus:ring-palawan-500"
                      checked={enabledStatuses[key] !== false}
                      onChange={(e) => setEnabledStatuses((s) => ({ ...s, [key]: e.target.checked }))}
                    />
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    <span className="flex-1 text-sm font-medium text-slate-700">{meta.label}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-100">
                      {statusCounts[key] ?? 0}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        </aside>

        {/* Main calendar */}
        <section className="flex min-w-0 flex-col">
          <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-50" onClick={() => shiftAnchor(-1)}>
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setAnchor(new Date())}>
                Today
              </button>
              <button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-50" onClick={() => shiftAnchor(1)}>
                <ChevronRight size={18} />
              </button>
            </div>

            <p className="text-base font-bold text-slate-900 sm:text-lg">{toolbarLabel}</p>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {searchOpen ? (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    autoFocus
                    className="input-field !h-9 w-44 !pl-9 !text-sm"
                    placeholder="Search trips..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onBlur={() => { if (!search) setSearchOpen(false); }}
                  />
                </div>
              ) : (
                <button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-50" onClick={() => setSearchOpen(true)}>
                  <Search size={18} />
                </button>
              )}

              <div className="flex rounded-full bg-slate-100 p-1">
                {(['week', 'month', 'year'] as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition ${
                      view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {canSchedule && (
                <button type="button" className="btn-primary !rounded-full !px-4 !py-2" onClick={() => openBorrowerSlip()}>
                  <Plus size={16} /> Add schedule
                </button>
              )}
            </div>
          </header>

          {view === 'week' && (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="sticky top-0 z-20 grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-slate-100 bg-white">
                <div className="border-r border-slate-100" />
                {weekDays.map((d) => {
                  const isToday = sameDay(d, now);
                  return (
                    <div key={d.toISOString()} className="border-r border-slate-100 px-2 py-3 text-center last:border-r-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {d.toLocaleDateString('en-PH', { weekday: 'short' })}
                      </p>
                      <p className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        isToday ? 'bg-palawan-700 text-white' : 'text-slate-800'
                      }`}>
                        {d.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="relative grid grid-cols-[4rem_repeat(7,minmax(0,1fr))]" style={{ height: HOURS.length * PX_PER_HOUR }}>
                <div className="relative border-r border-slate-100">
                  {HOURS.map((h) => (
                    <div key={h} className="relative" style={{ height: PX_PER_HOUR }}>
                      <span className="absolute -top-2 right-2 text-[10px] font-semibold text-slate-400">{formatHour(h)}</span>
                    </div>
                  ))}
                </div>

                {weekDays.map((day) => {
                  const dayEvents = eventsForDay(day);
                  const isToday = sameDay(day, now);
                  return (
                    <div key={day.toISOString()} className="relative border-r border-slate-100 last:border-r-0">
                      {HOURS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          className="absolute inset-x-0 w-full border-b border-slate-50 hover:bg-palawan-50/40"
                          style={{ top: (h - HOUR_START) * PX_PER_HOUR, height: PX_PER_HOUR }}
                          onClick={() => canSchedule && openBorrowerSlip(day, h)}
                          aria-label={`Create schedule ${day.toDateString()} ${h}:00`}
                        />
                      ))}

                      {draftSlot && sameDay(draftSlot.day, day) && (
                        <div
                          className="pointer-events-none absolute inset-x-1 z-10 rounded-xl border-2 border-dashed border-palawan-400 bg-palawan-50/50"
                          style={{ top: (draftSlot.hour - HOUR_START) * PX_PER_HOUR + 4, height: PX_PER_HOUR * 2 - 8 }}
                        />
                      )}

                      {dayEvents.map((s) => {
                        const { top, height, multiDay, onStart, onEnd } = eventStyle(s, day);
                        const meta = scheduleMeta(s.status);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void openDetail(s.id); }}
                            className={`absolute inset-x-1 z-10 overflow-hidden rounded-xl border px-2 py-1.5 text-left shadow-sm transition hover:shadow-md ${meta.chip}`}
                            style={{ top: top + 2, height: height - 4 }}
                          >
                            <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar}`} />
                            <p className="truncate pl-1.5 text-[11px] font-bold leading-tight">{s.vehicle?.plate_number ?? 'Trip'}</p>
                            <p className="truncate pl-1.5 text-[10px] leading-tight opacity-80">{s.destination}</p>
                            <p className="mt-0.5 truncate pl-1.5 text-[10px] opacity-70">
                              {multiDay && !onStart ? '…' : new Date(s.departure_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {multiDay && !onEnd ? '…' : new Date(s.expected_return_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {s.driver?.name && (
                              <div className="mt-1 flex items-center gap-1 pl-1.5">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-[8px] font-bold text-slate-600">
                                  {s.driver.name.charAt(0)}
                                </span>
                                <span className="truncate text-[9px] opacity-70">{s.driver.name.split(' ')[0]}</span>
                              </div>
                            )}
                          </button>
                        );
                      })}

                      {isToday && showNowLine && (
                        <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: nowTop }}>
                          <div className="relative">
                            <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-rose-500" />
                            <div className="h-0.5 bg-rose-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {showNowLine && sameDay(now, weekDays.find((d) => sameDay(d, now)) ?? new Date(0)) && (
                  <div className="pointer-events-none absolute left-0 z-30" style={{ top: nowTop + 48 }}>
                    <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      {now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'month' && (
            <div className="grid min-h-0 flex-1 grid-cols-7 overflow-auto">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="border-b border-r border-slate-100 bg-slate-50/50 px-2 py-2 text-center text-[11px] font-bold uppercase text-slate-400">
                  {d}
                </div>
              ))}
              {(() => {
                const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
                const start = startOfWeek(first);
                return Array.from({ length: 42 }, (_, i) => {
                  const d = new Date(start);
                  d.setDate(start.getDate() + i);
                  const inMonth = d.getMonth() === anchor.getMonth();
                  const allDayEvents = eventsForDay(d);
                  const dayEvents = allDayEvents.slice(0, 3);
                  const more = allDayEvents.length - dayEvents.length;
                  const hasEvents = allDayEvents.length > 0;
                  const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                  return (
                    <div
                      key={dayKey}
                      className={`relative min-h-[110px] border-b border-r border-slate-100 p-1.5 ${
                        hasEvents && inMonth
                          ? 'bg-palawan-50/70'
                          : hasEvents
                            ? 'bg-palawan-50/30'
                            : inMonth
                              ? 'bg-white'
                              : 'bg-slate-50/40'
                      }`}
                    >
                      {hasEvents && (
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-palawan-500/70" />
                      )}
                      <button
                        type="button"
                        className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          sameDay(d, now)
                            ? 'bg-palawan-700 text-white'
                            : hasEvents && inMonth
                              ? 'bg-palawan-100 text-palawan-800'
                              : inMonth
                                ? 'text-slate-700'
                                : 'text-slate-300'
                        }`}
                        onClick={() => { setAnchor(d); setView('week'); }}
                      >
                        {d.getDate()}
                      </button>
                      <div className="space-y-1">
                        {dayEvents.map((s) => {
                          const meta = scheduleMeta(s.status);
                          const start = new Date(s.departure_at);
                          const end = new Date(s.expected_return_at);
                          const multiDay = !sameDay(start, end);
                          const onStart = sameDay(start, d);
                          const onEnd = sameDay(end, d);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => openDetail(s.id)}
                              className={`block w-full truncate border px-1.5 py-0.5 text-left text-[10px] font-semibold ${meta.chip} ${
                                multiDay
                                  ? onStart
                                    ? 'rounded-l-md rounded-r-none border-r-0'
                                    : onEnd
                                      ? 'rounded-r-md rounded-l-none border-l-0'
                                      : 'rounded-none border-x-0'
                                  : 'rounded-md'
                              }`}
                              title={`${s.vehicle?.plate_number ?? ''} · ${s.destination}\n${start.toLocaleString('en-PH')} – ${end.toLocaleString('en-PH')}`}
                            >
                              {multiDay && !onStart ? '… ' : ''}
                              {s.vehicle?.plate_number} · {s.destination}
                              {multiDay && !onEnd ? ' …' : ''}
                            </button>
                          );
                        })}
                        {more > 0 && <p className="px-1 text-[10px] font-medium text-slate-400">+{more} more</p>}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {view === 'year' && (
            <div className="grid flex-1 gap-4 overflow-auto p-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 12 }, (_, month) => {
                const label = new Date(anchor.getFullYear(), month, 1).toLocaleDateString('en-PH', { month: 'long' });
                const count = filtered.filter((s) => {
                  const start = new Date(s.departure_at);
                  const end = new Date(s.expected_return_at);
                  const monthStart = new Date(anchor.getFullYear(), month, 1).getTime();
                  const monthEnd = new Date(anchor.getFullYear(), month + 1, 0, 23, 59, 59, 999).getTime();
                  return start.getTime() <= monthEnd && end.getTime() >= monthStart;
                }).length;
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => {
                      setAnchor(new Date(anchor.getFullYear(), month, 1));
                      setMiniMonth(new Date(anchor.getFullYear(), month, 1));
                      setView('month');
                    }}
                    className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-left transition hover:border-palawan-200 hover:bg-palawan-50/40"
                  >
                    <p className="font-bold text-slate-900">{label}</p>
                    <p className="mt-1 text-sm text-slate-500">{count} schedule{count === 1 ? '' : 's'}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Borrower's Slip modal (step 1) */}
      {showBorrowerSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-[2px]">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/20">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-6 pb-3 pt-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-palawan-700">Step 1 of 2</p>
                <h2 className="text-xl font-bold text-slate-900">Borrower's Slip</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Fill out the slip first. After saving, you can print it and continue to schedule a vehicle.
                </p>
                {savedSlip && (
                  <p className="mt-1 font-mono text-xs font-bold text-palawan-700">{savedSlip.slip_number}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setShowBorrowerSlip(false); setSlipDraftSlot(null); }}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <form
              className="space-y-4 overflow-y-auto px-6 py-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!validateSlipTimes(slipForm.departure_at, slipForm.expected_return_at)) {
                  toast.error('Expected return must be later than departure.');
                  return;
                }
                if (savedSlip) {
                  openCreateFromSlip(savedSlip);
                  return;
                }
                saveSlip.mutate(undefined, {
                  onSuccess: (slip) => openCreateFromSlip(slip),
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Borrower name</label>
                  <input
                    required
                    className="input-field w-full !rounded-xl"
                    value={slipForm.borrower_name}
                    onChange={(e) => setSlipForm({ ...slipForm, borrower_name: e.target.value })}
                    disabled={!!savedSlip}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Contact no.</label>
                  <input
                    className="input-field w-full !rounded-xl"
                    value={slipForm.contact_no}
                    onChange={(e) => setSlipForm({ ...slipForm, contact_no: e.target.value })}
                    disabled={!!savedSlip}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">Office / Department</label>
                <select
                  required
                  className="input-field w-full !rounded-xl"
                  value={slipForm.department_id}
                  onChange={(e) => setSlipForm({ ...slipForm, department_id: e.target.value })}
                  disabled={!!savedSlip}
                >
                  <option value="">Select office</option>
                  {(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">Purpose</label>
                <input
                  required
                  className="input-field w-full !rounded-xl"
                  placeholder="e.g. Official travel / delivery"
                  value={slipForm.purpose}
                  onChange={(e) => setSlipForm({ ...slipForm, purpose: e.target.value })}
                  disabled={!!savedSlip}
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-600">
                  <MapPin size={14} /> Destination
                </label>
                <input
                  required
                  className="input-field w-full !rounded-xl"
                  value={slipForm.destination}
                  onChange={(e) => setSlipForm({ ...slipForm, destination: e.target.value })}
                  disabled={!!savedSlip}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Departure</label>
                  <input
                    required
                    type="datetime-local"
                    className={`input-field w-full !rounded-xl ${slipTimeError ? '!border-rose-300' : ''}`}
                    value={slipForm.departure_at}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSlipForm((f) => {
                        const next = { ...f, departure_at: value };
                        if (f.expected_return_at && new Date(value).getTime() >= new Date(f.expected_return_at).getTime()) {
                          const bumped = new Date(value);
                          bumped.setHours(bumped.getHours() + 2);
                          next.expected_return_at = toLocalInput(bumped);
                        }
                        validateSlipTimes(next.departure_at, next.expected_return_at);
                        return next;
                      });
                    }}
                    disabled={!!savedSlip}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Expected return</label>
                  <input
                    required
                    type="datetime-local"
                    min={slipForm.departure_at || undefined}
                    className={`input-field w-full !rounded-xl ${slipTimeError ? '!border-rose-300' : ''}`}
                    value={slipForm.expected_return_at}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSlipForm((f) => {
                        const next = { ...f, expected_return_at: value };
                        validateSlipTimes(next.departure_at, next.expected_return_at);
                        return next;
                      });
                    }}
                    disabled={!!savedSlip}
                  />
                </div>
              </div>
              {slipTimeError && <p className="-mt-2 text-sm font-medium text-rose-600">{slipTimeError}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Passengers</label>
                  <input
                    type="number"
                    min={1}
                    required
                    className="input-field w-full !rounded-xl"
                    value={slipForm.passengers}
                    onChange={(e) => setSlipForm({ ...slipForm, passengers: e.target.value })}
                    disabled={!!savedSlip}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Requested vehicle type</label>
                  <select
                    className="input-field w-full !rounded-xl"
                    value={slipForm.requested_vehicle_type}
                    onChange={(e) => setSlipForm({ ...slipForm, requested_vehicle_type: e.target.value })}
                    disabled={!!savedSlip}
                  >
                    {VEHICLE_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t === 'any' ? 'Any' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Driver needed?</label>
                  <select
                    className="input-field w-full !rounded-xl"
                    value={slipForm.driver_needed ? 'yes' : 'no'}
                    onChange={(e) => setSlipForm({ ...slipForm, driver_needed: e.target.value === 'yes' })}
                    disabled={!!savedSlip}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Preferred driver note</label>
                  <input
                    className="input-field w-full !rounded-xl"
                    placeholder="Optional"
                    value={slipForm.preferred_driver_note}
                    onChange={(e) => setSlipForm({ ...slipForm, preferred_driver_note: e.target.value })}
                    disabled={!!savedSlip || !slipForm.driver_needed}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">Remarks</label>
                <textarea
                  className="input-field w-full !rounded-xl"
                  rows={2}
                  value={slipForm.remarks}
                  onChange={(e) => setSlipForm({ ...slipForm, remarks: e.target.value })}
                  disabled={!!savedSlip}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={() => { setShowBorrowerSlip(false); setSlipDraftSlot(null); }}
                >
                  Cancel
                </button>
                {!savedSlip ? (
                  <>
                    <button
                      type="button"
                      className="btn-secondary !rounded-full"
                      disabled={saveSlip.isPending}
                      onClick={() => {
                        if (!validateSlipTimes(slipForm.departure_at, slipForm.expected_return_at)) {
                          toast.error('Expected return must be later than departure.');
                          return;
                        }
                        saveSlip.mutate();
                      }}
                    >
                      <FileText size={16} /> {saveSlip.isPending ? 'Saving…' : 'Save slip'}
                    </button>
                    <button type="submit" className="btn-primary !rounded-full" disabled={saveSlip.isPending}>
                      Save &amp; continue
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-secondary !rounded-full"
                      onClick={() => {
                        const deptName = departments?.find((d) => d.id === savedSlip.department_id)?.name
                          ?? savedSlip.department?.name;
                        openFleetBorrowerSlipPrintPreview({
                          ...slipToPrintForm({ ...savedSlip, department: savedSlip.department ?? (deptName ? { id: savedSlip.department_id, name: deptName } as Department : undefined) }),
                          office_name: deptName,
                        });
                      }}
                    >
                      <Printer size={16} /> Print
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !rounded-full"
                      onClick={async () => {
                        try {
                          const res = await api.get(`/fleet/borrower-slips/${savedSlip.id}/pdf`, { responseType: 'blob' });
                          const url = URL.createObjectURL(res.data);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `borrower-slip-${savedSlip.slip_number}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error('Failed to download PDF');
                        }
                      }}
                    >
                      PDF
                    </button>
                    <button type="button" className="btn-primary !rounded-full" onClick={() => openCreateFromSlip(savedSlip)}>
                      Continue to schedule
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New schedule modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-[2px]">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/20">
            <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-palawan-700">Step 2 of 2</p>
                <h2 className="text-xl font-bold text-slate-900">New schedule</h2>
                {savedSlip && (
                  <p className="mt-0.5 font-mono text-xs font-bold text-slate-500">Slip {savedSlip.slip_number}</p>
                )}
              </div>
              <button type="button" onClick={() => { setShowForm(false); setDraftSlot(null); }} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form
              className="space-y-4 overflow-y-auto px-6 pb-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (!validateReturnAfterDeparture(form.departure_at, form.expected_return_at)) {
                  toast.error('Expected return must be later than departure.');
                  return;
                }
                create.mutate();
              }}
            >
              {/* Date range calendar — pick dates first to check vehicle vacancy */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {formCalMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {rangePick === 'start'
                        ? 'Select departure date'
                        : 'Select return date'}
                      {form.departure_at && form.expected_return_at && (
                        <span className="ml-1 text-slate-600">
                          · {new Date(form.departure_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                          {' – '}
                          {new Date(form.expected_return_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
                      onClick={() => setFormCalMonth(new Date(formCalMonth.getFullYear(), formCalMonth.getMonth() - 1, 1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
                      onClick={() => setFormCalMonth(new Date(formCalMonth.getFullYear(), formCalMonth.getMonth() + 1, 1))}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {formCalDays.map((d) => {
                    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                    const inMonth = d.getMonth() === formCalMonth.getMonth();
                    const isToday = sameDay(d, now);
                    const dep = form.departure_at ? startOfDay(new Date(form.departure_at)) : null;
                    const ret = form.expected_return_at ? startOfDay(new Date(form.expected_return_at)) : null;
                    const dayStart = startOfDay(d);
                    const isStart = dep && sameDay(d, dep);
                    const isEnd = ret && sameDay(d, ret);
                    const inRange = dep && ret
                      && dayStart.getTime() >= dep.getTime()
                      && dayStart.getTime() <= ret.getTime();
                    const hasBooking = formDaysBooked.has(key);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onFormDayClick(d)}
                        className={`relative mx-auto flex h-9 w-full items-center justify-center rounded-lg text-xs font-semibold transition ${
                          isStart || isEnd
                            ? 'bg-palawan-700 text-white shadow-sm'
                            : inRange
                              ? 'bg-palawan-100 text-palawan-900'
                              : isToday
                                ? 'bg-white text-palawan-800 ring-1 ring-palawan-300'
                                : inMonth
                                  ? 'text-slate-700 hover:bg-white'
                                  : 'text-slate-300 hover:bg-white/60'
                        }`}
                      >
                        {d.getDate()}
                        {hasBooking && !isStart && !isEnd && (
                          <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-palawan-700" /> Selected range
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Has bookings
                  </span>
                  <button
                    type="button"
                    className="ml-auto font-semibold text-palawan-700 hover:underline"
                    onClick={() => setRangePick('start')}
                  >
                    Reset dates
                  </button>
                </div>
              </div>

              {/* Vehicle vacancy for selected dates */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">Vehicle</label>
                {availWindow ? (
                  <div className="mb-2 max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                    {(vehicles ?? []).length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-slate-500">No active vehicles.</p>
                    )}
                    {(vehicles ?? []).map((v) => {
                      const avail = vehicleAvailability[v.id]?.available !== false;
                      const selected = String(v.id) === form.fleet_vehicle_id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={!avail}
                          title={!avail ? (vehicleAvailability[v.id]?.label ? `Booked: ${vehicleAvailability[v.id].label}` : 'Booked for selected dates') : undefined}
                          onClick={() => {
                            if (!avail) return;
                            setForm({ ...form, fleet_vehicle_id: String(v.id) });
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                            !avail
                              ? 'cursor-not-allowed opacity-50'
                              : selected
                                ? 'bg-palawan-700 text-white'
                                : 'hover:bg-emerald-50'
                          }`}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${
                            !avail ? 'bg-rose-400' : selected ? 'bg-white' : 'bg-emerald-500'
                          }`} />
                          <span className={`min-w-0 flex-1 truncate font-medium ${
                            !avail ? 'text-slate-400' : selected ? 'text-white' : 'text-slate-800'
                          }`}>
                            {v.plate_number} — {v.name}
                          </span>
                          <span className={`shrink-0 text-[11px] font-semibold ${
                            !avail ? 'text-rose-500' : selected ? 'text-white/90' : 'text-emerald-700'
                          }`}>
                            {avail ? 'Available' : 'Booked'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mb-2 text-xs text-slate-500">Select dates above to see which cars are free.</p>
                )}
                <select
                  required
                  className="input-field w-full !rounded-xl"
                  value={form.fleet_vehicle_id}
                  onChange={(e) => setForm({ ...form, fleet_vehicle_id: e.target.value })}
                >
                  <option value="">Select vehicle</option>
                  {(vehicles ?? []).map((v) => {
                    const avail = !availWindow || vehicleAvailability[v.id]?.available !== false;
                    return (
                      <option key={v.id} value={v.id} disabled={!avail}>
                        {v.plate_number} — {v.name}{availWindow ? (avail ? ' · Available' : ' · Booked') : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">Purpose / Trip name</label>
                <input required className="input-field w-full !rounded-xl" placeholder="e.g. Medical supply delivery" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-600"><MapPin size={14} /> Destination</label>
                <input required className="input-field w-full !rounded-xl" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Departure time</label>
                  <input
                    required
                    type="datetime-local"
                    className={`input-field w-full !rounded-xl ${timeError ? '!border-rose-300 focus:!ring-rose-100' : ''}`}
                    value={form.departure_at}
                    onChange={(e) => onDepartureChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Expected return time</label>
                  <input
                    required
                    type="datetime-local"
                    min={form.departure_at || undefined}
                    className={`input-field w-full !rounded-xl ${timeError ? '!border-rose-300 focus:!ring-rose-100' : ''}`}
                    value={form.expected_return_at}
                    onChange={(e) => onReturnChange(e.target.value)}
                  />
                </div>
              </div>
              {timeError && (
                <p className="-mt-2 text-sm font-medium text-rose-600">{timeError}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Department</label>
                  <select required className="input-field w-full !rounded-xl" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                    <option value="">Select office</option>
                    {(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Priority</label>
                  <select className="input-field w-full !rounded-xl" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-600"><Users size={14} /> Driver & passengers</label>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input-field min-w-[12rem] flex-1 !rounded-xl" value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
                    <option value="">Select driver</option>
                    {(custodians ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <input type="number" min={1} className="input-field !w-24 !rounded-xl" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: e.target.value })} title="Passengers" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">Remarks</label>
                <textarea className="input-field w-full !rounded-xl" rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
              </div>

              {conflicts.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Conflicts detected</p>
                  <ul className="mt-1 list-disc pl-5">{conflicts.map((c) => <li key={c}>{c}</li>)}</ul>
                  {canApprove && (
                    <label className="mt-2 flex items-center gap-2">
                      <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                      Override conflicts (admin)
                    </label>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200" onClick={() => { setShowForm(false); setDraftSlot(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary !rounded-full" disabled={create.isPending}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="font-mono text-xs font-bold text-palawan-700">{viewing.schedule_number}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{viewing.destination}</h2>
                <div className="mt-2"><Badge status={viewing.status} /></div>
              </div>
              <button type="button" onClick={() => setViewing(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="space-y-4 px-6 py-5 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p><span className="text-slate-500">Vehicle:</span> {viewing.vehicle?.plate_number}</p>
                <p><span className="text-slate-500">Driver:</span> {viewing.driver?.name ?? '—'}</p>
                <p><span className="text-slate-500">Office:</span> {viewing.department?.name}</p>
                <p><span className="text-slate-500">Requester:</span> {viewing.requester?.name}</p>
                <p><span className="text-slate-500">Departure:</span> {new Date(viewing.departure_at).toLocaleString('en-PH')}</p>
                <p><span className="text-slate-500">Return:</span> {new Date(viewing.expected_return_at).toLocaleString('en-PH')}</p>
                <p className="sm:col-span-2"><span className="text-slate-500">Purpose:</span> {viewing.purpose}</p>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Timeline</h3>
                <ol className="space-y-2 border-l-2 border-palawan-200 pl-4">
                  {(viewing.timeline ?? []).map((t) => (
                    <li key={t.id}>
                      <p className="font-medium capitalize text-slate-800">{t.event.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-slate-500">{t.description} · {t.user?.name} · {t.created_at ? new Date(t.created_at).toLocaleString('en-PH') : ''}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {canApprove && viewing.status === 'pending_approval' && (
                  <>
                    <button type="button" className="btn-primary !rounded-full" onClick={() => actionMut.mutate({ id: viewing.id, action: 'approve' })}><Check size={16} /> Approve</button>
                    <button type="button" className="btn-secondary !rounded-full" onClick={() => {
                      const reason = window.prompt('Rejection reason');
                      if (reason) actionMut.mutate({ id: viewing.id, action: 'reject', reason });
                    }}><Ban size={16} /> Reject</button>
                  </>
                )}
                {canSchedule && viewing.status === 'scheduled' && (
                  <button type="button" className="btn-primary !rounded-full" onClick={() => actionMut.mutate({ id: viewing.id, action: 'start' })}><Play size={16} /> Start Trip</button>
                )}
                {canSchedule && viewing.status === 'ongoing' && (
                  <button type="button" className="btn-primary !rounded-full" onClick={() => actionMut.mutate({ id: viewing.id, action: 'complete' })}><Flag size={16} /> Complete</button>
                )}
                {canSchedule && !['completed', 'cancelled', 'rejected'].includes(viewing.status) && (
                  <button type="button" className="btn-secondary !rounded-full" onClick={() => {
                    const reason = window.prompt('Cancel reason (optional)') ?? undefined;
                    actionMut.mutate({ id: viewing.id, action: 'cancel', reason });
                  }}><Ban size={16} /> Cancel</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
