import { Link, Outlet, useLocation } from 'react-router-dom'
import { Wrench, Phone, MapPin, Clock, Star, Shield, ChevronRight, Zap, Award, Users, Calendar } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function PublicLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white relative overflow-hidden">
      {/* Ambient Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-blue-500/5 to-transparent rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-orange-500/5 to-transparent rounded-full blur-3xl -translate-x-1/2 translate-y-1/2"></div>
      </div>

      {/* Premium Floating Navigation */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrollY > 50 
          ? 'bg-white/95 backdrop-blur-2xl shadow-2xl border-b border-gray-200/10' 
          : 'bg-transparent'
      }`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            {/* Premium Logo */}
            <Link to="/" className="flex items-center space-x-4 group relative">
              <div className="relative">
                {/* Main logo container with premium effects */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl">
                  <Shield className="h-8 w-8 text-white drop-shadow-lg" />
                </div>
                {/* Floating accent badge */}
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-125 transition-transform duration-300">
                  <Wrench className="h-3 w-3 text-white" />
                </div>
                {/* Premium glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/20 to-orange-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-900 to-blue-600 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-orange-500 transition-all duration-500">
                  Edgar's Mobile Auto
                </h1>
                <div className="flex items-center space-x-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-current text-orange-500" />
                    ))}
                  </div>
                  <span className="text-xs font-semibold bg-gradient-to-r from-gray-500 to-blue-900 bg-clip-text text-transparent">
                    SINCE 2019
                  </span>
                </div>
              </div>
            </Link>

            {/* Premium Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              <Link 
                to="/" 
                className={`relative px-6 py-3 rounded-xl font-semibold transition-all duration-300 group ${
                  location.pathname === '/' 
                    ? 'text-orange-500 bg-orange-500/10' 
                    : 'text-blue-900 hover:text-orange-500 hover:bg-orange-500/5'
                }`}
              >
                Home
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-blue-600 group-hover:w-8 transition-all duration-300"></div>
              </Link>
              <Link 
                to="/emergency" 
                className="relative px-6 py-3 rounded-xl font-semibold text-blue-900 hover:text-orange-500 hover:bg-orange-500/5 transition-all duration-300 group"
              >
                Emergency
                <div className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              </Link>
              <Link 
                to="/areas" 
                className="relative px-6 py-3 rounded-xl font-semibold text-blue-900 hover:text-orange-500 hover:bg-orange-500/5 transition-all duration-300 group"
              >
                Service Areas
              </Link>
              
              {/* Premium CTA Button */}
              <Link 
                to="/booking" 
                className="ml-6 relative inline-flex items-center px-8 py-4 bg-gradient-to-r from-orange-500 via-orange-500 to-orange-400 text-white font-bold rounded-2xl overflow-hidden group shadow-2xl hover:shadow-orange-500/25 transition-all duration-500 hover:scale-105"
              >
                {/* Button shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <Calendar className="h-5 w-5 mr-3 group-hover:rotate-12 transition-transform duration-300" />
                Book Service
                <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </nav>

            {/* Premium Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden relative p-3 rounded-xl bg-gradient-to-br from-blue-900/10 to-blue-600/10 hover:from-blue-900/20 hover:to-blue-600/20 transition-all duration-300"
            >
              <div className="relative w-6 h-6">
                <span className={`absolute block w-6 h-0.5 bg-blue-900 transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 top-3' : 'top-1'}`}></span>
                <span className={`absolute block w-6 h-0.5 bg-blue-900 transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : 'top-3'}`}></span>
                <span className={`absolute block w-6 h-0.5 bg-blue-900 transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 top-3' : 'top-5'}`}></span>
              </div>
            </button>
          </div>

          {/* Premium Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="lg:hidden absolute top-full left-0 right-0 bg-white/98 backdrop-blur-2xl border-t border-gray-200/10 shadow-2xl">
              <nav className="container mx-auto px-4 py-6">
                <div className="space-y-2">
                  <Link
                    to="/"
                    className="block px-6 py-4 text-blue-900 hover:text-orange-500 hover:bg-orange-500/5 rounded-xl transition-all duration-300 font-semibold"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <Link
                    to="/emergency"
                    className="block px-6 py-4 text-blue-900 hover:text-orange-500 hover:bg-orange-500/5 rounded-xl transition-all duration-300 font-semibold relative"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Emergency Service
                    <div className="absolute top-4 right-6 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  </Link>
                  <Link
                    to="/areas"
                    className="block px-6 py-4 text-blue-900 hover:text-orange-500 hover:bg-orange-500/5 rounded-xl transition-all duration-300 font-semibold"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Service Areas
                  </Link>
                  <Link
                    to="/booking"
                    className="block mx-6 mt-6 px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-400 text-white text-center font-bold rounded-xl shadow-lg"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Book Service
                  </Link>
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Main Content with Premium Spacing */}
      <main className="flex-1 pt-20 relative z-10">
        <Outlet />
      </main>

      {/* Premium Footer */}
      <footer className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white overflow-hidden">
        {/* Premium background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-600/10 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-orange-500/10 to-transparent rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDYwIDAgTCAwIDAgMCA2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
        </div>

        <div className="relative z-10">
          {/* Trust Bar */}
          <div className="border-b border-white/10">
            <div className="container mx-auto px-4 py-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div className="group">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-8 w-8 text-orange-500" />
                  </div>
                  <div className="text-2xl font-bold text-orange-500">500+</div>
                  <div className="text-white/80 text-sm">Happy Customers</div>
                </div>
                <div className="group">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Award className="h-8 w-8 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-blue-400">ASE</div>
                  <div className="text-white/80 text-sm">Certified Tech</div>
                </div>
                <div className="group">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Zap className="h-8 w-8 text-orange-500" />
                  </div>
                  <div className="text-2xl font-bold text-orange-500">24/7</div>
                  <div className="text-white/80 text-sm">Emergency</div>
                </div>
                <div className="group">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Star className="h-8 w-8 text-orange-500 fill-current" />
                  </div>
                  <div className="text-2xl font-bold text-orange-500">5.0</div>
                  <div className="text-white/80 text-sm">Star Rating</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Footer Content */}
          <div className="container mx-auto px-4 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Company Section - Premium Layout */}
              <div className="lg:col-span-5">
                <div className="flex items-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-orange-500 flex items-center justify-center mr-6 shadow-2xl">
                    <Shield className="h-9 w-9 text-white drop-shadow-lg" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-400 bg-clip-text text-transparent">
                      Edgar's Mobile Auto
                    </h3>
                    <div className="flex items-center mt-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-orange-500 fill-current mr-1" />
                      ))}
                      <span className="ml-3 text-white/80 font-semibold">Premium Service</span>
                    </div>
                  </div>
                </div>
                <p className="text-white/90 leading-relaxed mb-8 text-lg">
                  Revolutionizing automotive service with cutting-edge mobile technology 
                  and certified expertise. Experience premium car care without leaving your location.
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400/20 to-orange-500/20 backdrop-blur-sm flex items-center justify-center">
                      <Shield className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">Licensed</div>
                      <div className="text-white/70 text-sm">& Insured</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400/20 to-orange-500/20 backdrop-blur-sm flex items-center justify-center">
                      <Award className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">ASE</div>
                      <div className="text-white/70 text-sm">Certified</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Contact Section - Premium Design */}
              <div className="lg:col-span-4">
                <h4 className="text-2xl font-bold mb-8 bg-gradient-to-r from-white to-blue-400 bg-clip-text text-transparent">
                  Get In Touch
                </h4>
                <div className="space-y-6">
                  <a 
                    href="tel:5551234567"
                    className="flex items-center p-4 rounded-2xl bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm hover:from-orange-500/10 hover:to-orange-500/20 transition-all duration-500 group border border-white/10 hover:border-orange-500/30"
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/30 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
                      <Phone className="h-7 w-7 text-orange-500" />
                    </div>
                    <div>
                      <div className="font-bold text-xl text-white">(555) 123-4567</div>
                      <div className="text-orange-500 font-semibold">24/7 Emergency Line</div>
                    </div>
                  </a>
                  <div className="flex items-center p-4 rounded-2xl bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400/20 to-blue-400/30 flex items-center justify-center mr-4">
                      <MapPin className="h-7 w-7 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white">Service Coverage</div>
                      <div className="text-white/80">Greater Metro Area</div>
                    </div>
                  </div>
                  <div className="flex items-center p-4 rounded-2xl bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/10">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400/20 to-blue-400/30 flex items-center justify-center mr-4">
                      <Clock className="h-7 w-7 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white">Operating Hours</div>
                      <div className="text-white/80">Mon-Fri: 8AM-6PM</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="lg:col-span-3">
                <h4 className="text-2xl font-bold mb-8 bg-gradient-to-r from-white to-blue-400 bg-clip-text text-transparent">
                  Quick Actions
                </h4>
                <div className="space-y-4">
                  <Link 
                    to="/booking" 
                    className="block p-4 rounded-2xl bg-gradient-to-r from-orange-500/20 to-orange-500/30 hover:from-orange-500/30 hover:to-orange-500/40 transition-all duration-300 border border-orange-500/20 hover:border-orange-500/40 group"
                  >
                    <div className="flex items-center">
                      <Calendar className="h-6 w-6 text-orange-500 mr-3 group-hover:rotate-12 transition-transform duration-300" />
                      <span className="font-semibold text-white">Book Service</span>
                    </div>
                  </Link>
                  <a 
                    href="#" 
                    className="block p-4 rounded-2xl bg-gradient-to-r from-white/5 to-white/10 hover:from-white/10 hover:to-white/15 transition-all duration-300 border border-white/10 hover:border-white/20 group"
                  >
                    <div className="flex items-center">
                      <Zap className="h-6 w-6 text-blue-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                      <span className="font-semibold text-white">Emergency</span>
                    </div>
                  </a>
                  <a 
                    href="#" 
                    className="block p-4 rounded-2xl bg-gradient-to-r from-white/5 to-white/10 hover:from-white/10 hover:to-white/15 transition-all duration-300 border border-white/10 hover:border-white/20 group"
                  >
                    <div className="flex items-center">
                      <MapPin className="h-6 w-6 text-blue-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                      <span className="font-semibold text-white">Service Areas</span>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer Bottom - Premium */}
          <div className="border-t border-white/10 bg-black/20">
            <div className="container mx-auto px-4 py-8">
              <div className="flex flex-col md:flex-row items-center justify-between">
                <div className="flex items-center mb-4 md:mb-0">
                  <p className="text-white/80">
                    © 2024 Edgar's Mobile Auto Shop. All rights reserved.
                  </p>
                </div>
                <div className="flex items-center space-x-8 text-white/80">
                  <span className="flex items-center">
                    <Shield className="h-4 w-4 mr-2 text-blue-400" />
                    Licensed & Insured
                  </span>
                  <span className="flex items-center">
                    <Award className="h-4 w-4 mr-2 text-orange-500" />
                    ASE Certified
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
