import { Link } from 'react-router-dom'
import { CheckCircle, MapPin, Wrench, Shield, Star, Calendar, Phone, Award, Zap, ArrowRight, Sparkles, TrendingUp, Users, Timer, Target, ChevronDown } from 'lucide-react'
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
    { name: "Sarah Martinez", role: "Business Owner", company: "Tech Startup", rating: 5, text: "Edgar transformed my car maintenance experience. Professional service right at my office - saved me 3 hours!", avatar: "SM", color: "from-light-blue to-navy" },
    { name: "Mike Thompson", role: "Software Engineer", company: "Fortune 500", rating: 5, text: "Exceptional quality and transparency. Fixed my engine issue while I worked from home. Will never go back to traditional shops.", avatar: "MT", color: "from-accent to-navy" },
    { name: "Jennifer Chen", role: "Marketing Director", company: "Agency", rating: 5, text: "The convenience is unmatched. Edgar's team handled everything professionally while I managed client calls. Highly recommend!", avatar: "JC", color: "from-light-blue to-accent" }
  ]

  return (
    <div className="relative overflow-hidden bg-white">
      {/* Premium Hero Section - Asymmetrical Design */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Dynamic Background Layers */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[70%] h-full bg-gradient-to-bl from-navy via-navy/95 to-navy/90 transform skew-x-12 translate-x-1/4"></div>
          <div className="absolute top-0 right-0 w-[60%] h-full bg-gradient-to-bl from-light-blue/20 to-accent/20 transform skew-x-12 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content - Asymmetrical Layout */}
            <div className="lg:col-span-7 space-y-8">
              {/* Premium Badge with Real-time Element */}
              <div className="inline-flex items-center bg-gradient-to-r from-white/90 to-white/80 backdrop-blur-2xl border border-white/20 rounded-full px-6 py-3 shadow-2xl">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-3 animate-pulse"></div>
                <Sparkles className="h-5 w-5 text-accent mr-3" />
                <span className="font-bold text-navy">
                  {availableSlots} slots available today
                </span>
                <div className="ml-3 text-xs bg-accent/10 text-accent px-2 py-1 rounded-full font-semibold">
                  LIVE
                </div>
              </div>

              {/* Massive Hero Typography */}
              <div className="space-y-6">
                <h1 className="text-6xl md:text-8xl lg:text-9xl font-black leading-none">
                  <span className="block text-navy">Premium</span>
                  <span className="block bg-gradient-to-r from-accent via-accent to-light-blue bg-clip-text text-transparent animate-gradient bg-300%">
                    Mobile Auto
                  </span>
                  <span className="block text-navy">Service</span>
                </h1>
                <div className="flex items-center space-x-6">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-6 w-6 text-accent fill-current" />
                    ))}
                  </div>
                  <span className="text-xl font-bold text-navy">500+ Happy Customers</span>
                </div>
              </div>

              {/* Value Proposition */}
              <p className="text-2xl md:text-3xl text-text-dark leading-relaxed max-w-2xl">
                We bring <span className="font-bold text-accent">certified automotive expertise</span> 
                directly to your location. Experience the future of car care.
              </p>

              {/* Premium CTAs with Micro-interactions */}
              <div className="flex flex-col sm:flex-row gap-6 pt-8">
                <Link
                  to="/booking"
                  className="group relative inline-flex items-center justify-center px-12 py-6 bg-gradient-to-r from-accent via-accent to-accent/90 text-white font-bold text-xl rounded-2xl overflow-hidden shadow-2xl hover:shadow-accent/40 transition-all duration-500 hover:scale-105"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <Calendar className="h-6 w-6 mr-4 group-hover:rotate-12 transition-transform duration-300" />
                  Book Service Now
                  <ArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-2 transition-transform duration-300" />
                </Link>
                <a
                  href="tel:5551234567"
                  className="group inline-flex items-center justify-center px-12 py-6 bg-white/90 backdrop-blur-sm border-2 border-navy text-navy hover:bg-navy hover:text-white font-bold text-xl rounded-2xl transition-all duration-500 shadow-xl hover:shadow-2xl"
                >
                  <Phone className="h-6 w-6 mr-4 group-hover:rotate-12 transition-transform duration-300" />
                  Call (555) 123-4567
                </a>
              </div>

              {/* Trust Indicators Row */}
              <div className="flex items-center space-x-8 pt-8">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-light-blue/20 to-navy/20 rounded-xl flex items-center justify-center">
                    <Shield className="h-6 w-6 text-navy" />
                  </div>
                  <div>
                    <div className="font-bold text-navy">Licensed</div>
                    <div className="text-gray text-sm">& Insured</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-accent/20 to-navy/20 rounded-xl flex items-center justify-center">
                    <Award className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <div className="font-bold text-navy">ASE</div>
                    <div className="text-gray text-sm">Certified</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Floating Elements */}
            <div className="lg:col-span-5 relative">
              {/* Premium Stats Cards - Floating Layout */}
              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-br from-accent/20 to-transparent rounded-full blur-2xl"></div>
                  <div className="relative bg-white/95 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-light-blue to-navy rounded-2xl flex items-center justify-center">
                        <TrendingUp className="h-7 w-7 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-black text-navy">24/7</div>
                        <div className="text-gray font-semibold">Emergency Service</div>
                      </div>
                    </div>
                    <div className="h-2 bg-gradient-to-r from-light-blue via-accent to-light-blue rounded-full"></div>
                  </div>
                </div>

                <div className="relative ml-8">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-light-blue/20 to-transparent rounded-full blur-2xl"></div>
                  <div className="relative bg-white/95 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-accent to-navy rounded-2xl flex items-center justify-center">
                        <Users className="h-7 w-7 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-black text-navy">500+</div>
                        <div className="text-gray font-semibold">Satisfied Customers</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 text-accent fill-current" />
                      ))}
                      <span className="text-navy font-semibold ml-2">5.0 Rating</span>
                    </div>
                  </div>
                </div>

                <div className="relative -ml-4">
                  <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-to-br from-navy/20 to-transparent rounded-full blur-2xl"></div>
                  <div className="relative bg-white/95 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-light-blue to-accent rounded-2xl flex items-center justify-center">
                        <Timer className="h-7 w-7 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-black text-navy">15</div>
                        <div className="text-gray font-semibold">Min Response</div>
                      </div>
                    </div>
                    <div className="text-navy font-semibold">Average booking confirmation time</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="flex flex-col items-center animate-bounce">
            <span className="text-navy font-semibold mb-2">Scroll to explore</span>
            <ChevronDown className="h-6 w-6 text-navy" />
          </div>
        </div>
      </section>

      {/* Premium Features Section - Broken Grid Layout */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-bg-light via-white to-bg-light"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-light-blue/5 to-transparent rounded-full blur-3xl"></div>
        
        <div className="relative container mx-auto px-4">
          {/* Section Header with Premium Typography */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center bg-white/80 backdrop-blur-sm border border-gray/20 rounded-full px-6 py-3 mb-8">
              <Target className="h-5 w-5 text-accent mr-3" />
              <span className="font-bold text-navy">Why Choose Premium Service?</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-navy leading-tight mb-8">
              Automotive Excellence<br />
              <span className="bg-gradient-to-r from-accent to-light-blue bg-clip-text text-transparent">
                Delivered to You
              </span>
            </h2>
            <p className="text-2xl text-text-dark max-w-3xl mx-auto leading-relaxed">
              Experience the convergence of traditional craftsmanship and modern convenience
            </p>
          </div>

          {/* Asymmetrical Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Feature 1 - Large Card */}
            <div className="md:col-span-8 group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-light-blue/10 to-accent/10 rounded-3xl transform rotate-1 group-hover:rotate-2 transition-transform duration-500"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-12 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                <div className="flex items-start space-x-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-navy to-light-blue rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-xl">
                    <MapPin className="h-10 w-10 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-black text-navy mb-4 group-hover:text-light-blue transition-colors duration-300">
                      Ultimate Convenience
                    </h3>
                    <p className="text-lg text-text-dark leading-relaxed mb-6">
                      Skip the repair shop entirely. We bring professional automotive service directly 
                      to your home, office, or anywhere you need us. Save hours of your valuable time.
                    </p>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-accent" />
                        <span className="text-navy font-semibold">Home Service</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-accent" />
                        <span className="text-navy font-semibold">Office Visits</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2 - Compact Card */}
            <div className="md:col-span-4 group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-navy/10 rounded-3xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-500"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-accent to-navy rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-xl">
                  <Award className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-navy mb-4 group-hover:text-accent transition-colors duration-300">
                  Certified Experts
                </h3>
                <p className="text-text-dark leading-relaxed">
                  ASE-certified technicians with cutting-edge diagnostic tools and years of experience.
                </p>
              </div>
            </div>

            {/* Feature 3 - Wide Card */}
            <div className="md:col-span-6 group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-navy/10 to-light-blue/10 rounded-3xl transform rotate-1 group-hover:rotate-2 transition-transform duration-500"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-10 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                <div className="flex items-center space-x-6 mb-6">
                  <div className="w-18 h-18 bg-gradient-to-br from-light-blue to-accent rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-xl">
                    <Shield className="h-9 w-9 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-navy group-hover:text-light-blue transition-colors duration-300">
                      Premium Guarantee
                    </h3>
                    <p className="text-accent font-semibold">100% Satisfaction Promise</p>
                  </div>
                </div>
                <p className="text-lg text-text-dark leading-relaxed">
                  Every service comes with our comprehensive warranty and satisfaction guarantee. 
                  Your peace of mind is our priority.
                </p>
              </div>
            </div>

            {/* Feature 4 - Tall Card */}
            <div className="md:col-span-6 group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-light-blue/10 rounded-3xl transform -rotate-1 group-hover:-rotate-2 transition-transform duration-500"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl border border-white/40 rounded-3xl p-10 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2 h-full flex flex-col">
                <div className="w-18 h-18 bg-gradient-to-br from-navy to-accent rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-xl">
                  <Zap className="h-9 w-9 text-white" />
                </div>
                <h3 className="text-3xl font-black text-navy mb-4 group-hover:text-accent transition-colors duration-300">
                  Lightning Fast
                </h3>
                <p className="text-lg text-text-dark leading-relaxed flex-1">
                  24/7 emergency service with 15-minute average response time. When you need help, we're there.
                </p>
                <div className="mt-6 pt-6 border-t border-gray/20">
                  <div className="flex items-center justify-between">
                    <span className="text-navy font-bold">Response Time</span>
                    <span className="text-accent text-2xl font-black">15 min</span>
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
            <div className="inline-flex items-center bg-gradient-to-r from-navy/10 to-light-blue/10 backdrop-blur-sm border border-navy/20 rounded-full px-6 py-3 mb-8">
              <Wrench className="h-5 w-5 text-navy mr-3" />
              <span className="font-bold text-navy">Premium Service Portfolio</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-navy leading-tight mb-8">
              Complete Automotive<br />
              <span className="bg-gradient-to-r from-accent to-light-blue bg-clip-text text-transparent">
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
        <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy/95 to-navy/90"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-light-blue/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-accent/20 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative container mx-auto px-4 text-white">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-black leading-tight mb-8">
              Customer Success<br />
              <span className="bg-gradient-to-r from-accent to-light-blue bg-clip-text text-transparent">
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
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${testimonials[currentTestimonial].color} flex items-center justify-center mr-6 shadow-xl`}>
                      <span className="text-white font-black text-xl">
                        {testimonials[currentTestimonial].avatar}
                      </span>
                    </div>
                    <div>
                      <div className="font-black text-2xl text-white">
                        {testimonials[currentTestimonial].name}
                      </div>
                      <div className="text-light-blue font-semibold">
                        {testimonials[currentTestimonial].role}
                      </div>
                      <div className="text-white/70 text-sm">
                        {testimonials[currentTestimonial].company}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-6 w-6 text-accent fill-current mr-1" />
                    ))}
                    <span className="ml-3 text-accent font-bold">5.0 Stars</span>
                  </div>
                  <blockquote className="text-xl text-white/90 leading-relaxed">
                    "{testimonials[currentTestimonial].text}"
                  </blockquote>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-white font-semibold">Service Quality</span>
                      <span className="text-accent font-bold">98%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full w-[98%] bg-gradient-to-r from-accent to-light-blue rounded-full"></div>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-white font-semibold">Time Saved</span>
                      <span className="text-light-blue font-bold">3.2 hrs</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full w-[85%] bg-gradient-to-r from-light-blue to-accent rounded-full"></div>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-white font-semibold">Convenience</span>
                      <span className="text-accent font-bold">Perfect</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-accent to-light-blue rounded-full"></div>
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
                        ? 'bg-accent scale-125' 
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
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-accent/10 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-light-blue/10 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative container mx-auto px-4 text-center">
          {/* Scarcity Indicator */}
          <div className="inline-flex items-center bg-gradient-to-r from-accent/20 to-accent/10 border border-accent/30 rounded-full px-6 py-3 mb-8">
            <div className="w-3 h-3 bg-accent rounded-full mr-3 animate-pulse"></div>
            <span className="font-bold text-accent">
              Only {availableSlots} premium slots remaining today
            </span>
          </div>

          <h2 className="text-5xl md:text-7xl font-black text-navy leading-tight mb-8">
            Ready for Premium<br />
            <span className="bg-gradient-to-r from-accent to-light-blue bg-clip-text text-transparent">
              Automotive Care?
            </span>
          </h2>
          
          <p className="text-2xl text-text-dark max-w-3xl mx-auto mb-12 leading-relaxed">
            Join hundreds of satisfied customers who've discovered the convenience 
            of professional mobile auto repair.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-8 justify-center mb-16">
            <Link 
              to="/booking" 
              className="group relative inline-flex items-center justify-center px-16 py-6 bg-gradient-to-r from-accent via-accent to-accent/90 text-white font-black text-2xl rounded-2xl overflow-hidden shadow-2xl hover:shadow-accent/40 transition-all duration-500 hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <Calendar className="h-7 w-7 mr-4 group-hover:rotate-12 transition-transform duration-300" />
              Book Premium Service
              <ArrowRight className="h-6 w-6 ml-4 group-hover:translate-x-2 transition-transform duration-300" />
            </Link>
            <a 
              href="tel:5551234567" 
              className="group inline-flex items-center justify-center px-16 py-6 bg-white border-3 border-navy text-navy hover:bg-navy hover:text-white font-black text-2xl rounded-2xl transition-all duration-500 shadow-xl hover:shadow-2xl"
            >
              <Phone className="h-7 w-7 mr-4 group-hover:rotate-12 transition-transform duration-300" />
              Call Now
            </a>
          </div>

          {/* Final Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-8 text-navy">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-light-blue" />
              <span className="font-semibold">Licensed & Insured</span>
            </div>
            <div className="flex items-center space-x-3">
              <Award className="h-6 w-6 text-accent" />
              <span className="font-semibold">ASE Certified</span>
            </div>
            <div className="flex items-center space-x-3">
              <Star className="h-6 w-6 text-accent fill-current" />
              <span className="font-semibold">5.0 Star Rating</span>
            </div>
            <div className="flex items-center space-x-3">
              <Zap className="h-6 w-6 text-light-blue" />
              <span className="font-semibold">24/7 Emergency</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

