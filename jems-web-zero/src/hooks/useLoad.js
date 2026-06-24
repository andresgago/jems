import { useState, useEffect } from 'react';
import { loadsService } from '../services/loads';

export function useLoad(id) {
  const [load, setLoad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadsService.get(id)
      .then(({ data }) => { if (!cancelled) setLoad(data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  return { load, loading, error, refresh: () => setTick((t) => t + 1) };
}
