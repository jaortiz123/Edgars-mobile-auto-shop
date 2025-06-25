import React from 'react'
import type { Service } from '../services/api'

interface Props {
  service: Service
}

function ServiceCard({ service }: Props) {
  return (
    <li className="rounded border p-4">
      <h4 className="font-bold">{service.name}</h4>
      {service.description && <p>{service.description}</p>}
    </li>
  )
}

export default React.memo(ServiceCard)
