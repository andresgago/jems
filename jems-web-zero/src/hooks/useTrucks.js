import { useState, useEffect } from 'react';
import { trucksService } from '../services/trucks';

export function useTrucks() {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    trucksService.list()
      .then(({ data }) => {
        if (!cancelled) setTrucks(Array.isArray(data) ? data : data.results || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  return { trucks, loading, error, refresh: () => setTick((t) => t + 1) };
}
