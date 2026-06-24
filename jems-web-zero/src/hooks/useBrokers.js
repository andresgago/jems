import { useEffect, useState } from 'react'
import { brokersService } from '../services/brokers'

export function useBrokers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    brokersService
      .list()
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return { items, loading, reload: load }
}
