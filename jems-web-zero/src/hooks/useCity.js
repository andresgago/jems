import { useState, useEffect } from 'react';
import { citiesService } from '../services/cities';

export function useCity(id) {
  const [city, setCity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    citiesService.get(id)
      .then(({ data }) => { if (!cancelled) setCity(data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  return { city, loading, error, reload: () => setTick((t) => t + 1) };
}
