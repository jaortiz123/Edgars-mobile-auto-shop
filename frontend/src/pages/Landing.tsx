import { Link } from 'react-router-dom'
import { MapPin, Wrench, Shield, Star, Calendar, Phone, Award, Zap, ArrowRight, Target } from 'lucide-react'
import { useState, useEffect } from 'react'
import ServiceListContainer from '../containers/ServiceListContainer'

export default function Landing() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [availableSlots, setAvailableSlots] = useState(3)

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
    { name: "Sarah Martinez", role: "Business Owner", company: "Tech Startup", rating: 5, text: "Edgar transformed my car maintenance experience. Professional service right at my office - saved me 3 hours!", avatar: "SM", color: "from-blue-500 to-blue-900" },
    { name: "Mike Thompson", role: "Software Engineer", company: "Fortune 500", rating: 5, text: "Exceptional quality and transparency. Fixed my engine issue while I worked from home. Will never go back to traditional shops.", avatar: "MT", color: "from-orange-500 to-blue-900" },
    { name: "Jennifer Chen", role: "Marketing Director", company: "Agency", rating: 5, text: "The convenience is unmatched. Edgar's team handled everything professionally while I managed client calls. Highly recommend!", avatar: "JC", color: "from-blue-500 to-orange-500" }
  ]

  // Safety check for testimonial index
  const currentTestimonialData = testimonials[currentTestimonial] || testimonials[0]

  return (
    <div className="relative overflow-hidden bg-white">
      {/* Simplified Hero Section */}
      <section className="relative min-h-screen flex items-center bg-gradient-to-br from-blue-50 to-white">
        {/* Simple Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-20 w-72 h-72 bg-blue-100 rounded-full opacity-50"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-orange-100 rounded-full opacity-30"></div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Content */}
            <div className="space-y-8">
              {/* Live Badge */}
              <div className="inline-flex items-center bg-white/90 border border-gray-200 rounded-full px-6 py-3 shadow-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-3 animate-pulse"></div>
                <span className="text-orange-500 font-bold mr-3">⭐</span>
                <span className="font-bold text-blue-900">
                  {availableSlots} slots available today
                </span>
                <div className="ml-3 text-xs bg-orange-500/10 text-orange-500 px-2 py-1 rounded-full font-semibold">
                  LIVE
                </div>
              </div>

              {/* Main Headline */}
              <div className="space-y-6">
                <h1 className="text-5xl md:text-7xl font-black leading-tight">
                  <span className="block text-blue-900">Premium</span>
                  <span className="block text-orange-500">Mobile Auto</span>
                  <span className="block text-blue-900">Service</span>
                </h1>
                
                <div className="flex items-center space-x-6">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-orange-500 text-xl">⭐</span>
                    ))}
                  </div>
                  <span className="text-xl font-bold text-blue-900">500+ Happy Customers</span>
                </div>
              </div>

              {/* Value Proposition */}
              <p className="text-xl md:text-2xl text-gray-700 leading-relaxed max-w-2xl">
                We bring <span className="font-bold text-orange-500">certified automotive expertise</span> 
                directly to your location. Experience the future of car care.
              </p>

              {/* Call-to-Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-6 pt-8">
                <Link
                  to="/booking"
                  className="inline-flex items-center justify-center px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xl rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  📅 Book Service Now
                </Link>
                <a
                  href="tel:5551234567"
                  className="inline-flex items-center justify-center px-8 py-4 bg-white border-2 border-blue-900 text-blue-900 hover:bg-blue-900 hover:text-white font-bold text-xl rounded-xl transition-all duration-300 shadow-lg"
                >
                  📞 Call (555) 123-4567
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center space-x-8 pt-8">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <span className="text-blue-900 text-xl">🛡️</span>
                  </div>
                  <div>
                    <div className="font-bold text-blue-900">Licensed</div>
                    <div className="text-gray-500 text-sm">& Insured</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <span className="text-orange-500 text-xl">🏆</span>
                  </div>
                  <div>
                    <div className="font-bold text-blue-900">ASE</div>
                    <div className="text-gray-500 text-sm">Certified</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Stats Cards */}
            <div className="space-y-6">
              <div className="bg-white/95 border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <span className="text-blue-900 text-xl">⚡</span>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-blue-900">24/7</div>
                    <div className="text-gray-500 font-semibold">Emergency Service</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/95 border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <span className="text-orange-500 text-xl">👥</span>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-blue-900">500+</div>
                    <div className="text-gray-500 font-semibold">Satisfied Customers</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-orange-500">⭐</span>
                  ))}
                  <span className="text-blue-900 font-semibold ml-2">5.0 Rating</span>
                </div>
              </div>

              <div className="bg-white/95 border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <span className="text-blue-900 text-xl">⏱️</span>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-blue-900">15</div>
                    <div className="text-gray-500 font-semibold">Min Response</div>
                  </div>
                </div>
                <div className="text-blue-900 font-semibold text-sm">Average booking confirmation time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Simple Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="flex flex-col items-center animate-bounce">
            <span className="text-blue-900 font-semibold mb-2">Scroll to explore</span>
            <span className="text-blue-900 text-xl">⬇️</span>
          </div>
        </div>
      </section>

      {/* Premium Features Section - Broken Grid Layout */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-full blur-3xl"></div>
        
        <div className="relative container mx-auto px-4">
          {/* Section Header with Premium Typography */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center bg-white/80 backdrop-blur-sm border border-gray-200/20 rounded-full px-6 py-3 mb-8">
              <Target className="h-5 w-5 text-orange-500 mr-3" />
              <span className="font-bold text-blue-900">Why Choose Premium Service?</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-blue-900 leading-tight mb-8">
              Automotive Excellence<br />
              <span className="bg-gradient-to-r from-orange-500 to-blue-500 bg-clip-text text-transparent">
                Delivered to You
              </span>
            </h2>
            <p className="text-2xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Experience the convergence of traditional craftsmanship and modern convenience
            </p>
          </div>

          {/* Asymmetrical Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Feature 1 - Large Card */}
            <div className="md:col-span-8 group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-orange-500/10 rounded-3xl transform rotate-1 group-hover:rotate-2 transition-transform duration-500"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-12 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                <div className="flex items-start space-x-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-900 to-blue-500 rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-xl">
                    <MapPin className="h-10 w-10 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-black text-blue-900 mb-4 group-hover:text-blue-500 transition-colors duration-300">
                      Mobile Convenience
                    </h3>
                    <p className="text-lg text-gray-700 leading-relaxed mb-6">
                      Premium automotive service delivered directly to your location. No more waiting rooms, 
                      no more lost productivity. Experience professional car care on your schedule.
                    </p>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-blue-900 font-semibold">Home Service</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-blue-900 font-semibold">Office Visits</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2 - Compact Card */}
            <div className="md:col-span-4 group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-blue-900/10 rounded-3xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-500"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-blue-900 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-xl">
                  <Award className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-blue-900 mb-4 group-hover:text-orange-500 transition-colors duration-300">
                  Certified Experts
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  ASE-certified technicians with cutting-edge diagnostic tools and years of experience.
                </p>
              </div>
            </div>

            {/* Feature 3 - Wide Card */}
            <div className="md:col-span-6 group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-blue-500/10 rounded-3xl transform rotate-1 group-hover:rotate-2 transition-transform duration-500"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-10 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                <div className="flex items-center space-x-6 mb-6">
                  <div className="w-18 h-18 bg-gradient-to-br from-blue-500 to-orange-500 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-xl">
                    <Shield className="h-9 w-9 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-blue-900 group-hover:text-blue-500 transition-colors duration-300">
                      Premium Guarantee
                    </h3>
                    <p className="text-orange-500 font-semibold">100% Satisfaction Promise</p>
                  </div>
                </div>
                <p className="text-lg text-gray-700 leading-relaxed">
                  Every service comes with our comprehensive warranty and satisfaction guarantee. 
                  Your peace of mind is our priority.
                </p>
              </div>
            </div>

            {/* Feature 4 - Tall Card */}
            <div className="md:col-span-6 group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-blue-500/10 rounded-3xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-500"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-10 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2 h-full flex flex-col">
                <div className="w-18 h-18 bg-gradient-to-br from-blue-900 to-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-xl">
                  <Zap className="h-9 w-9 text-white" />
                </div>
                <h3 className="text-3xl font-black text-blue-900 mb-4 group-hover:text-orange-500 transition-colors duration-300">
                  Lightning Fast
                </h3>
                <p className="text-lg text-gray-700 leading-relaxed flex-1">
                  24/7 emergency service with 15-minute average response time. When you need help, we're there.
                </p>
                <div className="mt-6 pt-6 border-t border-gray-200/20">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-900 font-bold">Response Time</span>
                    <span className="text-orange-500 text-2xl font-black">15 min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Services Showcase */}
      <section className="py-32 relative overflow-hidden bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <div className="inline-flex items-center bg-gradient-to-r from-blue-900/10 to-blue-500/10 backdrop-blur-sm border border-blue-900/20 rounded-full px-6 py-3 mb-8">
              <Wrench className="h-5 w-5 text-blue-900 mr-3" />
              <span className="font-bold text-blue-900">Premium Service Portfolio</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-blue-900 leading-tight mb-8">
              Complete Automotive<br />
              <span className="bg-gradient-to-r from-orange-500 to-blue-500 bg-clip-text text-transparent">
                Care Solutions
              </span>
            </h2>
          </div>
          
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <ServiceListContainer />
          </div>
        </div>
      </section>

      {/* Premium Social Proof Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-orange-500/20 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative container mx-auto px-4 text-white">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-black leading-tight mb-8">
              Customer Success<br />
              <span className="bg-gradient-to-r from-orange-500 to-blue-500 bg-clip-text text-transparent">
                Stories
              </span>
            </h2>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              See why professionals choose Edgar's for their automotive needs
            </p>
          </div>

          {/* Premium Testimonial Slider */}
          <div className="max-w-6xl mx-auto">
            <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-12 shadow-2xl">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="flex items-center mb-8">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentTestimonialData.color} flex items-center justify-center mr-6 shadow-xl`}>
                      <span className="text-2xl font-bold text-white">
                        {currentTestimonialData.avatar}
                      </span>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {currentTestimonialData.name}
                      </div>
                      <div className="text-white/80">
                        {currentTestimonialData.role} at {currentTestimonialData.company}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-6 w-6 text-orange-500 fill-current mr-1" />
                    ))}
                    <span className="ml-3 text-orange-500 font-bold">5.0 Stars</span>
                  </div>
                  <blockquote className="text-xl text-white/90 leading-relaxed">
                    "{currentTestimonialData.text}"
                  </blockquote>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                        <Wrench className="h-6 w-6 text-orange-500" />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">Expert Tech</div>
                        <div className="text-white/80 text-sm">ASE Certified</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <Shield className="h-6 w-6 text-blue-500" />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">Guaranteed</div>
                        <div className="text-white/80 text-sm">100% Satisfaction</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                        <Zap className="h-6 w-6 text-orange-500" />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">Fast Service</div>
                        <div className="text-white/80 text-sm">15 Min Response</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Testimonial Navigation */}
              <div className="flex justify-center mt-12 space-x-4">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonial(index)}
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${
                      index === currentTestimonial 
                        ? 'bg-orange-500 scale-125' 
                        : 'bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium CTA Section with Scarcity */}
      <section className="py-32 relative overflow-hidden bg-white">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-orange-500/10 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative container mx-auto px-4 text-center">
          {/* Scarcity Indicator */}
          <div className="inline-flex items-center bg-gradient-to-r from-orange-500/20 to-orange-500/10 border border-orange-500/30 rounded-full px-6 py-3 mb-8">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-3 animate-pulse"></div>
            <span className="font-bold text-orange-500">
              Only {availableSlots} premium slots remaining today
            </span>
          </div>

          <h2 className="text-5xl md:text-7xl font-black text-blue-900 leading-tight mb-8">
            Ready for Premium<br />
            <span className="bg-gradient-to-r from-orange-500 to-blue-500 bg-clip-text text-transparent">
              Automotive Care?
            </span>
          </h2>
          
          <p className="text-2xl text-gray-700 max-w-3xl mx-auto mb-12 leading-relaxed">
            Join hundreds of satisfied customers who've discovered the convenience 
            of professional mobile auto repair.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-8 justify-center mb-16">
            <Link 
              to="/booking" 
              className="group relative inline-flex items-center justify-center px-16 py-6 bg-gradient-to-r from-orange-500 via-orange-500 to-orange-400 text-white font-black text-2xl rounded-2xl overflow-hidden shadow-2xl hover:shadow-orange-500/40 transition-all duration-500 hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <Calendar className="h-7 w-7 mr-4 group-hover:rotate-12 transition-transform duration-300" />
              Book Premium Service
              <ArrowRight className="h-6 w-6 ml-4 group-hover:translate-x-2 transition-transform duration-300" />
            </Link>
            <a 
              href="tel:5551234567" 
              className="group inline-flex items-center justify-center px-16 py-6 bg-white border-3 border-blue-900 text-blue-900 hover:bg-blue-900 hover:text-white font-black text-2xl rounded-2xl transition-all duration-500 shadow-xl hover:shadow-2xl"
            >
              <Phone className="h-7 w-7 mr-4 group-hover:rotate-12 transition-transform duration-300" />
              Call Now
            </a>
          </div>

          {/* Final Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-8 text-blue-900">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-blue-500" />
              <span className="font-semibold">Licensed & Insured</span>
            </div>
            <div className="flex items-center space-x-3">
              <Award className="h-6 w-6 text-orange-500" />
              <span className="font-semibold">ASE Certified</span>
            </div>
            <div className="flex items-center space-x-3">
              <Star className="h-6 w-6 text-orange-500 fill-current" />
              <span className="font-semibold">5.0 Star Rating</span>
            </div>
            <div className="flex items-center space-x-3">
              <Zap className="h-6 w-6 text-blue-500" />
              <span className="font-semibold">24/7 Emergency</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

