interface AppointmentTemplate {
  id: string;
  name: string;
  fields: {
    serviceType: string;
    estimatedDuration: string;
  };
}

const defaultTemplates: AppointmentTemplate[] = [
  {
    id: 'oil-change',
    name: 'Oil Change',
    fields: {
      serviceType: 'Oil Change',
      estimatedDuration: '30 minutes',
    },
  },
  {
    id: 'tire-rotation',
    name: 'Tire Rotation',
    fields: {
      serviceType: 'Tire Rotation',
      estimatedDuration: '1 hour',
    },
  },
  {
    id: 'brake-service',
    name: 'Brake Service',
    fields: {
      serviceType: 'Brake Service',
      estimatedDuration: '2 hours',
    },
  },
];

export const getTemplates = (): Promise<AppointmentTemplate[]> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(defaultTemplates), 200);
  });
};

export const saveTemplate = (template: AppointmentTemplate): Promise<AppointmentTemplate> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // In a real app, you'd save to a backend or local storage
      console.log('Saving template:', template);
      resolve(template);
    }, 200);
  });
};
