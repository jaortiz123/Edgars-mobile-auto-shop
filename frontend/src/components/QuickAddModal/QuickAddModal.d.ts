import React from 'react';

export interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (appointmentData: any) => void;
  customers?: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
  }>;
  services?: Array<{
    id: string;
    name: string;
    duration: number;
    price: number;
  }>;
  initialData?: {
    customerId?: string;
    serviceId?: string;
    date?: string;
    time?: string;
  };
}

declare const QuickAddModal: React.ComponentType<QuickAddModalProps>;
export default QuickAddModal;
