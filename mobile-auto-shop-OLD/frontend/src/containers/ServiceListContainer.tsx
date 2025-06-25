import { useQuery } from '@tanstack/react-query'
import ServiceList from '../components/ServiceList'
import { serviceAPI, type Service } from '../services/api'

export default function ServiceListContainer() {
  const { data: services } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await serviceAPI.getAll()
      return response?.data || []
    },
  })

  if (!services) return null
  return <ServiceList services={services} />
}
