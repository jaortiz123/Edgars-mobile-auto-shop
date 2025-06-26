import React from 'react';
import type { Service } from '../services/api';
import ServiceCard from './ServiceCard';

interface Props {
  services: Service[];
  onSelect?: (service: Service) => void;
  displayPrice?: boolean;
}

function ServiceList({ services, onSelect, displayPrice = false }: Props) {
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <li key={s.id}>
          <ServiceCard service={s} onSelect={onSelect ? onSelect : () => {}} displayPrice={displayPrice} />
        </li>
      ))}
    </ul>
  );
}

export default ServiceList;