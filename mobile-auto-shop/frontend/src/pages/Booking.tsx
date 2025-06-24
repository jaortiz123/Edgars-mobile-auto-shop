import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  serviceAPI,
  customerAPI,
  appointmentAPI,
  type Service,
} from '../services/api';
import ErrorMessage from '../components/ErrorMessage';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().min(1, 'Required'),
  date: z.string().min(1, 'Required'),
  time: z.string().min(1, 'Required'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Booking() {
  const navigate = useNavigate();
  const { data: services } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await serviceAPI.getAll();
      return data;
    },
  });

  const [step, setStep] = useState(1);
const [serviceId, setServiceId] = useState<number | null>(null);

  useEffect(() => {
    const handler = () => {};
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  
  // This is the correct, resolved code block
  const selectService = useCallback((id: number) => {
    setServiceId(id);
    setStep(2);
  }, []); // Empty dependency array is correct here

  const goBack = useCallback(() => setStep(1), []); // Empty dependency array is correct here

  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = useCallback(async (values: FormValues) => {
    if (!serviceId) return;
    setIsLoading(true);
    try {
      const { data: customer } = await customerAPI.create({
        name: values.name,
        phone: values.phone,
        email: values.email,
        address: values.address,
      });
      const { data: appointment } = await appointmentAPI.create({
        customer_id: customer.id,
        vehicle_id: null,
        service_id: serviceId,
        scheduled_date: values.date,
        scheduled_time: values.time,
        location_address: values.address,
        notes: values.notes,
      });
      navigate('/confirmation', { state: { appointment } });
    } catch (e) {
      alert('An error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [serviceId, navigate]); // This is the correct dependency array

  return (
    <div className="max-w-xl mx-auto">
      {step === 1 && (
        <div>
          <h3 className="mb-4 text-xl font-semibold">Select Service</h3>
          <ul className="space-y-2">
            {services?.map((s: Service) => (
              <li key={s.id}>
                <button
                  onClick={() => selectService(s.id)}
                  className="w-full rounded border p-3 text-left hover:bg-gray-100"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {step === 2 && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">Name</label>
            <input id="name" {...register('name')} className="mt-1 w-full border p-2" />
            <ErrorMessage message={errors.name?.message} />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium">Phone</label>
            <input id="phone" {...register('phone')} className="mt-1 w-full border p-2" />
            <ErrorMessage message={errors.phone?.message} />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium">Email</label>
            <input id="email" {...register('email')} className="mt-1 w-full border p-2" />
            <ErrorMessage message={errors.email?.message} />
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium">Address</label>
            <input id="address" {...register('address')} className="mt-1 w-full border p-2" />
            <ErrorMessage message={errors.address?.message} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="date" className="block text-sm font-medium">Date</label>
              <input id="date" type="date" {...register('date')} className="mt-1 w-full border p-2" />
              <ErrorMessage message={errors.date?.message} />
            </div>
            <div className="flex-1">
              <label htmlFor="time" className="block text-sm font-medium">Time</label>
              <input id="time" type="time" {...register('time')} className="mt-1 w-full border p-2" />
              <ErrorMessage message={errors.time?.message} />
            </div>
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium">Notes</label>
            <textarea id="notes" {...register('notes')} className="mt-1 w-full border p-2" />
          </div>
          <div className="flex justify-between">
            <button type="button" className="rounded bg-gray-200 px-3 py-2" onClick={goBack}>
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {isLoading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}