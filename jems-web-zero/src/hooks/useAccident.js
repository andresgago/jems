import { useState, useEffect } from 'react';
import { accidentsService } from '../services/accidents';

export function useAccident(id) {
  const [accident, setAccident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    accidentsService.get(id)
      .then(({ data }) => { if (!cancelled) setAccident(data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  return { accident, loading, error, refresh: () => setTick((t) => t + 1) };
}
