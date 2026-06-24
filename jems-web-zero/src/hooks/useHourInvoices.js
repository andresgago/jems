import { useState, useEffect } from 'react';
import { hourInvoicesService } from '../services/dispatch';

export function useHourInvoices(params) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    hourInvoicesService.list(params)
      .then(({ data }) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : data.results || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { items, loading, error, reload: () => setTick((t) => t + 1) };
}
