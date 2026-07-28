import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import api from '../api/client';

const CATEGORY_IMAGES: Record<string, string> = {
  OS: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=280&fit=crop&q=80',
  EMG: 'https://images.unsplash.com/photo-1603398933177-aabec82617cc?w=400&h=280&fit=crop&q=80',
  ICT: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=400&h=280&fit=crop&q=80',
  FUR: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=400&h=280&fit=crop&q=80',
  MNT: 'https://images.unsplash.com/photo-1504148455326-0a5ba8e3c6b4?w=400&h=280&fit=crop&q=80',
  VEH: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=280&fit=crop&q=80',
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=400&h=280&fit=crop&q=80';

interface CatalogItemImageProps {
  itemId: number;
  hasPhoto?: boolean;
  categoryCode?: string;
  alt: string;
  className?: string;
}

export default function CatalogItemImage({ itemId, hasPhoto, categoryCode, alt, className }: CatalogItemImageProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const fallback = CATEGORY_IMAGES[categoryCode ?? ''] ?? DEFAULT_IMAGE;

    if (!hasPhoto) {
      setSrc(fallback);
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
        if (!cancelled) setSrc(fallback);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [itemId, hasPhoto, categoryCode]);

  const imageClass = className ?? 'h-24 w-full';

  if (!src) {
    return (
      <div className={`flex items-center justify-center rounded-lg bg-slate-100 text-slate-300 ${imageClass}`}>
        <Package size={24} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`rounded-lg object-cover ring-1 ring-slate-100 ${imageClass}`}
      loading="lazy"
      onError={() => setSrc(CATEGORY_IMAGES[categoryCode ?? ''] ?? DEFAULT_IMAGE)}
    />
  );
}
