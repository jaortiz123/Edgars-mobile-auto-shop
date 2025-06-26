import React from 'react';
import type { Service } from '../services/api';
// This import now correctly matches the export from ServiceCard.tsx
import ServiceCard from './ServiceCard';

interface Props {
  services: Service[];
}

function ServiceList({ services }: Props) {
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <li key={s.id}>
          <ServiceCard service={s} />
        </li>
      ))}
    </ul>
  );
}

export default ServiceList;