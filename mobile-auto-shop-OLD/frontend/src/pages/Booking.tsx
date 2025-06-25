import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, MapPin, User, Phone, Mail, Calendar, MessageSquare, Wrench, Sparkles, Star, ArrowRight } from 'lucide-react';
import {
  serviceAPI,
  type Service,
} from '../services/api';
import ErrorMessage from '../components/ErrorMessage';

// Extracted data arrays
const MOCK_SERVICES = [
  { 
    id: 1, 
    name: "Premium Oil Change", 
    description: "Full synthetic oil change with comprehensive multi-point inspection", 
    base_price: 75,
    duration_minutes: 45
  },
  { 
    id: 2, 
    name: "Brake System Service", 
    description: "Complete brake inspection, pad replacement, and system maintenance", 
    base_price: 150,
    duration_minutes: 90
  },
  { 
    id: 3, 
    name: "Battery Replacement", 
    description: "Professional battery installation with electrical system testing", 
    base_price: 120,
    duration_minutes: 45
  },
  { 
    id: 4, 
    name: "Tire Service", 
    description: "Tire rotation, balancing, and pressure optimization", 
    base_price: 65,
    duration_minutes: 60
  },
  { 
    id: 5, 
    name: "Engine Diagnostic", 
    description: "Advanced computer diagnostic scan and performance analysis", 
    base_price: 95,
    duration_minutes: 60
  },
  { 
    id: 6, 
    name: "Filter Replacement", 
    description: "Engine and cabin air filter replacement service", 
    base_price: 45,
    duration_minutes: 30
  }
];

