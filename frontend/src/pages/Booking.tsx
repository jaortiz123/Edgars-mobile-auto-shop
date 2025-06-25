import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, MapPin, User, Phone, Mail, Calendar, MessageSquare, Wrench, Sparkles, Star, ArrowRight, Shield, Award, Timer, Calculator, ChevronRight, Zap } from 'lucide-react';
import {
  serviceAPI,
  type Service,
} from '../services/api';
import ErrorMessage from '../components/ErrorMessage';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  address: z.string().min(1, 'Address is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// Enhanced premium service data with tier information
const PREMIUM_SERVICES = [
  { 
    id: 1, 
    name: "Premium Oil Change", 
    description: "Full synthetic oil change with comprehensive multi-point inspection", 
    base_price: 75,
    duration_minutes: 45,
    tier: "essential",
    features: ["Full Synthetic Oil", "Multi-Point Inspection", "Filter Replacement"],
    popularity: 95
  },
  { 
    id: 2, 
    name: "Brake System Service", 
    description: "Complete brake inspection, pad replacement, and system maintenance", 
    base_price: 150,
    duration_minutes: 90,
    tier: "advanced",
    features: ["Brake Inspection", "Pad Replacement", "System Flush"],
    popularity: 88
  },
  { 
    id: 3, 
    name: "Battery Replacement", 
    description: "Professional battery installation with electrical system testing", 
    base_price: 120,
    duration_minutes: 45,
    tier: "essential",
    features: ["New Battery", "System Testing", "Terminal Cleaning"],
    popularity: 82
  },
  { 
    id: 4, 
    name: "Tire Service", 
    description: "Tire rotation, balancing, and pressure optimization", 
    base_price: 65,
    duration_minutes: 60,
    tier: "essential",
    features: ["Rotation", "Balancing", "Pressure Check"],
    popularity: 90
  },
  { 
    id: 5, 
    name: "Engine Diagnostic", 
    description: "Advanced computer diagnostic scan and performance analysis", 
    base_price: 95,
    duration_minutes: 60,
    tier: "advanced",
    features: ["Computer Scan", "Performance Analysis", "Error Codes"],
    popularity: 75
  },
  { 
    id: 6, 
    name: "Filter Replacement", 
    description: "Engine and cabin air filter replacement service", 
    base_price: 45,
    duration_minutes: 30,
    tier: "essential",
    features: ["Engine Filter", "Cabin Filter", "Quality Check"],
    popularity: 85
  }
];

const SERVICE_TIERS = {
  essential: { 
    name: "Essential Care", 
    color: "from-blue-500 to-light-blue", 
    icon: Shield,
    badge: "Most Popular"
  },
  advanced: { 
    name: "Advanced Service", 
    color: "from-purple-600 to-accent", 
    icon: Award,
    badge: "Professional"
  },
  premium: { 
    name: "Premium Plus", 
    color: "from-gold-500 to-amber-400", 
    icon: Star,
    badge: "Elite"
  }
};

const TRUST_INDICATORS = [
  { icon: CheckCircle, text: "Licensed & Insured", color: "text-light-blue" },
  { icon: Star, text: "5-Star Rated", color: "text-accent" },
  { icon: Wrench, text: "ASE Certified", color: "text-light-blue" },
  { icon: Shield, text: "Satisfaction Guaranteed", color: "text-accent" }
];

const TIME_SLOTS = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", 
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", 
  "4:00 PM", "5:00 PM"
];

