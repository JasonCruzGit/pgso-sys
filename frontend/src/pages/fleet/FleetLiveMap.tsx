import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2, RefreshCw, Search, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import Badge from '../../components/Badge';
import type { FleetVehicle } from '../../types';
import 'leaflet/dist/leaflet.css';

const defaultCenter: [number, number] = [9.7392, 118.7353];

function vehicleIcon(status: string) {
  const color =
    status === 'moving' ? '#059669'
      : status === 'idle' ? '#d97706'
        : status === 'parked' ? '#0284c7'
          : '#94a3b8';

  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M5 17h14v-5H5v5Zm1-7h12l1.5 3H4.5L6 10Zm-1 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm14 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitBounds({ vehicles }: { vehicles: FleetVehicle[] }) {
  const map = useMap();
  useEffect(() => {
    const points = vehicles
      .filter((v) => v.last_latitude != null && v.last_longitude != null)
      .map((v) => [Number(v.last_latitude), Number(v.last_longitude)] as [number, number]);
    if (points.length === 0) {
      map.setView(defaultCenter, 13);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [vehicles, map]);
  return null;
}

export default function FleetLiveMap() {
  const [search, setSearch] = useState('');
  const [motionFilter, setMotionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<FleetVehicle | null>(null);
  const [routeDate, setRouteDate] = useState(new Date().toISOString().slice(0, 10));
  const [fullscreen, setFullscreen] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['fleet-live-map', search, motionFilter, typeFilter],
    queryFn: () => api.get('/fleet/vehicles/live', {
      params: {
        refresh_simulated: true,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(motionFilter ? { motion_status: motionFilter } : {}),
        ...(typeFilter ? { vehicle_type: typeFilter } : {}),
      },
    }).then((r) => r.data.data as FleetVehicle[]),
    refetchInterval: 15000,
  });

  const vehicles = data ?? [];

  const { data: routeHistory } = useQuery({
    queryKey: ['fleet-route', selected?.id, routeDate],
    queryFn: () => api.get(`/fleet/vehicles/${selected!.id}/route-history`, {
      params: { date: routeDate },
    }).then((r) => r.data as {
      positions: Array<{ latitude: number; longitude: number; is_stop?: boolean; ignition?: string; recorded_at: string }>;
      total_distance_km: number;
      total_travel_minutes: number;
      stops: unknown[];
    }),
    enabled: !!selected,
  });

  const path = useMemo(
    () => (routeHistory?.positions ?? []).map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number]),
    [routeHistory],
  );

  return (
    <div className={`space-y-4 ${fullscreen ? 'fixed inset-0 z-50 bg-white p-4' : ''}`}>
      <PageHeader
        title="Live Vehicle Map"
        description="Real-time GPS locations of provincial fleet vehicles"
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} /> Refresh
            </button>
            <button type="button" className="btn-secondary" onClick={() => setFullscreen((v) => !v)}>
              <Maximize2 size={16} /> {fullscreen ? 'Exit' : 'Fullscreen'}
            </button>
          </div>
        )}
      />

      <div className="card grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className="input-field w-full !pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plate, name, driver..." />
        </div>
        <select className="input-field" value={motionFilter} onChange={(e) => setMotionFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="moving">Active / Moving</option>
          <option value="idle">Idle</option>
          <option value="parked">Parked</option>
          <option value="offline">Offline</option>
        </select>
        <select className="input-field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {['sedan', 'van', 'pickup', 'truck', 'motorcycle', 'bus', 'utility'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className={`relative grid gap-4 ${selected ? 'lg:grid-cols-[1fr_22rem]' : ''}`}>
        <div className={`overflow-hidden rounded-2xl border border-slate-200 ${fullscreen ? 'h-[calc(100vh-10rem)]' : 'h-[65vh] min-h-[420px]'}`}>
          <MapContainer center={defaultCenter} zoom={13} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds vehicles={vehicles} />
            {vehicles.map((v) => {
              if (v.last_latitude == null || v.last_longitude == null) return null;
              return (
                <Marker
                  key={v.id}
                  position={[Number(v.last_latitude), Number(v.last_longitude)]}
                  icon={vehicleIcon(v.motion_status)}
                  eventHandlers={{ click: () => setSelected(v) }}
                >
                  <Popup>
                    <div className="min-w-[160px] text-sm">
                      <p className="font-bold">{v.plate_number}</p>
                      <p>{v.name}</p>
                      <p className="text-xs text-slate-500">{v.driver?.name ?? 'Unassigned'} · {v.last_speed ?? 0} km/h</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {path.length > 1 && <Polyline positions={path} pathOptions={{ color: '#0f766e', weight: 4 }} />}
          </MapContainer>
        </div>

        {selected && (
          <aside className="card max-h-[65vh] overflow-y-auto p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-bold text-palawan-700">{selected.plate_number}</p>
                <h3 className="text-lg font-semibold text-slate-900">{selected.name}</h3>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <Badge status={selected.motion_status} />
              <Badge status={selected.gps_status === 'online' ? 'available' : 'offline'} />
            </div>

            <dl className="space-y-2 text-sm">
              {[
                ['Type', selected.vehicle_type],
                ['Driver', selected.driver?.name ?? '—'],
                ['Speed', `${Number(selected.last_speed ?? 0)} km/h`],
                ['Engine', selected.engine_status ?? '—'],
                ['GPS Update', selected.last_gps_at ? new Date(selected.last_gps_at).toLocaleString('en-PH') : '—'],
                ['Coordinates', selected.last_latitude != null ? `${Number(selected.last_latitude).toFixed(5)}, ${Number(selected.last_longitude).toFixed(5)}` : '—'],
                ['Address', selected.last_address ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2 border-b border-slate-50 pb-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>

            {selected.active_trip && (
              <div className="mt-4 rounded-xl bg-palawan-50 p-3 text-sm">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-palawan-700">Active / Upcoming Trip</p>
                <p className="font-medium text-slate-900">{selected.active_trip.destination}</p>
                <p className="text-xs text-slate-600">{selected.active_trip.purpose}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {selected.active_trip.requester?.name ?? '—'} · {selected.active_trip.department?.name}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(selected.active_trip.departure_at).toLocaleString('en-PH')} → {new Date(selected.active_trip.expected_return_at).toLocaleString('en-PH')}
                </p>
                <div className="mt-2"><Badge status={selected.active_trip.status} /></div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-slate-700">Route History Date</label>
              <input type="date" className="input-field w-full" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} />
              {routeHistory && (
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <p>Distance: <strong>{routeHistory.total_distance_km} km</strong></p>
                  <p>Travel time: <strong>{routeHistory.total_travel_minutes} min</strong></p>
                  <p>Stops: <strong>{routeHistory.stops?.length ?? 0}</strong></p>
                  <p>Points: <strong>{routeHistory.positions?.length ?? 0}</strong></p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
