import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, QrCode, X, Loader2 } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

interface SearchResult {
  id: number;
  type: 'inventory' | 'asset';
  title: string;
  subtitle: string;
  path: string;
}

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const debouncedQuery = useDebounce(query.trim(), 300);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const canSearchInventory = hasPermission('inventory.view');
  const canSearchAssets = hasPermission('assets.view');

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['global-search', debouncedQuery, canSearchInventory, canSearchAssets],
    enabled: open && debouncedQuery.length >= 2,
    queryFn: async (): Promise<SearchResult[]> => {
      const items: SearchResult[] = [];

      const fetches: Promise<void>[] = [];

      if (canSearchInventory) {
        fetches.push(
          api.get('/inventory', { params: { search: debouncedQuery, per_page: 8 } }).then(({ data }) => {
            for (const row of data.data ?? []) {
              items.push({
                id: row.id,
                type: 'inventory',
                title: row.name,
                subtitle: `${row.item_code} · ${row.category?.name ?? 'Inventory'}`,
                path: `/inventory?search=${encodeURIComponent(debouncedQuery)}`,
              });
            }
          }),
        );
      }

      if (canSearchAssets) {
        fetches.push(
          api.get('/assets', { params: { search: debouncedQuery, per_page: 8 } }).then(({ data }) => {
            for (const row of data.data ?? []) {
              items.push({
                id: row.id,
                type: 'asset',
                title: row.inventory_item?.name ?? row.property_number,
                subtitle: `${row.property_number} · ${row.department?.name ?? 'Asset'}`,
                path: `/assets?search=${encodeURIComponent(debouncedQuery)}`,
              });
            }
          }),
        );
      }

      await Promise.all(fetches);
      return items;
    },
  });

  const handleSelect = (result: SearchResult) => {
    onClose();
    navigate(result.path);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={onClose}>
      <div
        className="card-elevated w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search className="shrink-0 text-slate-400" size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search inventory, assets, codes..."
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          {isFetching && <Loader2 className="animate-spin text-slate-400" size={18} />}
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {debouncedQuery.length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">Type at least 2 characters to search</p>
          ) : results.length === 0 && !isFetching ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">No results for &ldquo;{debouncedQuery}&rdquo;</p>
          ) : (
            <ul className="space-y-1">
              {results.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      result.type === 'inventory' ? 'bg-palawan-50 text-palawan-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {result.type === 'inventory' ? <Package size={18} /> : <QrCode size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{result.title}</p>
                      <p className="truncate text-xs text-slate-500">{result.subtitle}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
          Press <kbd className="rounded bg-slate-100 px-1">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
