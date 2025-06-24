import React, { useEffect, useState } from 'react'
import { serviceAPI, type Service } from '../services/api'
import ServiceList from '../presentation/ServiceList'

export default function ServiceListContainer() {
  const [services, setServices] = useState<Service[]>([])

  useEffect(() => {
    let mounted = true
    serviceAPI.getAll().then(({ data }) => {
      if (mounted) setServices(data)
    })
    return () => {
      mounted = false
    }
  }, [])

  return <ServiceList services={services} />
}
