import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { api } from '../api';

// The /portal/media/:id endpoint requires the Bearer token, which a plain
// <img src> can't send. Fetch it as a blob through the authed axios client
// instead and point the <img> at an object URL.
export default function PortalImage({
  photoId,
  alt,
  className,
}: {
  photoId: string | number | null | undefined;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(null);
    setFailed(false);
    if (!photoId) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    api
      .get(`/portal/media/${photoId}`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  if (!photoId || failed || !src) {
    return (
      <div
        className={
          className ||
          'flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-night-100 dark:text-slate-500'
        }
      >
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className || 'h-12 w-12 rounded-lg object-cover'} />;
}
