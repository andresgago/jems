import { useState, useEffect } from 'react';
import { recordsService } from '../services/accounting';

export function useRecord(id) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    recordsService.get(id)
      .then(({ data }) => { if (!cancelled) setRecord(data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  return { record, loading, error, refresh: () => setTick((t) => t + 1) };
}
