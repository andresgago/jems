import { useState, useEffect, useRef } from 'react';
import { loadsService } from '../services/loads';

export function useLoads(filters) {
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; });

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadsService.list(filtersRef.current)
      .then(({ data }) => {
        if (!cancelled) setLoads(Array.isArray(data) ? data : data.results || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // filtersKey is a stable serialization of filters — re-fetch only on deep change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, tick]);

  return { loads, loading, error, refresh: () => setTick((t) => t + 1) };
}
