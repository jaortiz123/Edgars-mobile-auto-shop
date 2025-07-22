import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MapPin, Wrench, Shield } from 'lucide-react';

const serviceAreas = [
	{ name: 'Woodland', zip: '95695, 95776' },
	{ name: 'Davis', zip: '95616, 95618' },
	{ name: 'Dixon', zip: '95620' },
	{ name: 'West Sacramento', zip: '95605, 95691' },
];

export default function ServiceAreas() {
	return (
		<div className="bg-background">
			{/* Hero Section */}
			<section className="bg-secondary border-b py-16 md:py-24">
				<div className="container mx-auto px-4 text-center">
					<h1 className="text-5xl font-black text-primary tracking-tight">
						On-Site Service Across the Region
					</h1>
					<p className="mt-6 text-xl max-w-3xl mx-auto text-muted-foreground">
						Whether you&apos;re at home in Woodland or at the office in Davis, our
						fully-equipped mobile repair vans bring the workshop to you.
					</p>
				</div>
			</section>

			{/* Main Content Area */}
			<section className="py-16 md:py-24 px-4">
				<div className="container mx-auto">
					<div className="grid lg:grid-cols-3 gap-16">
						{/* Left Column: Service Zones */}
						<div className="lg:col-span-2">
							<h2 className="text-3xl font-bold text-primary mb-8">
								Our Primary Mobile Service Zones
							</h2>
							<div className="grid sm:grid-cols-2 gap-6">
								{serviceAreas.map((area) => (
									<Card key={area.name} className="bg-card border text-center">
										<CardHeader>
											<MapPin className="mx-auto h-10 w-10 text-accent" />
											<CardTitle className="mt-4">{area.name}</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="text-sm text-muted-foreground">
												Zip Codes: {area.zip}
											</p>
										</CardContent>
									</Card>
								))}
							</div>
						</div>

						{/* Right Column: Value Prop */}
						<div className="lg:col-span-1">
							<div className="bg-card p-8 rounded-lg border sticky top-28">
								<h3 className="text-2xl font-bold text-primary mb-6">
									The Same Expert Service, Everywhere.
								</h3>
								<ul className="space-y-4">
									<li className="flex items-start gap-3">
										<Wrench className="h-6 w-6 text-accent flex-shrink-0 mt-1" />
										<div>
											<h4 className="font-semibold">Dealership-Quality Tools</h4>
											<p className="text-sm text-muted-foreground">
												Our vans are equipped with the same advanced diagnostic tools
												and equipment as a traditional shop.
											</p>
										</div>
									</li>
									<li className="flex items-start gap-3">
										<Shield className="h-6 w-6 text-accent flex-shrink-0 mt-1" />
										<div>
											<h4 className="font-semibold">Consistent Pricing</h4>
											<p className="text-sm text-muted-foreground">
												We offer transparent, upfront pricing with no hidden travel
												fees within our primary service zones.
											</p>
										</div>
									</li>
								</ul>
								<Button
									asLink
									to="/booking"
									className="w-full mt-8 bg-accent text-accent-foreground"
								>
									Book Your Mobile Service
								</Button>
							</div>
						</div>
					</div>
					{/* NEW CTA SECTION - Fills the void */}
					<div className="text-center border-t mt-16 pt-16">
						<h3 className="text-2xl font-bold text-primary">
							Don&apos;t See Your Area?
						</h3>
						<p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
							We frequently expand our service radius for larger jobs or fleet
							accounts. Give us a call to see if we can come to you.
						</p>
						<div className="mt-8">
							<a href="tel:555-123-4567">
								<Button size="lg">Call Us to Inquire</Button>
							</a>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
