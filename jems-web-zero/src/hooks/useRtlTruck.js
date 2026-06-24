import { useState, useEffect } from 'react';
import { rtlService } from '../services/rtl';

export function useRtlTruck(id) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    rtlService.getTruck(id)
      .then(({ data }) => { if (!cancelled) setItem(data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  return { item, loading, error, reload: () => setTick((t) => t + 1) };
}