export default function Booking() {
  const navigate = useNavigate();
  
  // Enhanced state management for 3-step process
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [estimatedTotal, setEstimatedTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Enhanced service query with fallback
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      try {
        const response = await serviceAPI.getAll();
        return response?.data || PREMIUM_SERVICES;
      } catch {
        return PREMIUM_SERVICES;
      }
    },
  });

  const displayServices = services || PREMIUM_SERVICES;

  // Form management
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Watch form values for real-time updates
  const watchedDate = watch('date');

  // Enhanced effects for premium interactions
  useEffect(() => {
    if (selectedService) {
      setEstimatedTotal(selectedService.base_price || 0);
    }
  }, [selectedService]);

  useEffect(() => {
    const handler = () => {};
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Enhanced callbacks for step management
  const selectService = useCallback((service: Service) => {
    setServiceId(service.id);
    setSelectedService(service);
    setStep(2);
  }, []);

  const proceedToBooking = useCallback(() => {
    if (selectedTimeSlot) {
      setStep(3);
    }
  }, [selectedTimeSlot]);

  const goBack = useCallback(() => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }, [step]);

  // Enhanced form submission
  const onSubmit = useCallback(async (values: FormValues) => {
    if (!serviceId || !selectedTimeSlot) return;
    
    setIsLoading(true);
    try {
      // Simulate API call with enhanced data
      setTimeout(() => {
        navigate('/confirmation', { 
          state: { 
            appointment: { 
              id: Math.floor(Math.random() * 10000),
              service_name: selectedService?.name,
              customer_name: values.name,
              date: values.date,
              time: selectedTimeSlot,
              address: values.address,
              estimated_total: estimatedTotal,
              duration: selectedService?.duration_minutes
            } 
          } 
        });
      }, 2000);
    } catch {
      alert('An error occurred while booking your appointment. Please try again.');
      setIsLoading(false);
    }
  }, [serviceId, selectedTimeSlot, navigate, selectedService, estimatedTotal]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-light via-white to-bg-light relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-light-blue/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
        
        {/* Enhanced Header */}
        <header className="text-center mb-16">
          <div className="inline-flex items-center glass-card px-8 py-4 rounded-full mb-8">
            <Sparkles className="h-6 w-6 text-accent mr-3 animate-pulse" />
            <span className="font-bold text-navy text-lg">Premium Mobile Service Experience</span>
          </div>
          <h1 className="hero-modern text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-navy via-light-blue to-accent bg-clip-text text-transparent">
            Configure Your Service
          </h1>
          <p className="text-body text-xl text-text-dark max-w-3xl mx-auto leading-relaxed">
            Professional automotive care delivered to your location with our signature 3-step booking experience
          </p>
        </header>

        {/* Enhanced Progress Indicator */}
        <nav className="flex items-center justify-center mb-20" aria-label="Booking progress">
          {[1, 2, 3].map((stepNumber, index) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`relative flex items-center justify-center w-16 h-16 rounded-full font-bold text-lg transition-all duration-500 ${
                step >= stepNumber 
                  ? 'bg-gradient-to-r from-accent to-light-blue text-white shadow-lg scale-110' 
                  : 'bg-white border-2 border-gray-200 text-gray-400'
              }`}>
                {step > stepNumber ? (
                  <CheckCircle className="h-8 w-8" />
                ) : (
                  stepNumber
                )}
                {step === stepNumber && (
                  <div className="absolute -inset-2 bg-gradient-to-r from-accent to-light-blue rounded-full opacity-20 animate-pulse"></div>
                )}
              </div>
              
              <div className="mx-6 text-center">
                <div className="font-bold text-navy text-lg">
                  {stepNumber === 1 && "Select Service"}
                  {stepNumber === 2 && "Choose Date & Time"}
                  {stepNumber === 3 && "Complete Booking"}
                </div>
                <div className="text-gray text-sm mt-1">
                  {stepNumber === 1 && "Pick your service"}
                  {stepNumber === 2 && "Schedule appointment"}
                  {stepNumber === 3 && "Enter details"}
                </div>
              </div>

              {index < 2 && (
                <div className={`w-32 h-2 rounded-full transition-colors duration-500 ${
                  step > stepNumber ? 'bg-gradient-to-r from-accent to-light-blue' : 'bg-gray-200'
                }`}></div>
              )}
            </div>
          ))}
        </nav>

        {/* Step 1: Service Selection */}
        {step === 1 && (
          <section aria-labelledby="services-heading" className="animate-fadeInUp">
            <h2 id="services-heading" className="text-center text-4xl font-bold text-navy mb-12">
              Choose Your Service
            </h2>
            
            {/* Service Categories */}
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-12">
              {Object.entries(SERVICE_TIERS).map(([key, tier]) => {
                const tierServices = displayServices.filter((s: any) => s.tier === key);
                const IconComponent = tier.icon;
                
                return (
                  <div key={key} className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:scale-105 transition-transform duration-300">
                    <div className={`absolute inset-0 bg-gradient-to-br ${tier.color} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <IconComponent className="h-8 w-8 text-navy" />
                        {tier.badge && (
                          <span className="bg-accent text-white px-3 py-1 rounded-full text-xs font-bold">
                            {tier.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-navy mb-2">{tier.name}</h3>
                      <p className="text-gray text-sm mb-4">
                        {tierServices.length} services available
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Loading state */}
            {servicesLoading && (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-light-blue mx-auto"></div>
                <p className="mt-8 text-text-dark text-xl">Loading premium services...</p>
              </div>
            )}

            {/* Enhanced Services Grid */}
            {displayServices && displayServices.length > 0 && (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {displayServices.map((service: any, index: number) => {
                  const tier = SERVICE_TIERS[service.tier as keyof typeof SERVICE_TIERS];
                  
                  return (
                    <article
                      key={service.id}
                      onClick={() => selectService(service)}
                      className="group cursor-pointer relative overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {/* Popularity indicator */}
                      {service.popularity > 85 && (
                        <div className="absolute top-4 right-4 z-20">
                          <span className="bg-accent text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                            <Star className="h-3 w-3 mr-1" />
                            Popular
                          </span>
                        </div>
                      )}

                      {/* Gradient overlay */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${tier.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                      
                      <div className="relative z-10 p-8">
                        {/* Service icon */}
                        <div className="mb-6">
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-bg-light to-white flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                            <Wrench className="h-8 w-8 text-navy group-hover:text-light-blue transition-colors" />
                          </div>
                        </div>
                        
                        <h3 className="text-2xl font-bold text-navy mb-3 group-hover:text-light-blue transition-colors">
                          {service.name}
                        </h3>
                        
                        <p className="text-text-dark mb-6 leading-relaxed">
                          {service.description}
                        </p>

                        {/* Features list */}
                        {service.features && (
                          <ul className="space-y-2 mb-6">
                            {service.features.slice(0, 3).map((feature: string, idx: number) => (
                              <li key={idx} className="flex items-center text-sm text-gray">
                                <CheckCircle className="h-4 w-4 text-light-blue mr-2 flex-shrink-0" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        )}
                        
                        {/* Service details */}
                        <div className="flex items-center justify-between text-sm text-gray mb-6">
                          <div className="flex items-center">
                            <Timer className="h-4 w-4 mr-2" />
                            <span>{service.duration_minutes ? `${service.duration_minutes} min` : "Professional service"}</span>
                          </div>
                          <div className="flex items-center">
                            <Calculator className="h-4 w-4 mr-2" />
                            <span>Mobile Service</span>
                          </div>
                        </div>
                        
                        {/* Pricing and CTA */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-3xl font-bold text-navy">
                              ${service.base_price}
                            </div>
                            <div className="text-xs text-gray">Starting price</div>
                          </div>
                          <button className="btn-modern px-6 py-3 group-hover:scale-105 transition-transform flex items-center">
                            Select Service
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Step 2: Date and Time Selection */}
        {step === 2 && selectedService && (
          <section aria-labelledby="datetime-heading" className="max-w-5xl mx-auto animate-fadeInUp">
            <h2 id="datetime-heading" className="text-center text-4xl font-bold text-navy mb-12">
              Choose Date & Time
            </h2>
            
            {/* Service Summary Card */}
            <div className="glass-card rounded-2xl p-8 mb-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-light-blue/5 to-accent/5"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={goBack}
                    className="flex items-center text-navy hover:text-light-blue transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Change Service
                  </button>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-accent">
                      ${selectedService.base_price}
                    </div>
                    <div className="text-sm text-gray">Estimated total</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-bg-light to-white flex items-center justify-center shadow-inner">
                    <Wrench className="h-8 w-8 text-navy" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-navy mb-2">{selectedService.name}</h3>
                    <p className="text-text-dark">{selectedService.description}</p>
                    <div className="flex items-center mt-3 text-sm text-gray">
                      <Timer className="h-4 w-4 mr-2" />
                      <span>Duration: {selectedService.duration_minutes} minutes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Date and Time Selection */}
            <div className="grid md:grid-cols-2 gap-12">
              {/* Date Selection */}
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-navy mb-6">Select Date</h3>
                <div className="space-y-4">
                  <label htmlFor="booking-date" className="flex items-center text-lg font-semibold text-navy">
                    <Calendar className="h-5 w-5 mr-3 text-light-blue" />
                    Preferred Date
                  </label>
                  <input
                    id="booking-date"
                    type="date"
                    {...register('date')}
                    className="input-modern text-lg"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <ErrorMessage message={errors.date?.message} />
                </div>
              </div>

              {/* Time Selection */}
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-navy mb-6">Select Time</h3>
                <div className="grid grid-cols-2 gap-3">
                  {TIME_SLOTS.map((timeSlot) => (
                    <button
                      key={timeSlot}
                      type="button"
                      onClick={() => setSelectedTimeSlot(timeSlot)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        selectedTimeSlot === timeSlot
                          ? 'border-accent bg-accent text-white shadow-lg scale-105'
                          : 'border-gray-200 bg-white text-navy hover:border-light-blue hover:bg-light-blue/5'
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <Clock className="h-4 w-4 mr-2" />
                        {timeSlot}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <div className="text-center mt-12">
              <button
                onClick={proceedToBooking}
                disabled={!selectedTimeSlot || !watchedDate}
                className="btn-accent text-lg px-12 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="h-6 w-6 mr-3" />
                Continue to Booking
                <ArrowRight className="h-5 w-5 ml-3" />
              </button>
            </div>
          </section>
        )}

        {/* Step 3: Customer Information */}
        {step === 3 && (
          <section aria-labelledby="booking-form-heading" className="max-w-5xl mx-auto animate-fadeInUp">
            <h2 id="booking-form-heading" className="text-center text-4xl font-bold text-navy mb-12">
              Complete Your Booking
            </h2>
            
            {/* Booking Summary */}
            <div className="glass-card rounded-2xl p-8 mb-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-light-blue/5 to-accent/5"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={goBack}
                    className="flex items-center text-navy hover:text-light-blue transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Change Date/Time
                  </button>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-accent">
                      ${estimatedTotal}
                    </div>
                    <div className="text-sm text-gray">Total</div>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-white/50 rounded-xl">
                    <Wrench className="h-8 w-8 text-navy mx-auto mb-2" />
                    <div className="font-bold text-navy">{selectedService?.name}</div>
                    <div className="text-sm text-gray">{selectedService?.duration_minutes} min</div>
                  </div>
                  <div className="text-center p-4 bg-white/50 rounded-xl">
                    <Calendar className="h-8 w-8 text-navy mx-auto mb-2" />
                    <div className="font-bold text-navy">{watchedDate}</div>
                    <div className="text-sm text-gray">Service Date</div>
                  </div>
                  <div className="text-center p-4 bg-white/50 rounded-xl">
                    <Clock className="h-8 w-8 text-navy mx-auto mb-2" />
                    <div className="font-bold text-navy">{selectedTimeSlot}</div>
                    <div className="text-sm text-gray">Appointment Time</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Information Form */}
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-8 relative transition-all duration-500 transform-gpu shadow-lg border border-white/20">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label htmlFor="name" className="flex items-center text-lg font-semibold text-navy">
                      <User className="h-5 w-5 mr-3 text-light-blue" />
                      Full Name *
                    </label>
                    <input
                      id="name"
                      {...register('name')}
                      className="input-modern"
                      placeholder="Enter your full name"
                    />
                    <ErrorMessage message={errors.name?.message} />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="phone" className="flex items-center text-lg font-semibold text-navy">
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

                  <div className="space-y-2">
                    <label htmlFor="email" className="flex items-center text-lg font-semibold text-navy">
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

                  <div className="space-y-2">
                    <label htmlFor="address" className="flex items-center text-lg font-semibold text-navy">
                      <MapPin className="h-5 w-5 mr-3 text-light-blue" />
                      Service Address *
                    </label>
                    <input
                      id="address"
                      {...register('address')}
                      className="input-modern"
                      placeholder="Where should we come to service your vehicle?"
                    />
                    <ErrorMessage message={errors.address?.message} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="notes" className="flex items-center text-lg font-semibold text-navy">
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

                {/* Enhanced Trust Indicators */}
                <div className="glass-card p-8 rounded-xl">
                  <div className="text-center mb-6">
                    <h4 className="text-xl font-bold text-navy mb-2">Why Choose Edgar's Mobile Auto Shop?</h4>
                    <p className="text-gray">Your trusted automotive care partner</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {TRUST_INDICATORS.map((indicator, index) => {
                      const IconComponent = indicator.icon;
                      return (
                        <div key={index} className="text-center">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-light-blue to-accent flex items-center justify-center mx-auto mb-3">
                            <IconComponent className="h-6 w-6 text-white" />
                          </div>
                          <div className="font-semibold text-navy text-sm">{indicator.text}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="text-center pt-8">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-accent text-xl px-16 py-5 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-light-blue to-accent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10 flex items-center">
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                          Processing Your Booking...
                        </>
                      ) : (
                        <>
                          <Zap className="h-6 w-6 mr-3" />
                          Confirm Premium Service
                          <CheckCircle className="h-6 w-6 ml-3" />
                        </>
                      )}
                    </div>
                  </button>
                  <p className="text-gray text-sm mt-4">
                    🎯 You'll receive a confirmation call within 15 minutes
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