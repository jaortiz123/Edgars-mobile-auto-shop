import { useLocation, Link } from 'react-router-dom'
import { CheckCircle, Calendar, Clock, MapPin, Phone, Mail, Star, Shield, Award, Zap, Download, Share2, Sparkles, User, X, Home, MessageCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

interface Service {
  id: number
  name: string
  price: number
  duration: string
  icon: string
}

interface Appointment {
  id: string
  name: string
  phone: string
  email?: string
  address: string
  date: string
  time: string
  notes?: string
  services: Service[]
  total: number
  status: string
  createdAt: string
}

export default function Confirmation() {
  const location = useLocation()
  const [showCelebration, setShowCelebration] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  
  const appointment = (location.state as { appointment: Appointment })?.appointment

  useEffect(() => {
    // Auto-advance timeline
    const timer = setInterval(() => {
      setCurrentStep(prev => (prev < 3 ? prev + 1 : prev))
    }, 2000)

    // Hide celebration after 3 seconds
    const celebrationTimer = setTimeout(() => {
      setShowCelebration(false)
    }, 3000)

    return () => {
      clearInterval(timer)
      clearTimeout(celebrationTimer)
    }
  }, [])

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Appointment Found</h2>
          <p className="text-gray-600 mb-6">We couldn't find your appointment details.</p>
          <Link to="/" className="btn-premium inline-flex items-center space-x-2 px-6 py-3">
            <Home className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    )
  }

  const timelineSteps = [
    {
      title: "Booking Confirmed",
      description: "Your appointment has been successfully scheduled",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Technician Assigned",
      description: "We're matching you with the best certified technician",
      icon: User,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Parts Preparation",
      description: "Gathering all necessary parts and tools for your service",
      icon: Shield,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      title: "On The Way",
      description: "Our technician will be dispatched to your location",
      icon: Zap,
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    }
  ]

  const guarantees = [
    {
      icon: Shield,
      title: "100% Satisfaction Guarantee",
      description: "If you're not happy, we'll make it right"
    },
    {
      icon: Award,
      title: "ASE Certified Technicians",
      description: "Only the most qualified professionals"
    },
    {
      icon: Star,
      title: "Quality Parts Warranty",
      description: "All parts backed by manufacturer warranty"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/20">
      
      {/* Celebration Effect */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-bounce">
              <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-2xl">
                <CheckCircle className="h-16 w-16 text-white" />
              </div>
            </div>
          </div>
          {/* Confetti effect would go here in a real implementation */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-green-500/10 to-blue-500/10 animate-pulse"></div>
        </div>
      )}

      <div className="container mx-auto px-4 py-20">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-green-100 rounded-full px-4 py-2 mb-6">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-green-700">Booking Confirmed</span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            <span className="text-green-600">Success!</span> Your Service is Booked
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Thank you for choosing Edgar's Mobile Auto Shop. We're excited to provide you with premium automotive service.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Appointment Details */}
              <div className="glass-card p-8 backdrop-blur-xl bg-white/80 border border-white/20 shadow-xl">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-premium rounded-xl flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Appointment Details</h2>
                    <p className="text-gray-600">Confirmation ID: <span className="font-mono font-semibold">{appointment.id}</span></p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <User className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-gray-900">{appointment.name}</div>
                        <div className="text-gray-600">{appointment.phone}</div>
                        {appointment.email && (
                          <div className="text-gray-600">{appointment.email}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-gray-900">Service Location</div>
                        <div className="text-gray-600">{appointment.address}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-gray-900">Service Date</div>
                        <div className="text-gray-600">{new Date(appointment.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <Clock className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-gray-900">Time Window</div>
                        <div className="text-gray-600">{appointment.time}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {appointment.notes && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                    <div className="font-semibold text-gray-900 mb-2">Additional Notes</div>
                    <div className="text-gray-600">{appointment.notes}</div>
                  </div>
                )}
              </div>

              {/* Services Booked */}
              <div className="glass-card p-8 backdrop-blur-xl bg-white/80 border border-white/20 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <span>Services Booked</span>
                </h3>

                <div className="space-y-4">
                  {appointment.services.map((service) => (
                    <div key={service.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl">
                      <div className="flex items-center space-x-4">
                        <span className="text-2xl">{service.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-900">{service.name}</div>
                          <div className="text-sm text-gray-600">Estimated duration: {service.duration}</div>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-gray-900">${service.price.toFixed(2)}</div>
                    </div>
                  ))}
                  
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">Estimated Total</span>
                      <span className="text-2xl font-bold text-blue-600">${appointment.total.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Final pricing will be confirmed after inspection
                    </p>
                  </div>
                </div>
              </div>

              {/* Service Timeline */}
              <div className="glass-card p-8 backdrop-blur-xl bg-white/80 border border-white/20 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-orange-600" />
                  <span>What Happens Next</span>
                </h3>

                <div className="space-y-6">
                  {timelineSteps.map((step, index) => {
                    const Icon = step.icon
                    const isCompleted = index <= currentStep
                    const isActive = index === currentStep
                    
                    return (
                      <div key={index} className="flex items-start space-x-4">
                        <div className={`
                          w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500
                          ${isCompleted ? step.bgColor : 'bg-gray-100'}
                          ${isActive ? 'scale-110 shadow-lg' : ''}
                        `}>
                          <Icon className={`h-6 w-6 ${isCompleted ? step.color : 'text-gray-400'}`} />
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-semibold ${isCompleted ? 'text-gray-900' : 'text-gray-500'}`}>
                            {step.title}
                          </h4>
                          <p className={`text-sm ${isCompleted ? 'text-gray-600' : 'text-gray-400'}`}>
                            {step.description}
                          </p>
                        </div>
                        {isActive && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Quick Actions */}
              <div className="glass-card p-6 backdrop-blur-xl bg-white/80 border border-white/20 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full btn-outline-premium inline-flex items-center justify-center space-x-2 px-4 py-3 text-sm">
                    <Download className="h-4 w-4" />
                    <span>Download Receipt</span>
                  </button>
                  <button className="w-full btn-outline-premium inline-flex items-center justify-center space-x-2 px-4 py-3 text-sm">
                    <Share2 className="h-4 w-4" />
                    <span>Share Appointment</span>
                  </button>
                  <Link
                    to="/booking"
                    className="w-full btn-premium inline-flex items-center justify-center space-x-2 px-4 py-3 text-sm"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Book Another Service</span>
                  </Link>
                </div>
              </div>

              {/* Contact Support */}
              <div className="glass-card p-6 backdrop-blur-xl bg-white/80 border border-white/20 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Assistance?</h3>
                <div className="space-y-4">
                  <a 
                    href="tel:(555)123-4567"
                    className="flex items-center space-x-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Call Support</div>
                      <div className="text-sm text-gray-600">(555) 123-4567</div>
                    </div>
                  </a>
                  
                  <a 
                    href="mailto:support@edgarsauto.com"
                    className="flex items-center space-x-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mail className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Email Us</div>
                      <div className="text-sm text-gray-600">support@edgarsauto.com</div>
                    </div>
                  </a>

                  <button className="flex items-center space-x-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group w-full">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageCircle className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Live Chat</div>
                      <div className="text-sm text-gray-600">Available 24/7</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Our Guarantees */}
              <div className="glass-card p-6 backdrop-blur-xl bg-white/80 border border-white/20 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  <span>Our Promise</span>
                </h3>
                <div className="space-y-4">
                  {guarantees.map((guarantee, index) => {
                    const Icon = guarantee.icon
                    return (
                      <div key={index} className="flex items-start space-x-3">
                        <Icon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{guarantee.title}</div>
                          <div className="text-xs text-gray-600">{guarantee.description}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Back to Home */}
              <Link
                to="/"
                className="block w-full btn-outline-premium inline-flex items-center justify-center space-x-2 px-6 py-3"
              >
                <Home className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
