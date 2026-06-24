import { useState, useEffect } from 'react';
import { trailersService } from '../services/trailers';

export function useTrailers() {
  const [trailers, setTrailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    trailersService.list()
      .then(({ data }) => {
        if (!cancelled) setTrailers(Array.isArray(data) ? data : data.results || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  return { trailers, loading, error, refresh: () => setTick((t) => t + 1) };
}
