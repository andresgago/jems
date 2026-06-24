import { useState, useEffect } from 'react';
import { trucksService } from '../services/trucks';

export function useTruck(id) {
  const [truck, setTruck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    trucksService.get(id)
      .then(({ data }) => { if (!cancelled) setTruck(data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  return { truck, loading, error, refresh: () => setTick((t) => t + 1) };
}
