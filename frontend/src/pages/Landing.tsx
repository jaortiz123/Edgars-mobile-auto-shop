import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/Card';
import { Star, Shield, Award, CheckCircle, Wrench } from 'lucide-react';

// Single source of truth for the services we want to showcase
const featuredServices = [
    { 
        name: "Emergency No-Start Service",
        description: "Battery, starter, or alternator replacement to get you back on the road, fast.",
        price: 95,
        pricePrefix: "Diagnostics from"
    },
    { 
        name: "On-Site Brake Repair",
        description: "Complete brake pad and rotor replacement at your home or office for ultimate safety.",
        price: 150,
        pricePrefix: "Service from"
    },
    { 
        name: "Check Engine Light Diagnostics",
        description: "We use dealership-level tools to accurately diagnose the problem and provide a clear repair plan.",
        price: 75,
        pricePrefix: "Scan & Diagnosis"
    },
];

const testimonial = { 
    name: "Jessica R., Davis, CA", 
    text: "My car died suddenly on the freeway during my commute. I was sure I'd need a tow and a long wait at a shop. Edgar came out, diagnosed the dead alternator, and had the new part installed in under two hours. He really saved my day!",
    headline: '"He fixed my car right on the side of the highway!"'
};

export default function Landing() {
  return (
    <div className="bg-background text-foreground">

      {/* 1. HERO (Larger, more breathing room) */}
      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-24 md:py-32 text-center"> {/* Increased padding */}
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter max-w-4xl mx-auto">
            Your Trusted Woodland Mechanic, Delivered to Your Driveway.
          </h1>
          <p className="max-w-3xl mx-auto mt-6 text-xl text-primary-foreground/80">
            Certified, dealership-quality repairs at your home or office. No waiting rooms, no wasted time.
          </p>
          <div className="mt-10">
            <Button asLink to="/booking" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              Book Mobile Service Now
            </Button>
          </div>
        </div>
      </section>

      {/* 2. THREE SERVICE CARDS (with pricing and CTAs) */}
      <section id="services" className="py-20 md:py-24 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {featuredServices.map(service => (
              <Card key={service.name} className="flex flex-col text-center">
                <CardHeader>
                  <Wrench className="mx-auto h-10 w-10 text-accent mb-4" />
                  <CardTitle>{service.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-muted-foreground">{service.description}</p>
                </CardContent>
                <CardFooter className="flex-col items-center gap-4 pt-4">
                    <div>
                        <span className="text-sm text-muted-foreground">{service.pricePrefix}</span>
                        <p className="text-4xl font-extrabold text-primary">${service.price}</p>
                    </div>
                  <Button asLink to="/booking" variant="outline" className="w-full font-bold">
                    Select & Continue →
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 3. SINGLE TESTIMONIAL */}
      <section className="bg-secondary py-20 md:py-24 px-4 border-y">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold text-primary tracking-tight">
              {testimonial.headline}
          </h2>
          <blockquote className="mt-8 text-xl text-muted-foreground italic">
              "{testimonial.text}"
          </blockquote>
          <p className="mt-4 text-lg font-semibold text-primary">- {testimonial.name}</p>
        </div>
      </section>

      {/* 4. TRUST BADGES (Tighter Padding) */}
      <section className="py-12 px-4"> {/* Reduced padding */}
        <div className="container mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                    <Shield className="h-8 w-8 text-primary" />
                    <span className="font-bold text-sm text-primary">Licensed & Insured</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-3">
                    <Award className="h-8 w-8 text-primary" />
                    <span className="font-bold text-sm text-primary">ASE Certified</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-3">
                    <Star className="h-8 w-8 text-primary" />
                    <span className="font-bold text-sm text-primary">5.0 Star Rating</span>
                </div>
                 <div className="flex flex-col items-center justify-center gap-3">
                    <CheckCircle className="h-8 w-8 text-primary" />
                    <span className="font-bold text-sm text-primary">Satisfaction Guarantee</span>
                </div>
            </div>
        </div>
      </section>
      
      {/* Footer will naturally follow */}
    </div>
  );
}
