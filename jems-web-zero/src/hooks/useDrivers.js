import { useState, useEffect } from 'react';
import { driversService } from '../services/drivers';

export function useDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    driversService.list()
      .then(({ data }) => {
        if (!cancelled) setDrivers(Array.isArray(data) ? data : data.results || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  return { drivers, loading, error, refresh: () => setTick((t) => t + 1) };
}
