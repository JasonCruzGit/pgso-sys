import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { X, MapPin, Package } from 'lucide-react';
import api from '../api/client';
import Badge from './Badge';
import InventoryItemPhoto from './InventoryItemPhoto';
import { getInventoryQrValue } from '../utils/inventoryQr';
import type { InventoryItem } from '../types';

interface InventoryItemModalProps {
  item: InventoryItem;
  onClose: () => void;
}

export default function InventoryItemModal({ item, onClose }: InventoryItemModalProps) {
  const { data: publicConfig } = useQuery({
    queryKey: ['system-public-url'],
    queryFn: () => api.get<{ frontend_url: string }>('/system/public-url').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const qrValue = getInventoryQrValue(item, publicConfig?.frontend_url);
  const totalValue = Number(item.quantity) * Number(item.unit_cost);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated flex max-h-[90vh] w-full max-w-2xl flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{item.name}</h2>
            <p className="font-mono text-sm text-palawan-700">{item.item_code}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <InventoryItemPhoto
                itemId={item.id}
                hasPhoto={item.has_photo ?? !!item.photo_path}
                alt={item.name}
                className="h-48 w-full"
              />
              <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <QRCodeSVG value={qrValue} size={120} level="M" />
                <p className="mt-3 text-center text-xs text-slate-500">Scan to identify this item</p>
                <p className="mt-1 font-mono text-sm font-semibold text-palawan-700">
                  {item.property_number ?? item.item_code}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge status={item.status} />
                <Badge status={item.condition} />
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  item.is_consumable !== false ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                }`}>
                  {item.is_consumable !== false ? 'Consumable' : 'Non-Consumable'}
                </span>
                {item.is_asset && (
                  <span className="rounded-full bg-palawan-50 px-2.5 py-0.5 text-xs font-semibold text-palawan-700">Government Asset</span>
                )}
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-slate-400">Property Number</dt>
                  <dd className="font-mono font-medium text-slate-900">{item.property_number ?? '—'}</dd>
                </div>
                {item.serial_number && (
                  <div>
                    <dt className="text-slate-400">Serial Number</dt>
                    <dd className="font-mono font-medium text-slate-900">{item.serial_number}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-slate-400">Categories</dt>
                  <dd className="font-medium text-slate-900">
                    {(item.categories?.length ? item.categories : (item.category ? [item.category] : []))
                      .map((c) => c.name)
                      .join(', ') || '—'}
                  </dd>
                  {item.category && (item.categories?.length ?? 0) > 1 && (
                    <p className="mt-1 text-xs text-slate-500">Primary: {item.category.name}</p>
                  )}
                </div>
                <div>
                  <dt className="text-slate-400">Quantity on Hand</dt>
                  <dd className="font-semibold text-slate-900">{Math.round(Number(item.quantity)) || 0} {item.unit_of_measure}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Reorder Level</dt>
                  <dd className="text-slate-900">{Math.round(Number(item.reorder_level)) || 0} {item.unit_of_measure}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Unit Cost</dt>
                  <dd className="text-slate-900">₱{Number(item.unit_cost).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Total Value</dt>
                  <dd className="font-semibold text-slate-900">₱{totalValue.toLocaleString()}</dd>
                </div>
                {item.description && (
                  <div>
                    <dt className="text-slate-400">Description</dt>
                    <dd className="text-slate-700">{item.description}</dd>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin size={14} className="text-slate-400" />
                  {item.storage_location ?? 'No location set'}
                </div>
                {item.date_acquired && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Package size={14} className="text-slate-400" />
                    Acquired {new Date(item.date_acquired).toLocaleDateString()}
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <button type="button" className="btn-secondary w-full" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
