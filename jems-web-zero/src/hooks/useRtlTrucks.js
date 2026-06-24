import { useState, useEffect } from 'react';
import { rtlService } from '../services/rtl';

export function useRtlTrucks() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    rtlService.listTrucks()
      .then(({ data }) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : data.results || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  return { items, loading, error, reload: () => setTick((t) => t + 1) };
}
