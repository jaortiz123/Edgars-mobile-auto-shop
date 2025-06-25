import { useState } from 'react'
import { NavLink, Link, Outlet } from 'react-router-dom'
import {
  Wrench,
  Phone,
  MapPin,
  Clock,
  Star,
  Shield,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Emergency Service', to: '/emergency' },
  { label: 'Service Areas', to: '/areas' },
]

const FOOTER_QUICK_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Book Service', to: '/booking' },
  { label: 'Emergency Service', to: '/emergency' },
  { label: 'Service Areas', to: '/areas' },
  { label: 'About Us', to: '/about' },
]

const CONTACT_INFO = [
  {
    icon: Phone,
    title: '(555) 123-4567',
    subtitle: '24/7 Emergency Service',
    href: 'tel:5551234567',
  },
  {
    icon: MapPin,
    title: 'Greater Metro Area',
    subtitle: 'Mobile service radius',
  },
  {
    icon: Clock,
    title: 'Mon–Fri: 8AM–6PM',
    subtitle: 'Sat: 9AM–4PM',
  },
]

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Navigation */}
      <header className="nav-modern" role="banner">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 group" aria-label="Edgar's Mobile Auto Shop">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-light-blue flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
                  <Wrench className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-navy group-hover:text-light-blue transition-colors">
                  Edgar's Mobile Auto Shop
                </h1>
                <div className="flex items-center text-sm">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current text-accent mr-0.5" />
                  ))}
                  <span className="ml-2 text-gray font-medium">Since 2019</span>
                </div>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center space-x-2" aria-label="Main">
              {NAV_ITEMS.map(({ label, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `nav-link-modern ${isActive ? 'text-accent' : ''}`
                  }
                >
                  {label}
                </NavLink>
              ))}
              <NavLink to="/booking" className="btn-accent px-6 py-3 ml-4 inline-flex items-center">
                Book Service
                <ChevronRight className="h-4 w-4 ml-2" />
              </NavLink>
            </nav>

            {/* Mobile Toggle */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden p-2 rounded-lg hover:bg-navy/5 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-6 w-6 text-navy" /> : <Menu className="h-6 w-6 text-navy" />}
            </button>
          </div>

          {/* Mobile Nav */}
          {mobileOpen && (
            <nav
              className="lg:hidden py-4 border-t border-gray/20 animate-slide-up"
              aria-label="Mobile"
            >
              <div className="flex flex-col space-y-2">
                {NAV_ITEMS.map(({ label, to }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 text-navy hover:bg-navy/5 rounded-lg transition-colors"
                  >
                    {label}
                  </NavLink>
                ))}
                <NavLink
                  to="/booking"
                  onClick={() => setMobileOpen(false)}
                  className="btn-accent mx-4 mt-4 text-center"
                >
                  Book Service
                </NavLink>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-20" id="main">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-navy to-navy/95 text-white relative overflow-hidden" role="contentinfo">
        {/* Patterns */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-light-blue rounded-full blur-3xl -translate-x-32 -translate-y-32" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent rounded-full blur-3xl translate-x-32 translate-y-32" />
        </div>

        <div className="relative z-10 container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Company Info */}
            <section className="md:col-span-2" aria-labelledby="footer-company">
              <h3 id="footer-company" className="sr-only">Company Info</h3>
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-light-blue to-accent flex items-center justify-center mr-4">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h4 className="text-2xl font-bold">Edgar's Mobile Auto Shop</h4>
                  <div className="flex items-center mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-accent fill-current mr-1" />
                    ))}
                    <span className="ml-2 text-white/80">500+ Happy Customers</span>
                  </div>
                </div>
              </div>
              <p className="text-white/90 leading-relaxed mb-6 text-lg">
                Professional mobile auto repair services bringing certified expertise 
                directly to your location. Experience automotive care reimagined for 
                the modern world.
              </p>
              <div className="flex items-center space-x-8">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mr-3">
                    <Shield className="h-5 w-5 text-light-blue" />
                  </div>
                  <span className="text-white/90">Licensed & Insured</span>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mr-3">
                    <Wrench className="h-5 w-5 text-accent" />
                  </div>
                  <span className="text-white/90">ASE Certified</span>
                </div>
              </div>
            </section>

            {/* Contact Info */}
            <section aria-labelledby="footer-contact">
              <h4 id="footer-contact" className="text-xl font-bold mb-6 text-white">Contact Info</h4>
              <div className="space-y-4">
                {CONTACT_INFO.map(({ icon: Icon, title, subtitle, href }, i) => (
                  <a
                    key={i}
                    href={href || '#'}
                    {...(href ? { 'aria-label': title } : {})}
                    className="flex items-center text-white/90 hover:text-accent transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/10 group-hover:bg-accent/20 flex items-center justify-center mr-4 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{title}</div>
                      {subtitle && <div className="text-sm text-white/70">{subtitle}</div>}
                    </div>
                  </a>
                ))}
              </div>
            </section>

            {/* Quick Links */}
            <section aria-labelledby="footer-links">
              <h4 id="footer-links" className="text-xl font-bold mb-6 text-white">Quick Links</h4>
              <nav className="space-y-3" aria-label="Footer">
                {FOOTER_QUICK_LINKS.map(({ label, to }) => (
                  <Link
                    key={to}
                    to={to}
                    className="block text-white/90 hover:text-accent transition-all font-medium hover:translate-x-1"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </section>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20">
          <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-white/80 mb-4 md:mb-0">
              © {new Date().getFullYear()} Edgar's Mobile Auto Shop. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-white/80">
              <span>Licensed & Insured</span>
              <span>•</span>
              <span>ASE Certified Technicians</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
