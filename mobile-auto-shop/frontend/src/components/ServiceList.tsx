import React from 'react'
import type { Service } from '../services/api'
import ServiceCard from './ServiceCard'

interface Props {
  services: Service[]
}

function ServiceList({ services }: Props) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {services.map((s) => (
        <ServiceCard key={s.id} service={s} />
      ))}
    </ul>
  )
}

export default React.memo(ServiceList)
