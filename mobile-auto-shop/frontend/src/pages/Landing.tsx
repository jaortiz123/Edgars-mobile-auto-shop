import { Link } from 'react-router-dom'
import { Clock, Wrench, Shield, Star, Calendar, Award, ArrowRight, Sparkles, Target, Play, ChevronDown, Quote, MessageCircle, X, Users, Timer } from 'lucide-react'
import { useState, useEffect } from 'react'
import ServiceListContainer from '../containers/ServiceListContainer'

export default function Landing() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [availableSlots, setAvailableSlots] = useState(3)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  // Simulated real-time slot countdown
  useEffect(() => {
    const timer = setInterval(() => {
      if (Math.random() > 0.7 && availableSlots > 1) {
        setAvailableSlots(prev => prev - 1)
      }
    }, 45000)
    return () => clearInterval(timer)
  }, [availableSlots])

  const testimonials = [
    { 
      name: "Sarah Martinez", 
      role: "Business Owner", 
      company: "Tech Startup", 
      rating: 5, 
      text: "Edgar transformed my car maintenance experience. Professional service right at my office - saved me 3 hours!", 
      avatar: "SM", 
      color: "from-light-blue to-navy"
    },
    { 
      name: "Mike Thompson", 
      role: "Software Engineer", 
      company: "Fortune 500", 
      rating: 5, 
      text: "Exceptional quality and transparency. Fixed my engine issue while I worked from home. Will never go back to traditional shops.", 
      avatar: "MT", 
      color: "from-accent to-navy"
    },
    { 
      name: "Jennifer Chen", 
      role: "Marketing Director", 
      company: "Agency", 
      rating: 5, 
      text: "The convenience is unmatched. Edgar's team handled everything professionally while I managed client calls. Highly recommend!", 
      avatar: "JC", 
      color: "from-light-blue to-accent"
    }
  ]

  const stats = [
    { number: "500+", label: "Happy Customers", icon: Users, color: "text-blue-600" },
    { number: "24/7", label: "Emergency Service", icon: Clock, color: "text-green-600" },
    { number: "5.0", label: "Star Rating", icon: Star, color: "text-yellow-500" },
    { number: "< 1hr", label: "Response Time", icon: Timer, color: "text-purple-600" }
  ]

  const features = [
    {
      title: "Mobile Diagnostics",
      description: "Advanced computer diagnostics at your location",
      icon: Target,
      color: "from-blue-500 to-cyan-500",
      delay: "0ms"
    },
    {
      title: "Certified Technicians", 
      description: "ASE certified professionals you can trust",
      icon: Award,
      color: "from-purple-500 to-pink-500",
      delay: "200ms"
    },
    {
      title: "Transparent Pricing",
      description: "No hidden fees, upfront cost estimates",
      icon: Shield,
      color: "from-green-500 to-emerald-500",
      delay: "400ms"
    }
  ]

  return (
    <div className="relative overflow-hidden bg-white">
      {/* Hero Section - Asymmetrical Premium Design */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background System */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-100/30"></div>
          <div className="absolute top-0 right-0 w-[100vw] h-[100vh] bg-gradient-to-bl from-blue-600/5 via-transparent to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-[80vw] h-[80vh] bg-gradient-to-tr from-purple-600/5 via-transparent to-transparent"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 items-center min-h-screen py-20">
            
            {/* Left Content - Asymmetrical Layout */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Badge */}
              <div className="inline-flex items-center space-x-2 bg-gradient-premium/10 border border-blue-200 rounded-full px-4 py-2 animate-fadeInUp">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">Premium Mobile Auto Service</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>

              {/* Main Headline */}
              <div className="space-y-6 animate-fadeInUp" style={{ animationDelay: '200ms' }}>
                <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                  <span className="block bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
                    Car Repair
                  </span>
                  <span className="block bg-gradient-premium bg-clip-text text-transparent">
                    At Your Location
                  </span>
                </h1>
                <p className="text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-2xl">
                  Skip the shop, skip the wait. Professional automotive service 
                  <span className="font-semibold text-blue-600"> delivered directly to you</span> with 
                  certified technicians and transparent pricing.
                </p>
              </div>

              {/* CTA Section */}
              <div className="flex flex-col sm:flex-row gap-4 animate-fadeInUp" style={{ animationDelay: '400ms' }}>
                <Link 
                  to="/booking" 
                  className="btn-premium inline-flex items-center justify-center space-x-3 px-8 py-4 text-lg font-semibold"
                >
                  <Calendar className="h-6 w-6" />
                  <span>Book Service Now</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <button 
                  onClick={() => setIsVideoPlaying(true)}
                  className="btn-outline-premium inline-flex items-center justify-center space-x-3 px-8 py-4 text-lg font-semibold"
                >
                  <Play className="h-5 w-5" />
                  <span>See How It Works</span>
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-8 animate-fadeInUp" style={{ animationDelay: '600ms' }}>
                <div className="flex items-center space-x-2">
                  <div className="flex -space-x-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white flex items-center justify-center text-white text-sm font-bold">
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                    </div>
                    <p className="text-sm text-gray-600 font-medium">500+ Happy Customers</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 bg-green-100 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-green-700">
                      {availableSlots} slots available today
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Floating Stats */}
            <div className="lg:col-span-5 relative">
              
              {/* Main Visual Card */}
              <div className="card-floating p-8 bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl animate-slideInRight">
                <div className="space-y-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-premium rounded-xl flex items-center justify-center">
                      <Wrench className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Mobile Service</h3>
                      <p className="text-gray-600">Professional • Convenient • Reliable</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {stats.map((stat, index) => {
                      const Icon = stat.icon
                      return (
                        <div key={index} className="text-center p-4 rounded-xl bg-gray-50/50 hover:bg-white/80 transition-all">
                          <Icon className={`h-8 w-8 mx-auto mb-2 ${stat.color}`} />
                          <div className="text-2xl font-bold text-gray-900">{stat.number}</div>
                          <div className="text-sm text-gray-600">{stat.label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Floating Feature Cards */}
              <div className="absolute -top-8 -right-8 space-y-4">
                {features.map((feature, index) => {
                  const Icon = feature.icon
                  return (
                    <div 
                      key={index}
                      className="card-floating p-4 bg-white/90 backdrop-blur-sm border border-white/30 shadow-lg animate-float-gentle"
                      style={{ 
                        animationDelay: feature.delay,
                        animationDuration: `${3 + index * 0.5}s`
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${feature.color} rounded-lg flex items-center justify-center`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">{feature.title}</h4>
                          <p className="text-xs text-gray-600">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="flex flex-col items-center space-y-2 text-gray-400">
            <span className="text-sm font-medium">Scroll to explore</span>
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-blue-100 rounded-full px-4 py-2 mb-6">
              <Wrench className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">Our Services</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Professional Auto Care <span className="text-blue-600">Delivered</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From routine maintenance to complex repairs, our certified technicians bring the shop to you
            </p>
          </div>

          <ServiceListContainer />
        </div>
      </section>

      {/* Testimonials Section - Premium Slider */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-purple-100 rounded-full px-4 py-2 mb-6">
              <Quote className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">Customer Stories</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Trusted by <span className="text-purple-600">500+</span> Customers
            </h2>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <div className="glass-card p-8 lg:p-12 backdrop-blur-xl bg-white/80 border border-white/20 shadow-2xl">
              <div className="flex flex-col lg:flex-row items-center space-y-6 lg:space-y-0 lg:space-x-8">
                
                {/* Testimonial Content */}
                <div className="flex-1">
                  <div className="mb-6">
                    <div className="flex text-yellow-400 mb-4">
                      {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
                    </div>
                    <blockquote className="text-xl lg:text-2xl text-gray-700 leading-relaxed mb-6">
                      "{testimonials[currentTestimonial].text}"
                    </blockquote>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${testimonials[currentTestimonial].color} rounded-full flex items-center justify-center`}>
                      <span className="text-white font-bold">{testimonials[currentTestimonial].avatar}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{testimonials[currentTestimonial].name}</div>
                      <div className="text-gray-600">{testimonials[currentTestimonial].role}, {testimonials[currentTestimonial].company}</div>
                    </div>
                  </div>
                </div>

                {/* Navigation Dots */}
                <div className="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2">
                  {testimonials.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentTestimonial(index)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        currentTestimonial === index 
                          ? 'bg-blue-600 scale-125' 
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready to Experience <span className="text-blue-300">Premium</span> Auto Care?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Join hundreds of satisfied customers who choose convenience without compromising quality
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
              <Link 
                to="/booking" 
                className="btn-accent inline-flex items-center justify-center space-x-3 px-8 py-4 text-lg font-semibold"
              >
                <Calendar className="h-6 w-6" />
                <span>Schedule Service</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a 
                href="tel:(555)123-4567"
                className="btn-outline-premium inline-flex items-center justify-center space-x-3 px-8 py-4 text-lg font-semibold text-white border-white/30 hover:bg-white/10"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Call Emergency Line</span>
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-blue-300" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Licensed & Insured</h3>
                <p className="text-blue-200">Full protection for your peace of mind</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="h-8 w-8 text-blue-300" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">ASE Certified</h3>
                <p className="text-blue-200">Expertise you can trust</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-blue-300" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">24/7 Emergency</h3>
                <p className="text-blue-200">Available when you need us most</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Modal */}
      {isVideoPlaying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-4xl w-full mx-4">
            <button
              onClick={() => setIsVideoPlaying(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <div className="aspect-video bg-gray-900 rounded-2xl overflow-hidden">
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center text-white">
                  <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Video placeholder - How Edgar's Mobile Auto Works</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

