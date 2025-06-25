import { CheckCircle, MapPin, Wrench, Car, Shield, Star, Calendar, Phone, Award, Zap } from 'lucide-react'
import ServiceListContainer from '../containers/ServiceListContainer'
import Section from '../components/Section'
import Button from '../components/Button'

// Extracted data arrays
const HERO_STATS = [
  { number: '500+', label: 'Happy Customers' },
  { number: '5+', label: 'Years Experience' },
  { number: '24/7', label: 'Emergency Service' },
  { number: '100%', label: 'Satisfaction Rate' }
]

const FEATURES = [
  {
    icon: MapPin,
    title: 'We Come to You',
    description: 'Your driveway, office parking lot, or anywhere you need service. We bring all the tools and expertise directly to your location.',
    bgColor: 'bg-navy/10',
    iconColor: 'text-navy'
  },
  {
    icon: Award,
    title: 'Certified Professionals',
    description: 'ASE-certified technicians with years of experience. Quality workmanship and transparent pricing you can trust.',
    bgColor: 'bg-light-blue/10',
    iconColor: 'text-light-blue'
  },
  {
    icon: Shield,
    title: 'Guaranteed Work',
    description: 'Every repair comes with our comprehensive warranty. If it\'s not right, we make it right. Your satisfaction is guaranteed.',
    bgColor: 'bg-accent/10',
    iconColor: 'text-accent'
  }
]

const TESTIMONIALS = [
  {
    quote: "Edgar came right to my office and fixed my car while I was working. Professional, fast, and transparent pricing. This is the future of car repair!",
    author: "Sarah M.",
    role: "Local Business Owner"
  },
  {
    quote: "Quality work with modern convenience. Edgar's team knows cars inside and out. My family won't trust anyone else with our vehicles.",
    author: "Mike T.",
    role: "Loyal Customer Since 2020"
  }
]

const CREDENTIALS = [
  {
    icon: Shield,
    title: 'Fully Insured',
    subtitle: 'Comprehensive coverage'
  },
  {
    icon: Award,
    title: 'ASE Certified',
    subtitle: 'Professional technicians'
  },
  {
    icon: CheckCircle,
    title: 'Licensed',
    subtitle: 'State certified business'
  }
]

