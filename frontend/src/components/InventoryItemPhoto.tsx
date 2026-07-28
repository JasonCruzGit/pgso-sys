import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import api from '../api/client';

interface InventoryItemPhotoProps {
  itemId: number;
  hasPhoto?: boolean;
  alt: string;
  className?: string;
}

export default function InventoryItemPhoto({ itemId, hasPhoto, alt, className = '' }: InventoryItemPhotoProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPhoto) {
      setSrc(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    api.get(`/inventory/${itemId}/photo`, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [itemId, hasPhoto]);

  if (!hasPhoto || !src) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ${className}`}>
        <ImageIcon size={32} strokeWidth={1.5} />
        <span className="mt-2 text-xs">No photo</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`rounded-2xl object-cover ring-1 ring-slate-100 ${className}`}
    />
  );
}
