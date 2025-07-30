import { Award, Shield, Wrench } from 'lucide-react';

export default function About() {
  return (
    <div className="bg-background">
      <section className="py-sp-6 md:py-sp-8 px-sp-3">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-sp-6 items-center">
            {/* Left Column: The Story */}
            <div>
              <h2 className="text-fs-2 font-semibold text-accent tracking-wider uppercase">Our Mission</h2>
              <p className="mt-sp-2 text-fs-6 font-extrabold text-primary tracking-tight">
                Honest, Convenient Auto Repair for Our Community.
              </p>
              <p className="mt-sp-4 text-fs-3 text-muted-foreground">
                Edgar's Mobile Auto was founded on a simple principle: provide dealership-quality auto repair without the hassle and inflated pricing. As a family-owned business based in Woodland, we treat every customer's vehicle as if it were our own.
              </p>
              <p className="mt-sp-3 text-fs-3 text-muted-foreground">
                Our lead technician, Edgar, is an ASE Master Technician with over 15 years of experience working on everything from daily drivers to high-performance vehicles. We invest in the latest diagnostic tools so we can solve your problem quickly and accurately, the first time.
              </p>
            </div>
            {/* Right Column: The Proof */}
            <div className="bg-card p-sp-5 rounded-lg border">
              <h3 className="text-fs-5 font-bold text-primary mb-sp-4">Your Peace of Mind is Our Priority</h3>
              <ul className="space-y-sp-4">
                <li className="flex items-start gap-sp-3">
                  <Award className="h-8 w-8 text-accent flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold">ASE Master Technician</h4>
                    <p className="text-fs-1 text-muted-foreground">The highest level of certification, ensuring expert service.</p>
                  </div>
                </li>
                <li className="flex items-start gap-sp-3">
                  <Shield className="h-8 w-8 text-accent flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold">Licensed & Insured</h4>
                    <p className="text-fs-1 text-muted-foreground">Fully licensed by the CA Bureau of Automotive Repair and comprehensively insured.</p>
                  </div>
                </li>
                 <li className="flex items-start gap-sp-3">
                  <Wrench className="h-8 w-8 text-accent flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold">12-Month / 12,000-Mile Warranty</h4>
                    <p className="text-fs-1 text-muted-foreground">We stand by every repair with an industry-leading warranty.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