const TRUST_INDICATORS = [
  { icon: CheckCircle, text: "Licensed & Insured", color: "text-light-blue" },
  { icon: Star, text: "5-Star Rated", color: "text-accent" },
  { icon: Wrench, text: "ASE Certified", color: "text-light-blue" }
];

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email('Please enter a valid email').optional(),
  address: z.string().min(1, 'Address is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Booking() {
  const navigate = useNavigate();
  
  // Mock data for testing since backend isn't running
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      try {
        const response = await serviceAPI.getAll();
        return response?.data || MOCK_SERVICES;
      } catch {
        return MOCK_SERVICES;
      }
    },
  });

  // Use mock data if API fails
  const displayServices = services || MOCK_SERVICES;

  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  useEffect(() => {
    const handler = () => {};
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  
  const selectService = useCallback((service: Service) => {
    setServiceId(service.id);
    setSelectedService(service);
    setStep(2);
  }, []);

  const goBack = useCallback(() => setStep(1), []);

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
      // Since backend isn't running, just simulate success
      setTimeout(() => {
        navigate('/confirmation', { 
          state: { 
            appointment: { 
              id: Math.floor(Math.random() * 1000),
              service_name: selectedService?.name,
              customer_name: values.name,
              date: values.date,
              time: values.time
            } 
          } 
        });
      }, 2000);
    } catch {
      alert('An error occurred while booking your appointment. Please try again.');
      setIsLoading(false);
    }
  }, [serviceId, navigate, selectedService]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-light via-white to-bg-light py-12">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center glass-card px-6 py-3 rounded-full mb-6">
            <Sparkles className="h-5 w-5 text-accent mr-3" />
            <span className="font-semibold text-navy">Professional Mobile Service</span>
          </div>
          <h1 className="hero-modern text-5xl md:text-6xl font-bold mb-4">
            Book Your Service
          </h1>
          <p className="text-body text-xl text-text-dark max-w-2xl mx-auto">
            Experience automotive care at your location with our expert technicians
          </p>
        </header>

        {/* Progress Indicator */}
        <nav className="flex items-center justify-center mb-16" aria-label="Booking progress">
          <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold transition-colors ${
            step >= 1 ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            1
          </div>
          <div className="mx-4 text-navy font-semibold">Select Service</div>
          <div className={`w-24 h-1 rounded transition-colors ${
            step >= 2 ? 'bg-accent' : 'bg-gray-200'
          }`}></div>
          <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold transition-colors ${
            step >= 2 ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            2
          </div>
          <div className="mx-4 text-navy font-semibold">Book Appointment</div>
        </nav>

        {step === 1 && (
          <section aria-labelledby="services-heading" className="animate-fadeInUp">
            <h2 id="services-heading" className="sr-only">Available Services</h2>
            
            {/* Loading state */}
            {servicesLoading && (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-light-blue mx-auto"></div>
                <p className="mt-6 text-text-dark text-lg">Loading services...</p>
              </div>
            )}

            {/* Services Grid */}
            {displayServices && displayServices.length > 0 && (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {displayServices.map((service: Service, index) => (
                  <article
                    key={service.id}
                    onClick={() => selectService(service)}
                    className="service-card cursor-pointer animate-fadeInUp"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="service-icon">
                      <Wrench className="h-8 w-8 text-navy" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-navy mb-3 group-hover:text-light-blue transition-colors">
                      {service.name}
                    </h3>
                    
                    {service.description && (
                      <p className="text-text-dark mb-4 leading-relaxed">
                        {service.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-gray mb-4">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>{service.duration_minutes ? `${service.duration_minutes} min` : "Professional service"}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      {service.base_price && (
                        <div>
                          <div className="text-2xl font-bold text-navy">
                            ${service.base_price}
                          </div>
                          <div className="text-xs text-gray">Starting price</div>
                        </div>
                      )}
                      <div className="btn-modern text-sm px-4 py-2 group-hover:scale-105">
                        Select
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="booking-form-heading" className="max-w-4xl mx-auto animate-fadeInUp">
            <h2 id="booking-form-heading" className="sr-only">Booking Form</h2>
            
            {/* Service Summary */}
            {selectedService && (
              <div className="glass-card rounded-2xl p-6 mb-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <button
                      onClick={goBack}
                      className="mr-6 p-2 rounded-lg hover:bg-white/50 transition-colors"
                      aria-label="Go back to service selection"
                    >
                      <ArrowLeft className="h-5 w-5 text-navy" />
                    </button>
                    <div>
                      <h3 className="text-xl font-bold text-navy">Selected Service</h3>
                      <p className="text-text-dark">{selectedService.name}</p>
                    </div>
                  </div>
                  {selectedService.base_price && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-accent">
                        ${selectedService.base_price}
                      </div>
                      <div className="text-sm text-gray">Starting price</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Booking Form */}
            <div className="floating-card">
              <h3 className="heading-display text-3xl font-bold text-navy mb-8 text-center">
                Complete Your Booking
              </h3>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label htmlFor="name" className="flex items-center text-lg font-semibold text-navy mb-3">
                      <User className="h-5 w-5 mr-3 text-light-blue" />
                      Full Name *
                    </label>
                    <input
                      id="name"
                      {...register('name')}
                      className="input-modern"
                      placeholder="Enter your full name"
                      aria-required="true"
                    />
                    <ErrorMessage message={errors.name?.message} />
                  </div>

                  <div>
                    <label htmlFor="phone" className="flex items-center text-lg font-semibold text-navy mb-3">
                      <Phone className="h-5 w-5 mr-3 text-light-blue" />
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      {...register('phone')}
                      className="input-modern"
                      placeholder="(555) 123-4567"
                    />
                    <ErrorMessage message={errors.phone?.message} />
                  </div>

                  <div>
                    <label htmlFor="email" className="flex items-center text-lg font-semibold text-navy mb-3">
                      <Mail className="h-5 w-5 mr-3 text-light-blue" />
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      {...register('email')}
                      className="input-modern"
                      placeholder="your@email.com"
                    />
                    <ErrorMessage message={errors.email?.message} />
                  </div>

                  <div>
                    <label htmlFor="address" className="flex items-center text-lg font-semibold text-navy mb-3">
                      <MapPin className="h-5 w-5 mr-3 text-light-blue" />
                      Service Address *
                    </label>
                    <input
                      id="address"
                      {...register('address')}
                      className="input-modern"
                      placeholder="Where should we come to service your vehicle?"
                      aria-required="true"
                    />
                    <ErrorMessage message={errors.address?.message} />
                  </div>

                  <div>
                    <label htmlFor="date" className="flex items-center text-lg font-semibold text-navy mb-3">
                      <Calendar className="h-5 w-5 mr-3 text-light-blue" />
                      Preferred Date *
                    </label>
                    <input
                      id="date"
                      type="date"
                      {...register('date')}
                      className="input-modern"
                      min={new Date().toISOString().split('T')[0]}
                      aria-required="true"
                    />
                    <ErrorMessage message={errors.date?.message} />
                  </div>

                  <div>
                    <label htmlFor="time" className="flex items-center text-lg font-semibold text-navy mb-3">
                      <Clock className="h-5 w-5 mr-3 text-light-blue" />
                      Preferred Time *
                    </label>
                    <input
                      id="time"
                      type="time"
                      {...register('time')}
                      className="input-modern"
                      aria-required="true"
                    />
                    <ErrorMessage message={errors.time?.message} />
                  </div>
                </div>

                <div>
                  <label htmlFor="notes" className="flex items-center text-lg font-semibold text-navy mb-3">
                    <MessageSquare className="h-5 w-5 mr-3 text-light-blue" />
                    Additional Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={4}
                    {...register('notes')}
                    className="input-modern resize-none"
                    placeholder="Any specific issues, vehicle details, or special instructions..."
                  />
                </div>

                {/* Trust Indicators */}
                <div className="glass-card p-6 rounded-xl">
                  <div className="flex items-center justify-center space-x-8 text-sm text-navy">
                    {TRUST_INDICATORS.map((indicator, index) => {
                      const IconComponent = indicator.icon;
                      return (
                        <div key={index} className="flex items-center">
                          <IconComponent className={`h-5 w-5 ${indicator.color} mr-2`} />
                          <span>{indicator.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-center pt-8">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-accent text-lg px-12 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                        Booking Your Service...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-6 w-6 mr-3" />
                        Confirm Booking
                        <ArrowRight className="h-5 w-5 ml-3" />
                      </>
                    )}
                  </button>
                  <p className="text-gray text-sm mt-4">
                    You'll receive a confirmation call within 15 minutes
                  </p>
                </div>
              </form>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}