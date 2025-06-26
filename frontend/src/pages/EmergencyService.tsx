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
          <Button as="a" href="tel:555-123-4567" size="lg" className="bg-accent text-accent-foreground text-2xl h-16 px-12 transform transition-transform hover:scale-105">
            <Phone className="mr-4 h-8 w-8" />
            Call for Immediate Help
          </Button>
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
