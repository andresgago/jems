import { useState, useEffect } from 'react';
import api from '../services/api';

export function useOptions(url) {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    api.get(url).then(r => setOptions(r.data)).catch(() => {});
  }, [url]);
  return options;
}
