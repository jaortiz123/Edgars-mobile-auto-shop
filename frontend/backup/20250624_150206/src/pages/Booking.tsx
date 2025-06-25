import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, MapPin, User, Calendar, MessageSquare, Wrench, Sparkles, Star, ArrowRight, Shield, Award, Calculator, Zap } from 'lucide-react';
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

export default function Booking() {
  const navigate = useNavigate();
  
  // Premium mock services with enhanced data
  const mockServices = [
    { 
      id: 1, 
      name: "Signature Oil Change", 
      description: "Full synthetic oil with 27-point precision inspection and diagnostic scan", 
      base_price: 89,
      duration: "45 min",
      category: "maintenance",
      popular: true,
      includes: ["Premium synthetic oil", "Filter replacement", "Fluid top-off", "Battery test", "Diagnostic scan"]
    },
    { 
      id: 2, 
      name: "Brake System Excellence", 
      description: "Complete brake inspection, pad replacement, and performance optimization", 
      base_price: 189,
      duration: "90 min",
      category: "safety",
      includes: ["Brake pad inspection", "Rotor assessment", "Fluid replacement", "Performance test", "Safety certification"]
    },
    { 
      id: 3, 
      name: "Premium Battery Service", 
      description: "Professional battery replacement with electrical system analysis", 
      base_price: 149,
      duration: "60 min",
      category: "electrical",
      includes: ["Battery replacement", "Electrical testing", "Connection cleaning", "System optimization", "Performance guarantee"]
    },
    { 
      id: 4, 
      name: "Tire Care Pro", 
      description: "Complete tire rotation, balancing, and pressure optimization service", 
      base_price: 79,
      duration: "50 min",
      category: "maintenance",
      includes: ["Tire rotation", "Wheel balancing", "Pressure check", "Tread analysis", "Alignment check"]
    },
    { 
      id: 5, 
      name: "Advanced Diagnostics", 
      description: "Comprehensive computer diagnostic with detailed performance analysis", 
      base_price: 129,
      duration: "75 min",
      category: "diagnostic",
      popular: true,
      includes: ["Full system scan", "Error code analysis", "Performance report", "Recommendations", "Digital documentation"]
    },
    { 
      id: 6, 
      name: "Air System Refresh", 
      description: "Engine and cabin air filter replacement with air quality optimization", 
      base_price: 59,
      duration: "30 min",
      category: "maintenance",
      includes: ["Engine air filter", "Cabin air filter", "System inspection", "Air quality test", "Filter recycling"]
    }
  ];

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      try {
        const response = await serviceAPI.getAll();
        return response?.data || [];
      } catch {
        return [];
      }
    },
  });

  const displayServices = services || mockServices;

  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [estimatedTotal, setEstimatedTotal] = useState(0);
  const [availableSlots, setAvailableSlots] = useState(5);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  useEffect(() => {
    // Simulate real-time availability updates
    const timer = setInterval(() => {
      if (Math.random() > 0.8 && availableSlots > 2) {
        setAvailableSlots(prev => prev - 1)
      }
    }, 30000)
    return () => clearInterval(timer)
  }, [availableSlots])

  const selectService = useCallback((service: any) => {
    setServiceId(service.id);
    setSelectedService(service);
    setEstimatedTotal(service.base_price);
    setStep(2);
  }, []);

  const goBack = useCallback(() => {
    if (step > 1) setStep(step - 1);
  }, [step]);

  const goToBooking = useCallback(() => {
    setStep(3);
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const watchedDate = watch('date');
  const watchedTime = watch('time');

  useEffect(() => {
    if (watchedDate) setSelectedDate(watchedDate);
    if (watchedTime) setSelectedTime(watchedTime);
  }, [watchedDate, watchedTime]);

  const onSubmit = useCallback(async (values: FormValues) => {
    if (!serviceId) return;
    setIsLoading(true);
    try {
      // Premium loading experience
      setTimeout(() => {
        navigate('/confirmation', { 
          state: { 
            appointment: { 
              id: Math.floor(Math.random() * 1000),
              service_name: selectedService?.name,
              customer_name: values.name,
              date: values.date,
              time: values.time,
              total: estimatedTotal
            } 
          } 
        });
      }, 3000); // Longer for premium experience
    } catch {
      alert('An error occurred while booking your appointment. Please try again.');
      setIsLoading(false);
    }
  }, [serviceId, navigate, selectedService, estimatedTotal]);

  const timeSlots = [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', 
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-light via-white to-bg-light relative overflow-hidden">
      {/* Premium Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-light-blue/5 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-accent/5 to-transparent rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        
        {/* Premium Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center bg-white/80 backdrop-blur-2xl border border-white/40 rounded-full px-8 py-4 mb-8 shadow-xl">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-4 animate-pulse"></div>
            <Sparkles className="h-6 w-6 text-accent mr-3" />
            <span className="font-bold text-navy text-lg">
              {availableSlots} premium slots available today
            </span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-navy leading-tight mb-6">
            Premium Service
            <span className="block bg-gradient-to-r from-accent to-light-blue bg-clip-text text-transparent">
              Configurator
            </span>
          </h1>
          <p className="text-2xl text-text-dark max-w-3xl mx-auto leading-relaxed">
            Design your perfect automotive service experience with our premium booking system
          </p>
        </div>

        {/* Premium Progress Indicator */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex items-center justify-center space-x-8">
            {[
              { step: 1, title: "Select Service", icon: Wrench },
              { step: 2, title: "Configure Details", icon: Calculator },
              { step: 3, title: "Complete Booking", icon: CheckCircle }
            ].map(({ step: stepNum, title, icon: Icon }) => (
              <div key={stepNum} className="flex items-center">
                <div className={`relative flex items-center space-x-4 ${step >= stepNum ? 'text-navy' : 'text-gray/50'}`}>
                  <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-lg transition-all duration-500 ${
                    step >= stepNum 
                      ? 'bg-gradient-to-br from-navy to-light-blue text-white shadow-2xl scale-110' 
                      : 'bg-gray/20 text-gray border-2 border-gray/30'
                  }`}>
                    <Icon className="h-7 w-7" />
                    {step > stepNum && (
                      <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-light-blue/20 rounded-2xl animate-pulse"></div>
                    )}
                  </div>
                  <span className="font-bold text-lg hidden md:block">{title}</span>
                </div>
                {stepNum < 3 && (
                  <div className={`w-16 h-1 mx-6 rounded-full transition-all duration-500 ${
                    step > stepNum ? 'bg-gradient-to-r from-navy to-light-blue' : 'bg-gray/30'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Service Selection */}
        {step === 1 && (
          <div className="max-w-7xl mx-auto animate-fadeIn">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-navy mb-4">Choose Your Service</h2>
              <p className="text-xl text-text-dark">Select from our premium automotive care services</p>
            </div>

            {servicesLoading && (
              <div className="text-center py-20">
                <div className="w-20 h-20 border-4 border-light-blue border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <p className="text-xl text-text-dark">Loading premium services...</p>
              </div>
            )}

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {displayServices.map((service: any, index) => (
                <div
                  key={service.id}
                  onClick={() => selectService(service)}
                  className="group relative cursor-pointer animate-fadeInUp"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Popular Badge */}
                  {service.popular && (
                    <div className="absolute -top-3 left-6 z-10 bg-gradient-to-r from-accent to-accent/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                      Most Popular
                    </div>
                  )}

                  <div className="relative bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-3 group-hover:border-light-blue/50 h-full">
                    {/* Service Icon */}
                    <div className="w-20 h-20 bg-gradient-to-br from-navy/10 to-light-blue/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                      <Wrench className="h-10 w-10 text-navy group-hover:text-light-blue transition-colors duration-300" />
                    </div>
                    
                    {/* Service Details */}
                    <h3 className="text-2xl font-black text-navy mb-3 group-hover:text-light-blue transition-colors duration-300">
                      {service.name}
                    </h3>
                    
                    <p className="text-text-dark leading-relaxed mb-6">
                      {service.description}
                    </p>
                    
                    {/* Service Features */}
                    {service.includes && (
                      <div className="mb-6">
                        <h4 className="font-bold text-navy mb-3">Includes:</h4>
                        <ul className="space-y-2">
                          {service.includes.slice(0, 3).map((item: string, idx: number) => (
                            <li key={idx} className="flex items-center text-sm text-text-dark">
                              <CheckCircle className="h-4 w-4 text-accent mr-2 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Service Meta */}
                    <div className="flex items-center justify-between mb-6 text-sm">
                      <div className="flex items-center text-gray">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>{service.duration}</span>
                      </div>
                      <div className="flex items-center text-gray">
                        <Star className="h-4 w-4 mr-2 text-accent fill-current" />
                        <span>5.0 Rating</span>
                      </div>
                    </div>
                    
                    {/* Pricing and CTA */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-black text-navy">
                          ${service.base_price}
                        </div>
                        <div className="text-sm text-gray">Starting price</div>
                      </div>
                      <div className="bg-gradient-to-r from-accent to-accent/90 text-white px-6 py-3 rounded-xl font-bold group-hover:scale-105 transition-transform duration-300 shadow-lg">
                        Select Service
                        <ArrowRight className="h-4 w-4 ml-2 inline group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Service Configuration */}
        {step === 2 && selectedService && (
          <div className="max-w-6xl mx-auto animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Left: Service Details */}
              <div className="lg:col-span-7">
                <div className="bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 shadow-2xl mb-8">
                  <div className="flex items-center mb-6">
                    <button
                      onClick={goBack}
                      className="mr-6 p-3 rounded-xl bg-gray/10 hover:bg-gray/20 transition-colors group"
                    >
                      <ArrowLeft className="h-6 w-6 text-navy group-hover:-translate-x-1 transition-transform duration-300" />
                    </button>
                    <div className="flex-1">
                      <h2 className="text-3xl font-black text-navy">{selectedService.name}</h2>
                      <p className="text-light-blue font-semibold">{selectedService.category} • {selectedService.duration}</p>
                    </div>
                  </div>

                  <p className="text-lg text-text-dark leading-relaxed mb-8">
                    {selectedService.description}
                  </p>

                  {/* What's Included */}
                  <div className="mb-8">
                    <h3 className="text-xl font-black text-navy mb-4">What's Included</h3>
                    <div className="grid gap-3">
                      {selectedService.includes?.map((item: string, index: number) => (
                        <div key={index} className="flex items-center p-3 bg-gradient-to-r from-accent/5 to-light-blue/5 rounded-xl">
                          <CheckCircle className="h-5 w-5 text-accent mr-3 flex-shrink-0" />
                          <span className="text-text-dark font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Service Preview */}
                  <div className="bg-gradient-to-br from-navy/5 to-light-blue/5 rounded-2xl p-6">
                    <h3 className="text-xl font-black text-navy mb-4">Service Preview</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="w-12 h-12 bg-gradient-to-br from-navy to-light-blue rounded-xl flex items-center justify-center mx-auto mb-2">
                          <User className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-sm font-bold text-navy">Expert Tech</div>
                        <div className="text-xs text-gray">ASE Certified</div>
                      </div>
                      <div>
                        <div className="w-12 h-12 bg-gradient-to-br from-accent to-light-blue rounded-xl flex items-center justify-center mx-auto mb-2">
                          <Wrench className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-sm font-bold text-navy">Pro Tools</div>
                        <div className="text-xs text-gray">Latest Equipment</div>
                      </div>
                      <div>
                        <div className="w-12 h-12 bg-gradient-to-br from-light-blue to-accent rounded-xl flex items-center justify-center mx-auto mb-2">
                          <Shield className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-sm font-bold text-navy">Guaranteed</div>
                        <div className="text-xs text-gray">100% Warranty</div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={goToBooking}
                  className="w-full bg-gradient-to-r from-accent to-accent/90 text-white font-bold text-xl px-8 py-6 rounded-2xl shadow-2xl hover:shadow-accent/40 transition-all duration-500 hover:scale-105 group"
                >
                  Continue to Booking
                  <ArrowRight className="h-6 w-6 ml-3 inline group-hover:translate-x-2 transition-transform duration-300" />
                </button>
              </div>

              {/* Right: Price Calculator */}
              <div className="lg:col-span-5">
                <div className="bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 shadow-2xl sticky top-8">
                  <h3 className="text-2xl font-black text-navy mb-6">Service Summary</h3>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center p-4 bg-gradient-to-r from-navy/5 to-light-blue/5 rounded-xl">
                      <span className="font-semibold text-navy">{selectedService.name}</span>
                      <span className="font-bold text-2xl text-navy">${selectedService.base_price}</span>
                    </div>
                  </div>

                  <div className="border-t border-gray/20 pt-6 mb-8">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold text-navy">Estimated Total</span>
                      <span className="text-3xl font-black bg-gradient-to-r from-accent to-light-blue bg-clip-text text-transparent">
                        ${estimatedTotal}
                      </span>
                    </div>
                    <p className="text-sm text-gray mt-2">Final price confirmed on-site</p>
                  </div>

                  {/* Trust Signals */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-5 w-5 text-light-blue" />
                      <span className="text-navy font-semibold">Licensed & Insured</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Award className="h-5 w-5 text-accent" />
                      <span className="text-navy font-semibold">ASE Certified Technicians</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Star className="h-5 w-5 text-accent fill-current" />
                      <span className="text-navy font-semibold">5.0 Star Rating</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Zap className="h-5 w-5 text-light-blue" />
                      <span className="text-navy font-semibold">Same-Day Service</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Booking Form */}
        {step === 3 && (
          <div className="max-w-6xl mx-auto animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Left: Booking Form */}
              <div className="lg:col-span-8">
                <div className="bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 shadow-2xl">
                  <div className="flex items-center mb-8">
                    <button
                      onClick={goBack}
                      className="mr-6 p-3 rounded-xl bg-gray/10 hover:bg-gray/20 transition-colors group"
                    >
                      <ArrowLeft className="h-6 w-6 text-navy group-hover:-translate-x-1 transition-transform duration-300" />
                    </button>
                    <h2 className="text-3xl font-black text-navy">Complete Your Booking</h2>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    {/* Personal Information */}
                    <div>
                      <h3 className="text-xl font-bold text-navy mb-6 flex items-center">
                        <User className="h-6 w-6 mr-3 text-light-blue" />
                        Personal Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-navy font-semibold mb-3">
                            Full Name *
                          </label>
                          <input
                            {...register('name')}
                            className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm border border-gray/30 rounded-2xl text-navy placeholder:text-gray focus:outline-none focus:ring-4 focus:ring-light-blue/20 focus:border-light-blue transition-all duration-300 shadow-lg"
                            placeholder="Enter your full name"
                          />
                          <ErrorMessage message={errors.name?.message} />
                        </div>
                        <div>
                          <label className="block text-navy font-semibold mb-3">
                            Phone Number
                          </label>
                          <input
                            {...register('phone')}
                            className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm border border-gray/30 rounded-2xl text-navy placeholder:text-gray focus:outline-none focus:ring-4 focus:ring-light-blue/20 focus:border-light-blue transition-all duration-300 shadow-lg"
                            placeholder="(555) 123-4567"
                          />
                          <ErrorMessage message={errors.phone?.message} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-navy font-semibold mb-3">
                            Email Address
                          </label>
                          <input
                            {...register('email')}
                            type="email"
                            className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm border border-gray/30 rounded-2xl text-navy placeholder:text-gray focus:outline-none focus:ring-4 focus:ring-light-blue/20 focus:border-light-blue transition-all duration-300 shadow-lg"
                            placeholder="your@email.com"
                          />
                          <ErrorMessage message={errors.email?.message} />
                        </div>
                      </div>
                    </div>

                    {/* Service Location */}
                    <div>
                      <h3 className="text-xl font-bold text-navy mb-6 flex items-center">
                        <MapPin className="h-6 w-6 mr-3 text-light-blue" />
                        Service Location
                      </h3>
                      <div>
                        <label className="block text-navy font-semibold mb-3">
                          Address *
                        </label>
                        <input
                          {...register('address')}
                          className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm border border-gray/30 rounded-2xl text-navy placeholder:text-gray focus:outline-none focus:ring-4 focus:ring-light-blue/20 focus:border-light-blue transition-all duration-300 shadow-lg"
                          placeholder="Where should we service your vehicle?"
                        />
                        <ErrorMessage message={errors.address?.message} />
                      </div>
                    </div>

                    {/* Schedule */}
                    <div>
                      <h3 className="text-xl font-bold text-navy mb-6 flex items-center">
                        <Calendar className="h-6 w-6 mr-3 text-light-blue" />
                        Select Date & Time
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-navy font-semibold mb-3">
                            Preferred Date *
                          </label>
                          <input
                            {...register('date')}
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm border border-gray/30 rounded-2xl text-navy focus:outline-none focus:ring-4 focus:ring-light-blue/20 focus:border-light-blue transition-all duration-300 shadow-lg"
                          />
                          <ErrorMessage message={errors.date?.message} />
                        </div>
                        <div>
                          <label className="block text-navy font-semibold mb-3">
                            Preferred Time *
                          </label>
                          <select
                            {...register('time')}
                            className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm border border-gray/30 rounded-2xl text-navy focus:outline-none focus:ring-4 focus:ring-light-blue/20 focus:border-light-blue transition-all duration-300 shadow-lg"
                          >
                            <option value="">Select time slot</option>
                            {timeSlots.map(time => (
                              <option key={time} value={time}>{time}</option>
                            ))}
                          </select>
                          <ErrorMessage message={errors.time?.message} />
                        </div>
                      </div>
                    </div>

                    {/* Additional Notes */}
                    <div>
                      <h3 className="text-xl font-bold text-navy mb-6 flex items-center">
                        <MessageSquare className="h-6 w-6 mr-3 text-light-blue" />
                        Additional Information
                      </h3>
                      <textarea
                        {...register('notes')}
                        rows={4}
                        className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm border border-gray/30 rounded-2xl text-navy placeholder:text-gray focus:outline-none focus:ring-4 focus:ring-light-blue/20 focus:border-light-blue transition-all duration-300 shadow-lg resize-none"
                        placeholder="Any specific vehicle issues, special instructions, or additional requests..."
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-8">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-accent via-accent to-accent/90 text-white font-black text-xl px-8 py-6 rounded-2xl shadow-2xl hover:shadow-accent/40 transition-all duration-500 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                      >
                        {isLoading ? (
                          <>
                            <div className="flex items-center justify-center">
                              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                              Confirming Your Premium Service...
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            <CheckCircle className="h-6 w-6 mr-3 inline group-hover:rotate-12 transition-transform duration-300" />
                            Confirm Premium Booking
                            <ArrowRight className="h-6 w-6 ml-3 inline group-hover:translate-x-2 transition-transform duration-300" />
                          </>
                        )}
                      </button>
                      <p className="text-center text-gray text-sm mt-4">
                        You'll receive confirmation within 15 minutes
                      </p>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right: Booking Summary */}
              <div className="lg:col-span-4">
                <div className="bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 shadow-2xl sticky top-8">
                  <h3 className="text-2xl font-black text-navy mb-6">Booking Summary</h3>
                  
                  {/* Service Details */}
                  <div className="mb-8">
                    <div className="bg-gradient-to-r from-navy/5 to-light-blue/5 rounded-2xl p-6 mb-6">
                      <h4 className="font-bold text-navy mb-2">{selectedService?.name}</h4>
                      <p className="text-gray text-sm">{selectedService?.description}</p>
                    </div>

                    {selectedDate && (
                      <div className="flex items-center space-x-3 mb-3">
                        <Calendar className="h-5 w-5 text-light-blue" />
                        <span className="text-navy font-semibold">{new Date(selectedDate).toLocaleDateString()}</span>
                      </div>
                    )}

                    {selectedTime && (
                      <div className="flex items-center space-x-3 mb-6">
                        <Clock className="h-5 w-5 text-light-blue" />
                        <span className="text-navy font-semibold">{selectedTime}</span>
                      </div>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="border-t border-gray/20 pt-6 mb-8">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-navy">Service Fee</span>
                      <span className="font-bold text-navy">${selectedService?.base_price}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-gray/20 pt-4">
                      <span className="text-xl font-bold text-navy">Total</span>
                      <span className="text-2xl font-black bg-gradient-to-r from-accent to-light-blue bg-clip-text text-transparent">
                        ${estimatedTotal}
                      </span>
                    </div>
                  </div>

                  {/* Guarantees */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent" />
                      <span className="text-navy">100% Satisfaction Guarantee</span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent" />
                      <span className="text-navy">Licensed & Insured Service</span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent" />
                      <span className="text-navy">Comprehensive Warranty</span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent" />
                      <span className="text-navy">15-Min Response Time</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
