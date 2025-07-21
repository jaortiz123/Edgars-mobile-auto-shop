import { Button } from '../components/ui/Button';
import { Phone, AlertTriangle, Zap, Car } from 'lucide-react';

export default function EmergencyService() {
  return (
    <div className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-24 text-center">
        <div className="flex justify-center mb-6">
          <AlertTriangle className="h-16 w-16 text-accent" />
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter">
          Stranded? Need Help Now?
        </h1>
        <p className="max-w-2xl mx-auto mt-6 text-xl text-primary-foreground/80">
          For immediate, on-site emergency assistance for no-starts, dead batteries, flat tires, and critical brake issues, call us directly.
        </p>
        <div className="mt-12">
          <a 
            href="tel:555-123-4567" 
            className="inline-flex items-center justify-center rounded-lg text-base font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg hover:shadow-xl hover:-translate-y-0.5 px-8 py-4 text-lg text-2xl h-16 px-12 transform transition-transform hover:scale-105"
          >
            <Phone className="mr-4 h-8 w-8" />
            Call for Immediate Help
          </a>
        </div>
        <div className="mt-20 max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
            <div className="text-center">
                <Zap className="mx-auto h-10 w-10 mb-2"/>
                <h3 className="font-bold">Fast Response</h3>
                <p className="text-sm text-primary-foreground/70">We prioritize emergency calls to get to you as quickly as possible.</p>
            </div>
             <div className="text-center">
                <Car className="mx-auto h-10 w-10 mb-2"/>
                <h3 className="font-bold">On-Site Repair</h3>
                <p className="text-sm text-primary-foreground/70">Our van is a workshop on wheels. We fix most common issues on the spot.</p>
            </div>
             <div className="text-center">
                <Phone className="mx-auto h-10 w-10 mb-2"/>
                <h3 className="font-bold">Speak to a Mechanic</h3>
                <p className="text-sm text-primary-foreground/70">Your call goes directly to a technician who can assess your situation.</p>
            </div>
        </div>
      </div>
    </div>
  );
}
