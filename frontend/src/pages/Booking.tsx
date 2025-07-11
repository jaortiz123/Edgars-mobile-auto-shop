// /frontend/src/pages/Booking.tsx

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// --- PURGED: Old API imports like useQuery, serviceAPI ---
// --- FORGED: Import the new, correct API service and payload type ---
import { createAppointment, AppointmentPayload } from '../services/apiService';

// --- RE-PURPOSED: UI imports remain valid ---
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import ServiceCard from '../components/ServiceCard'; // Assuming ServiceCard is still needed for rendering

// --- MOCKED DATA: Defined here directly, as we are no longer fetching from an API ---
export interface Service {
  id: number;
  name: string;
  description: string;
  base_price: number;
  category: string;
}
const MOCK_SERVICES: Service[] = [
  { id: 1, name: "Emergency Battery Replacement", description: "On-site testing and replacement.", base_price: 180, category: 'Emergency' },
  { id: 2, name: "Emergency Brake Service", description: "Critical brake pad and rotor replacement for safety.", base_price: 250, category: 'Emergency' },
  { id: 3, name: "Check Engine Light Scan", description: "Advanced OBD-II diagnostics.", base_price: 95, category: 'Diagnostics' },
  { id: 4, name: "AC System Diagnostics", description: "Full system check for leaks and performance issues.", base_price: 120, category: 'Diagnostics' },
  { id: 5, name: "Premium Oil Change", description: "Full synthetic oil change.", base_price: 75, category: 'Maintenance' },
  { id: 6, name: "Fleet Vehicle Inspection", description: "Comprehensive inspection for your business vehicles.", base_price: 100, category: 'Fleet' },
];


