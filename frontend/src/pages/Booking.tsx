import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, CheckCircle, Calendar, Clock, MapPin, User, Phone, Mail, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import ServiceCard from '../components/ServiceCard';
import { serviceAPI, type Service } from '../services/api';

const MOCK_SERVICES: Service[] = [
  { id: 1, name: "Premium Oil Change", description: "Full synthetic oil change with comprehensive multi-point inspection", base_price: 75, duration_minutes: 45 },
  { id: 2, name: "Brake System Service", description: "Complete brake inspection, pad replacement, and system maintenance", base_price: 150, duration_minutes: 90 },
  { id: 3, name: "Tire Service", description: "Tire rotation, balancing, and pressure optimization", base_price: 65, duration_minutes: 60 },
];

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().min(1, 'Address is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// A simple Input component for the form
const FormInput = ({ icon, label, id, error, ...props }: any) => {
    const Icon = icon;
    return (
        <div>
            <label htmlFor={id} className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <Icon className="h-4 w-4 mr-2 text-primary" />
                {label}
            </label>
            <input id={id} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" {...props} />
            {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
        </div>
    );
};


export default function Booking() {
  const navigate = useNavigate();
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => serviceAPI.getAll().then(res => res?.data ?? MOCK_SERVICES).catch(() => MOCK_SERVICES),
  });

  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectService = useCallback((service: Service) => {
    setSelectedService(service);
    setStep(2);
  }, []);

  const goBack = useCallback(() => {
    if (step === 2) {
      setSelectedService(null);
      setStep(1);
    }
  }, [step]);

  const onSubmit = useCallback(async (values: FormValues) => {
    if (!selectedService) return;
    setIsSubmitting(true);
    setTimeout(() => {
      navigate('/confirmation', { state: { appointment: { ...values, service_name: selectedService.name } } });
    }, 1500);
  }, [selectedService, navigate]);

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-800">Configure Your Service</h1>
        <p className="text-gray-600 mt-2">Professional automotive care delivered to your location.</p>
      </header>
      
      {/* Progress Indicator */}
      <nav className="flex items-center justify-center mb-16" aria-label="Booking progress">
        {[ { num: 1, label: 'Select Service'}, { num: 2, label: 'Enter Details' } ].map((item, index, arr) => (
          <>
            <div className="flex items-center flex-col">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold transition-colors ${step >= item.num ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > item.num ? <CheckCircle /> : item.num}
              </div>
              <p className="mt-2 text-sm font-semibold">{item.label}</p>
            </div>
            {index < arr.length - 1 && <div className={`flex-auto border-t-2 transition-colors mx-4 ${step > item.num ? 'border-primary' : 'border-gray-200'}`}></div>}
          </>
        ))}
      </nav>

      {/* Step Content */}
      <div className="animate-fadeInUp">
        {step === 1 && (
          <section>
            <h2 className="text-2xl font-bold text-center mb-8">Choose Your Service</h2>
            {servicesLoading ? <p className="text-center">Loading services...</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(services || MOCK_SERVICES).map(service => (
                   <div key={service.id} onClick={() => selectService(service)} className="cursor-pointer">
                       <ServiceCard service={service} />
                   </div>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 2 && selectedService && (
          <section>
            <button onClick={goBack} className="flex items-center text-sm font-semibold text-gray-600 hover:text-gray-800 mb-4">
              <ArrowLeft className="h-4 w-4 mr-2"/> Change Service
            </button>
            <Card>
              <CardHeader>
                <CardTitle>Book: {selectedService.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput icon={User} label="Full Name *" id="name" {...register('name')} error={errors.name} />
                    <FormInput icon={Phone} label="Phone Number" id="phone" {...register('phone')} error={errors.phone} />
                    <FormInput icon={Mail} label="Email Address" id="email" {...register('email')} error={errors.email} />
                    <FormInput icon={MapPin} label="Service Address *" id="address" {...register('address')} error={errors.address} />
                    <FormInput icon={Calendar} label="Preferred Date *" id="date" type="date" {...register('date')} error={errors.date} />
                    <FormInput icon={Clock} label="Preferred Time *" id="time" type="time" {...register('time')} error={errors.time} />
                  </div>
                  <div>
                    <label htmlFor="notes" className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                        <MessageSquare className="h-4 w-4 mr-2 text-primary" />
                        Additional Notes
                    </label>
                    <textarea id="notes" rows={4} {...register('notes')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Booking...' : `Confirm Booking for $${selectedService.base_price}`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}