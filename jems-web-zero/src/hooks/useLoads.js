import { useState, useEffect, useRef } from 'react';
import { loadsService } from '../services/loads';

export function useLoads(filters) {
  const [loads, setLoads] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
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
        if (cancelled) return;
        const results = Array.isArray(data) ? data : data.results || [];
        setLoads(results);
        setCount(Array.isArray(data) ? results.length : data.count || results.length);
        setNext(Array.isArray(data) ? null : data.next || null);
        setPrevious(Array.isArray(data) ? null : data.previous || null);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // filtersKey is a stable serialization of filters — re-fetch only on deep change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, tick]);

  return { loads, count, next, previous, loading, error, refresh: () => setTick((t) => t + 1) };
}