// Form schema remains the same
const schema = z.object({
  name: z.string().min(1, 'Full Name is required'), // Changed label to match UI
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().min(1, 'Service Address is required'), // Changed label to match UI
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function Booking() {
  const navigate = useNavigate();
  
  // --- PURGED: useQuery hook and isLoading state from old API ---
  const services = MOCK_SERVICES; // Use mock data directly
  const isLoading = false; // Always false as services are hardcoded

  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  
  // States for API interaction
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleSelectService = useCallback((service: Service) => {
    setSelectedService(service);
    setApiError(null); // Clear previous errors when selecting a new service
    setStep(2);
  }, []);

  const goBack = useCallback(() => setStep(1), []);
  
  // --- RE-FORGED: The onSubmit function now connects to the live API ---
  const onSubmit = useCallback(async (values: FormValues) => {
    if (!selectedService) return;
    
    setIsSubmitting(true);
    setApiError(null); // Clear any previous API errors

    try {
      // 1. Data Transformation: Create the correct payload for the API.
      const requested_time = new Date(`${values.date}T${values.time}`).toISOString();
      const appointmentPayload: AppointmentPayload = {
        customer_id: values.name, // Using customer name as a temporary ID for the backend
        service: selectedService.name,
        requested_time: requested_time,
      };

      // 2. API Call: Send the payload to our live, hardened service.
      await createAppointment(appointmentPayload);

      // 3. Success: Navigate to the confirmation page.
      navigate('/confirmation', { 
        state: { 
          appointment: { 
            ...values, 
            service_name: selectedService.name,
            customer_id: values.name, // Ensure customer_id is passed to confirmation if needed
            service: selectedService.name, // Ensure service name is passed to confirmation if needed
            requested_time: requested_time // Ensure exact time is passed if needed
          } 
        } 
      });

    } catch (err) {
      // 4. Failure: Capture and display the error message.
      const message = err instanceof Error ? err.message : 'An unknown error occurred during booking.';
      setApiError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedService, navigate]);

  // Group services by category for display
  const servicesByCategory = (services || []).reduce((acc: Record<string, Service[]>, service) => {
    const category = service.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {});

  // The JSX remains largely the same, with the addition of the apiError display.
  return (
    <div className="container mx-auto max-w-5xl py-16 px-4">
        {/* Progress Indicator */}
        <div className="mb-12">
            <ol className="flex items-center w-full">
                <li className="flex w-full items-center text-accent after:content-[''] after:w-full after:h-1 after:border-b after:border-border after:border-4 after:inline-block">
                    <div className="flex flex-col items-center text-center">
                        <span className="flex items-center justify-center w-10 h-10 bg-accent text-accent-foreground rounded-full shrink-0">1</span>
                        <span className="font-medium mt-2">Select Service</span>
                    </div>
                </li>
                <li className="flex w-full items-center after:content-[''] after:w-full after:h-1 after:border-b after:border-border after:border-4 after:inline-block">
                    <div className="flex flex-col items-center text-center">
                        <span className="flex items-center justify-center w-10 h-10 bg-secondary text-secondary-foreground rounded-full shrink-0">2</span>
                        <span className="font-medium text-muted-foreground mt-2">Your Details</span>
                    </div>
                </li>
                <li className="flex items-center">
                     <div className="flex flex-col items-center text-center">
                        <span className="flex items-center justify-center w-10 h-10 bg-secondary text-secondary-foreground rounded-full shrink-0">3</span>
                        <span className="font-medium text-muted-foreground mt-2">Confirmation</span>
                    </div>
                </li>
            </ol>
             <div className="grid grid-cols-3 mt-2 text-center text-sm font-medium text-primary">
                <span>Select Service</span>
                <span>Your Details</span>
                <span>Confirmation</span>
            </div>
        </div>

        {/* Step 1: Service Selection */}
        {step === 1 && (
            <section>
                {/* --- PURGED: isLoading check. Services load instantly now. --- */}
                <div className="space-y-16">
                    {Object.entries(servicesByCategory).map(([category, serviceItems]) => (
                        <div key={category}>
                            <h2 className="text-center text-3xl font-bold text-primary mb-12 border-b pb-4">
                                {category} Services
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {(services || []).map(service => (
                                    <div key={service.id} onClick={() => handleSelectService(service)} className="cursor-pointer">
                                        <ServiceCard service={service} onSelect={handleSelectService} displayPrice={true} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        )}

        {/* Step 2: Details Form */}
        {step === 2 && selectedService && (
            <section>
                 <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground mb-4">
                        <span className="text-2xl font-bold">2</span>
                    </div>
                    <h2 className="text-3xl font-bold text-primary">Enter Your Details</h2>
                </div>
                
                <Card className="max-w-3xl mx-auto">
                    <CardHeader>
                        <button onClick={goBack} className="flex items-center text-sm font-semibold text-muted-foreground hover:text-primary mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2"/> Change Service
                        </button>
                        <CardTitle>Book: {selectedService.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="flex items-center text-sm font-semibold text-foreground mb-2">
                                        Full Name *
                                    </label>
                                    <input {...register('name')} className="w-full px-3 py-2 border rounded-md" />
                                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                                </div>
                                <div>
                                    <label className="flex items-center text-sm font-semibold text-foreground mb-2">
                                        Phone Number
                                    </label>
                                    <input {...register('phone')} className="w-full px-3 py-2 border rounded-md" />
                                </div>
                                <div>
                                    <label className="flex items-center text-sm font-semibold text-foreground mb-2">
                                        Email Address
                                    </label>
                                    <input {...register('email')} type="email" className="w-full px-3 py-2 border rounded-md" />
                                </div>
                                <div>
                                    <label className="flex items-center text-sm font-semibold text-foreground mb-2">
                                        Service Address *
                                    </label>
                                    <input {...register('address')} className="w-full px-3 py-2 border rounded-md" />
                                    {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
                                </div>
                                <div>
                                    <label className="flex items-center text-sm font-semibold text-foreground mb-2">
                                        Preferred Date *
                                    </label>
                                    <input {...register('date')} type="date" className="w-full px-3 py-2 border rounded-md" />
                                    {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
                                </div>
                                <div>
                                    <label className="flex items-center text-sm font-semibold text-foreground mb-2">
                                        Preferred Time *
                                    </label>
                                    <input {...register('time')} type="time" className="w-full px-3 py-2 border rounded-md" />
                                    {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time.message}</p>}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center text-sm font-semibold text-foreground mb-2">
                                    Additional Notes
                                </label>
                                <textarea {...register('notes')} rows={4} className="w-full px-3 py-2 border rounded-md" />
                            </div>
                            {apiError && (
                                <div className="p-3 text-center bg-destructive text-destructive-foreground rounded-md">
                                    <p><strong>Booking Failed:</strong> {apiError}</p>
                                </div>
                            )}
                            <Button type="submit" size="lg" className="w-full bg-accent text-accent-foreground" disabled={isSubmitting}>
                                {isSubmitting ? 'Booking...' : `Confirm Booking for $${selectedService.base_price}`}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </section>
        )}
    </div>
  );
}