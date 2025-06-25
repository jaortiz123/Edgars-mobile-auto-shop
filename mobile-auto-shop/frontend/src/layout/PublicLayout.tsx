import { Link, Outlet, useLocation } from 'react-router-dom'
import { Wrench, Phone, MapPin, Shield, Menu, X, ChevronRight, Zap, Award, Users, Calendar, Facebook, Twitter, Instagram, Linkedin, Mail, MessageCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function PublicLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setScrollY(currentScrollY)
      
      // Auto-hide navigation on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const navigationItems = [
    { name: 'Home', href: '/', icon: Users },
    { name: 'Services', href: '#services', icon: Wrench },
    { name: 'About', href: '#about', icon: Award },
    { name: 'Contact', href: '#contact', icon: Phone },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-white relative overflow-hidden">
      {/* Ambient Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-light-blue/5 to-transparent rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-accent/5 to-transparent rounded-full blur-3xl -translate-x-1/2 translate-y-1/2"></div>
      </div>

      {/* Floating Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="container mx-auto px-4 py-4">
          <div className={`glass-card backdrop-blur-xl bg-white/80 border border-white/20 rounded-2xl shadow-xl transition-all duration-300 ${
            scrollY > 50 ? 'shadow-2xl bg-white/90' : ''
          }`}>
            <div className="flex items-center justify-between px-6 py-4">
              {/* Logo Section */}
              <Link to="/" className="flex items-center space-x-3 group">
                <div className="relative">
                  <div className="absolute -inset-2 bg-gradient-premium rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-lg"></div>
                  <div className="relative bg-gradient-premium p-3 rounded-xl shadow-lg">
                    <Wrench className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-premium bg-clip-text text-transparent">
                    Edgar's Auto
                  </span>
                  <div className="text-xs text-gray-600 font-medium">Mobile Service</div>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-8">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors group"
                    >
                      <Icon className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  )
                })}
              </div>

              {/* CTA Button */}
              <div className="hidden md:flex items-center space-x-4">
                <Link
                  to="/booking"
                  className="btn-premium inline-flex items-center space-x-2 px-6 py-3"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Book Now</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden glass-card p-2 rounded-xl border border-white/20 backdrop-blur-sm"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6 text-gray-700" />
                ) : (
                  <Menu className="h-6 w-6 text-gray-700" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden absolute top-full left-0 right-0 transition-all duration-300 ${
          isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}>
          <div className="container mx-auto px-4 py-4">
            <div className="glass-card backdrop-blur-xl bg-white/95 border border-white/20 rounded-2xl shadow-2xl">
              <div className="p-6 space-y-4">
                {navigationItems.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center space-x-3 p-3 rounded-xl hover:bg-blue-50 transition-all group animate-fadeInUp`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <Icon className="h-5 w-5 text-blue-600 opacity-70 group-hover:opacity-100" />
                      <span className="font-medium text-gray-700 group-hover:text-blue-600">{item.name}</span>
                    </Link>
                  )
                })}
                <div className="pt-4 border-t border-gray-100">
                  <Link
                    to="/booking"
                    className="btn-premium w-full justify-center inline-flex items-center space-x-2 px-6 py-3"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Book Now</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 relative z-10 pt-32">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-purple-900/20"></div>
        <div className="relative">
          {/* Main Footer Content */}
          <div className="container mx-auto px-4 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Company Info */}
              <div className="space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-premium p-3 rounded-xl shadow-lg">
                    <Wrench className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <span className="text-xl font-bold text-white">Edgar's Auto</span>
                    <div className="text-sm text-gray-400">Mobile Service</div>
                  </div>
                </div>
                <p className="text-gray-400 leading-relaxed">
                  Professional mobile auto repair services bringing convenience and quality directly to your location.
                </p>
                <div className="flex items-center space-x-4">
                  {[Facebook, Twitter, Instagram, Linkedin].map((Icon, index) => (
                    <a
                      key={index}
                      href="#"
                      className="glass-card p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-110"
                    >
                      <Icon className="h-4 w-4 text-gray-400 hover:text-white transition-colors" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Services */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Wrench className="h-5 w-5 text-blue-400" />
                  <span>Services</span>
                </h3>
                <ul className="space-y-3">
                  {['Oil Changes', 'Brake Service', 'Engine Diagnostics', 'Tire Replacement', 'Battery Service', 'Maintenance'].map((service) => (
                    <li key={service}>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors flex items-center space-x-2 group">
                        <ChevronRight className="h-3 w-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        <span>{service}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contact Info */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Phone className="h-5 w-5 text-blue-400" />
                  <span>Contact</span>
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Phone className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div>
                      <div className="text-white font-medium">(555) 123-4567</div>
                      <div className="text-sm text-gray-400">24/7 Emergency Service</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Mail className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div>
                      <div className="text-white font-medium">info@edgarsauto.com</div>
                      <div className="text-sm text-gray-400">Get a quote today</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div>
                      <div className="text-white font-medium">Service Area</div>
                      <div className="text-sm text-gray-400">Los Angeles & Surrounding Areas</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-blue-400" />
                  <span>Quick Actions</span>
                </h3>
                <div className="space-y-3">
                  <Link
                    to="/booking"
                    className="glass-card block p-4 rounded-xl bg-gradient-premium/10 border border-blue-500/20 hover:bg-gradient-premium/20 transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      <div>
                        <div className="text-white font-medium">Book Service</div>
                        <div className="text-xs text-gray-400">Schedule online</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                  <a
                    href="tel:(555)123-4567"
                    className="glass-card block p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <MessageCircle className="h-5 w-5 text-green-400" />
                      <div>
                        <div className="text-white font-medium">Emergency Call</div>
                        <div className="text-xs text-gray-400">24/7 available</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-gray-700/50">
            <div className="container mx-auto px-4 py-6">
              <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
                <div className="flex items-center space-x-6 text-sm text-gray-400">
                  <span>&copy; 2024 Edgar's Mobile Auto Shop. All rights reserved.</span>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a>
                  <div className="flex items-center space-x-2 text-gray-400">
                    <Shield className="h-4 w-4" />
                    <span>Licensed & Insured</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
