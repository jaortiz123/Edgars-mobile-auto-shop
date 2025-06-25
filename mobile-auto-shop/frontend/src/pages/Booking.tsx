import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, User, Phone, Calendar, Wrench, Star, ArrowRight, Shield, Award, Calculator } from 'lucide-react';
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
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [estimatedTotal, setEstimatedTotal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Premium mock services with enhanced data
  const mockServices = [
    {
      id: 1,
      name: "Premium Oil Change",
      description: "Full synthetic oil, filter replacement, 21-point inspection",
      price: 79.99,
      duration: "30-45 min",
      category: "Maintenance",
      icon: "🛢️",
      popular: true,
      features: ["Full Synthetic Oil", "Premium Filter", "Fluid Top-off", "Multi-point Inspection"]
    },
    {
      id: 2,
      name: "Brake Service Complete",
      description: "Brake pad replacement, rotor inspection, brake fluid flush",
      price: 299.99,
      duration: "1-2 hours",
      category: "Safety",
      icon: "🛑",
      popular: false,
      features: ["Brake Pad Replacement", "Rotor Inspection", "Brake Fluid Flush", "Safety Check"]
    },
    {
      id: 3,
      name: "Engine Diagnostics Pro",
      description: "Advanced computer diagnostics, error code analysis, repair recommendations",
      price: 149.99,
      duration: "45-60 min",
      category: "Diagnostics",
      icon: "🔧",
      popular: true,
      features: ["Computer Scan", "Error Analysis", "Performance Check", "Repair Estimate"]
    },
    {
      id: 4,
      name: "Battery & Charging System",
      description: "Battery test, alternator check, charging system analysis",
      price: 89.99,
      duration: "30 min",
      category: "Electrical",
      icon: "🔋",
      popular: false,
      features: ["Battery Load Test", "Alternator Check", "Charging Analysis", "Terminal Cleaning"]
    },
    {
      id: 5,
      name: "Tire Rotation & Balance",
      description: "Professional tire rotation, wheel balancing, pressure check",
      price: 59.99,
      duration: "30 min",
      category: "Maintenance",
      icon: "🛞",
      popular: false,
      features: ["Tire Rotation", "Wheel Balancing", "Pressure Check", "Tread Inspection"]
    },
    {
      id: 6,
      name: "Air Filter Replacement",
      description: "Engine air filter and cabin air filter replacement",
      price: 49.99,
      duration: "15 min",
      category: "Maintenance",
      icon: "💨",
      popular: false,
      features: ["Engine Air Filter", "Cabin Air Filter", "Filter Inspection", "Airflow Test"]
    }
  ];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Calculate estimated total when services change
  useEffect(() => {
    const total = selectedServices.reduce((sum, serviceId) => {
      const service = mockServices.find(s => s.id === serviceId);
      return sum + (service?.price || 0);
    }, 0);
    setEstimatedTotal(total);
  }, [selectedServices]);

  const toggleService = useCallback((serviceId: number) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  }, []);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (selectedServices.length === 0) {
      alert('Please select at least one service');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const selectedServiceObjects = mockServices.filter(service => 
        selectedServices.includes(service.id)
      );

      const appointment = {
        id: Math.random().toString(36).substr(2, 9),
        ...data,
        services: selectedServiceObjects,
        total: estimatedTotal,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };

      navigate('/confirmation', { 
        state: { appointment }
      });
    } catch (error) {
      console.error('Booking failed:', error);
      alert('Booking failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles = [
    "Select Services",
    "Choose Date & Time", 
    "Contact Information"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/20 py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </button>
          
          <div className="inline-flex items-center space-x-2 bg-blue-100 rounded-full px-4 py-2 mb-6">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Book Your Service</span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Premium Auto Care <span className="text-blue-600">Booking</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Professional mobile auto service at your location. Select services, choose your time, and we'll handle the rest.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="flex items-center justify-between">
            {stepTitles.map((title, index) => {
              const stepNumber = index + 1;
              const isActive = currentStep === stepNumber;
              const isCompleted = currentStep > stepNumber;
              
              return (
                <div key={stepNumber} className="flex items-center">
                  <div className="flex items-center space-x-3">
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all
                      ${isCompleted ? 'bg-green-500 text-white' : 
                        isActive ? 'bg-blue-600 text-white' : 
                        'bg-gray-200 text-gray-600'}
                    `}>
                      {isCompleted ? <CheckCircle className="h-5 w-5" /> : stepNumber}
                    </div>
                    <div className="hidden sm:block">
                      <div className={`font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                        {title}
                      </div>
                    </div>
                  </div>
                  {index < stepTitles.length - 1 && (
                    <div className={`flex-1 h-1 mx-4 rounded ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Main Content */}
            <div className="lg:col-span-2">
              <div className="glass-card p-8 backdrop-blur-xl bg-white/80 border border-white/20 shadow-xl">
                
                {/* Step 1: Service Selection */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-3 mb-8">
                      <div className="w-12 h-12 bg-gradient-premium rounded-xl flex items-center justify-center">
                        <Wrench className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Select Your Services</h2>
                        <p className="text-gray-600">Choose the services you need for your vehicle</p>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {mockServices.map((service) => (
                        <div
                          key={service.id}
                          onClick={() => toggleService(service.id)}
                          className={`
                            p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg
                            ${selectedServices.includes(service.id)
                              ? 'border-blue-500 bg-blue-50/50 shadow-lg'
                              : 'border-gray-200 hover:border-gray-300'
                            }
                          `}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-3">
                                <span className="text-2xl">{service.icon}</span>
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                                    {service.popular && (
                                      <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-1 rounded-full">
                                        Popular
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-gray-600">{service.description}</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm text-gray-600">{service.duration}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                  <span className="text-sm text-gray-600">{service.category}</span>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {service.features.map((feature, index) => (
                                  <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                                    {feature}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div className="text-right ml-4">
                              <div className="text-2xl font-bold text-gray-900">${service.price}</div>
                              <div className={`
                                w-6 h-6 rounded-full border-2 mt-2 transition-all
                                ${selectedServices.includes(service.id)
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                                }
                              `}>
                                {selectedServices.includes(service.id) && (
                                  <CheckCircle className="h-4 w-4 text-white m-0.5" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between pt-6">
                      <div></div>
                      <button
                        onClick={handleNext}
                        disabled={selectedServices.length === 0}
                        className="btn-premium inline-flex items-center space-x-2 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Date & Time Selection */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-3 mb-8">
                      <div className="w-12 h-12 bg-gradient-premium rounded-xl flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Choose Date & Time</h2>
                        <p className="text-gray-600">Select when you'd like our technician to visit</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Service Date *
                        </label>
                        <input
                          type="date"
                          {...register('date')}
                          min={new Date().toISOString().split('T')[0]}
                          className="input-premium w-full"
                        />
                        {errors.date && <ErrorMessage message={errors.date.message} />}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Preferred Time *
                        </label>
                        <select {...register('time')} className="input-premium w-full">
                          <option value="">Select time</option>
                          <option value="8:00-10:00">8:00 AM - 10:00 AM</option>
                          <option value="10:00-12:00">10:00 AM - 12:00 PM</option>
                          <option value="12:00-14:00">12:00 PM - 2:00 PM</option>
                          <option value="14:00-16:00">2:00 PM - 4:00 PM</option>
                          <option value="16:00-18:00">4:00 PM - 6:00 PM</option>
                        </select>
                        {errors.time && <ErrorMessage message={errors.time.message} />}
                      </div>
                    </div>

                    <div className="flex justify-between pt-6">
                      <button
                        onClick={handleBack}
                        className="btn-outline-premium inline-flex items-center space-x-2 px-6 py-3"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </button>
                      <button
                        onClick={handleNext}
                        className="btn-premium inline-flex items-center space-x-2 px-6 py-3"
                      >
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Contact Information */}
                {currentStep === 3 && (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="flex items-center space-x-3 mb-8">
                      <div className="w-12 h-12 bg-gradient-premium rounded-xl flex items-center justify-center">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Your Information</h2>
                        <p className="text-gray-600">We need your details to schedule the service</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          {...register('name')}
                          className="input-premium w-full"
                          placeholder="Enter your full name"
                        />
                        {errors.name && <ErrorMessage message={errors.name.message} />}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          {...register('phone')}
                          className="input-premium w-full"
                          placeholder="(555) 123-4567"
                        />
                        {errors.phone && <ErrorMessage message={errors.phone.message} />}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          {...register('email')}
                          className="input-premium w-full"
                          placeholder="your@email.com"
                        />
                        {errors.email && <ErrorMessage message={errors.email.message} />}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Service Address *
                        </label>
                        <input
                          type="text"
                          {...register('address')}
                          className="input-premium w-full"
                          placeholder="Where should we come?"
                        />
                        {errors.address && <ErrorMessage message={errors.address.message} />}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Notes
                      </label>
                      <textarea
                        {...register('notes')}
                        rows={4}
                        className="input-premium w-full"
                        placeholder="Any specific requirements or additional information..."
                      />
                    </div>

                    <div className="flex justify-between pt-6">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="btn-outline-premium inline-flex items-center space-x-2 px-6 py-3"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-premium inline-flex items-center space-x-2 px-8 py-3 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-5 w-5" />
                            <span>Complete Booking</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Sidebar Summary */}
            <div className="lg:col-span-1">
              <div className="glass-card p-6 backdrop-blur-xl bg-white/80 border border-white/20 shadow-xl sticky top-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                  <Calculator className="h-5 w-5 text-blue-600" />
                  <span>Service Summary</span>
                </h3>

                {selectedServices.length > 0 ? (
                  <div className="space-y-4">
                    {selectedServices.map(serviceId => {
                      const service = mockServices.find(s => s.id === serviceId);
                      if (!service) return null;
                      
                      return (
                        <div key={serviceId} className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{service.name}</div>
                            <div className="text-sm text-gray-600">{service.duration}</div>
                          </div>
                          <div className="text-lg font-semibold text-gray-900">${service.price}</div>
                        </div>
                      );
                    })}
                    
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-900">Total</span>
                        <span className="text-2xl font-bold text-blue-600">${estimatedTotal.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        Final price confirmed after inspection
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No services selected yet</p>
                  </div>
                )}

                {/* Trust Indicators */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-gray-700">Licensed & Insured</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Award className="h-5 w-5 text-blue-600" />
                      <span className="text-sm text-gray-700">ASE Certified Technicians</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Star className="h-5 w-5 text-yellow-500" />
                      <span className="text-sm text-gray-700">4.9/5 Customer Rating</span>
                    </div>
                  </div>
                </div>

                {/* Contact Support */}
                <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                  <div className="text-center">
                    <Phone className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900 mb-1">Need Help?</p>
                    <p className="text-sm text-gray-600 mb-3">Call our support team</p>
                    <a 
                      href="tel:(555)123-4567"
                      className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                    >
                      (555) 123-4567
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
