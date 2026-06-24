import { useState, useEffect } from 'react';
import { recordsService } from '../services/accounting';

export function useRecords(params) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    recordsService.list(params)
      .then(({ data }) => {
        if (!cancelled) setRecords(Array.isArray(data) ? data : data.results || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { records, loading, error, refresh: () => setTick((t) => t + 1) };
}
