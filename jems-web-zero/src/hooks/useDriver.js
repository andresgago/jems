import { useState, useEffect } from 'react';
import { driversService } from '../services/drivers';

export function useDriver(id) {
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    driversService.get(id)
      .then(({ data }) => { if (!cancelled) setDriver(data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  return { driver, loading, error, refresh: () => setTick((t) => t + 1) };
}
