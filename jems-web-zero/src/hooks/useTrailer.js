import { useState, useEffect } from 'react';
import { trailersService } from '../services/trailers';

export function useTrailer(id) {
  const [trailer, setTrailer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    trailersService.get(id)
      .then(({ data }) => { if (!cancelled) setTrailer(data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  return { trailer, loading, error, refresh: () => setTick((t) => t + 1) };
}
