import { useQuery } from '@tanstack/react-query'
import ServiceList from '../components/ServiceList'
import { serviceAPI } from '../services/api'
import type { Service } from '../types/models'

export default function ServiceListContainer() {
  const { data: services } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await serviceAPI.getAll() as { data?: Service[] }
      return response?.data || []
    },
  })

  if (!services) return null
  return <ServiceList services={services} />
}
