import React from 'react'
import ServiceCard from '../components/ServiceCard'
import type { Service } from '../services/api'

interface Props {
  services: Service[]
  onSelect?: (id: number) => void
}

export default function ServiceList({ services, onSelect }: Props) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {services.map(s => (
        <li key={s.id}>
          <ServiceCard {...s} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}