export default function Landing() {
  return (
    <div className="space-y-16 bg-white">
      {/* Hero Section */}
      <Section className="py-20" ariaLabel="Hero section with company introduction">
        <div className="text-center">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-center mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 text-accent fill-current mx-1" />
              ))}
              <span className="text-gray ml-4 font-semibold text-lg">Trusted Since 2019</span>
            </div>

            <h1 className="hero-modern text-5xl md:text-7xl font-bold mb-6 leading-tight text-navy">
              Professional Mobile<br />
              <span className="text-accent">Auto Repair</span>
            </h1>
            
            <p className="text-xl md:text-2xl mb-10 text-text-dark leading-relaxed max-w-3xl mx-auto">
              We bring certified automotive expertise directly to your location. 
              Professional service without the hassle of traditional repair shops.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button
                to="/booking"
                variant="primary"
                style={{ backgroundColor: 'var(--color-accent)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d85a10'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent)'}
              >
                <Calendar className="h-6 w-6 mr-3" />
                Book Service Now
              </Button>
              <Button
                href="tel:5551234567"
                variant="outline"
              >
                <Phone className="h-6 w-6 mr-3" />
                Call (555) 123-4567
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Features Section */}
      <Section ariaLabelledBy="features-heading">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 id="features-heading" className="heading-display text-4xl font-bold text-navy mb-4">Why Choose Edgar's Mobile Auto Shop?</h2>
            <p className="text-body text-lg text-text-dark max-w-2xl mx-auto">
              Experience the convenience of professional automotive service at your location
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((feature, index) => {
              const IconComponent = feature.icon
              return (
                <article key={index} className="floating-card text-center p-8 bg-white rounded-xl shadow-lg border border-gray/20 hover:border-light-blue transition-all">
                  <div className={`w-16 h-16 ${feature.bgColor} rounded-full flex items-center justify-center mx-auto mb-6`}>
                    <IconComponent className={`h-8 w-8 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-navy">{feature.title}</h3>
                  <p className="text-text-dark leading-relaxed">
                    {feature.description}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </Section>

      {/* Services Section */}
      <Section bgColor="light" ariaLabelledBy="services-heading">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <Wrench className="h-8 w-8 text-light-blue mr-3" />
              <h2 id="services-heading" className="heading-display text-4xl font-bold text-navy">
                Our Services
              </h2>
              <Wrench className="h-8 w-8 text-light-blue ml-3 scale-x-[-1]" />
            </div>
            <p className="text-body text-lg text-text-dark max-w-2xl mx-auto">
              From routine maintenance to complex repairs, we handle it all with 
              professional equipment and genuine parts.
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <ServiceListContainer />
          </div>
        </div>
      </Section>

      {/* Stats Section */}
      <Section ariaLabel="Company statistics and achievements">
        <div 
          className="stats-modern max-w-4xl mx-auto text-white rounded-xl p-12 shadow-xl"
          style={{ 
            background: 'linear-gradient(to right, var(--color-light-blue), rgba(56, 189, 248, 0.9))'
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            {HERO_STATS.map((stat, index) => (
              <div key={index}>
                <div className="stats-number text-5xl font-bold mb-2">{stat.number}</div>
                <div className="font-semibold opacity-90">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Testimonials */}
      <Section bgColor="light" ariaLabelledBy="testimonials-heading">
        <div className="max-w-4xl mx-auto text-center">
          <h2 id="testimonials-heading" className="heading-display text-4xl font-bold text-navy mb-12">What Our Customers Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {TESTIMONIALS.map((testimonial, index) => (
              <figure key={index} className="testimonial-card bg-white p-8 rounded-xl shadow-lg border border-gray/20">
                <div className="flex justify-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-light-blue fill-current mx-0.5" />
                  ))}
                </div>
                <blockquote className="testimonial-quote text-text-dark mb-6 italic leading-relaxed text-lg">
                  "{testimonial.quote}"
                </blockquote>
                <figcaption>
                  <div className="font-bold text-navy text-lg">- {testimonial.author}</div>
                  <div className="text-gray text-sm">{testimonial.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </Section>

      {/* Trust Indicators */}
      <Section ariaLabelledBy="credentials-heading">
        <div className="max-w-4xl mx-auto text-center">
          <h2 id="credentials-heading" className="text-3xl font-bold text-navy mb-8">Licensed, Insured & Certified</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CREDENTIALS.map((credential, index) => {
              const IconComponent = credential.icon
              return (
                <article key={index} className="flex items-center justify-center p-6 bg-white rounded-lg border border-gray/20">
                  <IconComponent className="h-8 w-8 text-light-blue mr-3" />
                  <div className="text-left">
                    <div className="font-bold text-navy">{credential.title}</div>
                    <div className="text-gray text-sm">{credential.subtitle}</div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </Section>

      {/* CTA Section */}
      <Section bgColor="navy" ariaLabel="Call to action section">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center mb-6">
            <Zap className="h-12 w-12 text-light-blue mr-4" />
            <h2 className="text-4xl font-bold text-white">Ready to Get Started?</h2>
            <Zap className="h-12 w-12 text-light-blue ml-4" />
          </div>
          <p className="text-xl mb-8 text-white/90">
            Experience the convenience of mobile auto repair. Book your service today and see why 
            500+ customers trust Edgar's Mobile Auto Shop.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              to="/booking"
              variant="accent"
              style={{ backgroundColor: 'var(--color-accent)' }}
              onMouseEnter={(e: React.MouseEvent<HTMLElement>) => e.currentTarget.style.backgroundColor = '#d85a10'}
              onMouseLeave={(e: React.MouseEvent<HTMLElement>) => e.currentTarget.style.backgroundColor = 'var(--color-accent)'}
            >
              <Car className="h-6 w-6 mr-3" />
              Schedule Your Service
            </Button>
            <Button
              href="tel:5551234567"
              variant="light-outline"
              style={{ borderColor: 'var(--color-light-blue)' }}
              onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
                e.currentTarget.style.backgroundColor = 'var(--color-light-blue)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-light-blue)';
              }}
            >
              <Phone className="h-6 w-6 mr-3" />
              Call Now
            </Button>
          </div>
        </div>
      </Section>
    </div>
  )
}

