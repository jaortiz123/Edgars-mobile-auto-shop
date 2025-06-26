import { useQuery } from '@tanstack/react-query';
import { serviceAPI, type Service } from '../services/api';
import { Button } from '../components/ui/Button';
import ServiceList from '../components/ServiceList';
import { Award, Shield, Star, Zap } from 'lucide-react';

const features = [
	{
		icon: Award,
		title: 'ASE Certified',
		description: 'Our technicians are certified experts, ensuring top-quality service.',
	},
	{
		icon: Shield,
		title: 'Work Guaranteed',
		description: 'We stand by our work with a comprehensive service guarantee.',
	},
	{
		icon: Zap,
		title: 'Fast & Convenient',
		description: 'We bring all the necessary tools and parts directly to your location.',
	},
];

export default function Landing() {
	const { data: services, isLoading } = useQuery<Service[]>({
		queryKey: ['services'],
		queryFn: async () => {
			const res = await serviceAPI.getAll();
			return res?.data || [];
		},
	});

	return (
		<>
			{/* Hero Section */}
			<section className="bg-primary text-primary-foreground">
				<div className="container mx-auto px-4 py-24 text-center">
					<div className="flex justify-center items-center gap-2 mb-4">
						<Star className="text-amber-400 fill-amber-400" size={20} />
						<p className="font-semibold text-primary-foreground/80">500+ Happy Customers</p>
					</div>
					<h1 className="text-5xl md:text-6xl font-black tracking-tighter">Expert Auto Care, Delivered.</h1>
					<p className="max-w-2xl mx-auto mt-6 text-lg text-primary-foreground/80">
						Stop wasting time at the garage. Our certified technicians bring reliable car care directly to your home or
						office.
					</p>
					<div className="mt-10">
						<Button
							asLink
							to="/booking"
							size="lg"
							className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg scale-105 hover:scale-110 transition-transform"
						>
							Book Your Service Now
						</Button>
					</div>
				</div>
			</section>

			{/* Services Section */}
			<section id="services" className="py-24 px-4 bg-background">
				<div className="container mx-auto">
					<div className="text-center">
						<h2 className="text-base font-semibold text-primary/80 tracking-wider uppercase">Our Services</h2>
						<p className="mt-2 text-3xl font-extrabold text-primary tracking-tight sm:text-4xl">
							Complete Care For Your Vehicle
						</p>
					</div>
					<div className="mt-12">
						{isLoading ? (
							<div className="flex justify-center items-center h-48">
								<Zap className="animate-spin h-8 w-8 text-primary" />
							</div>
						) : (
							<ServiceList services={services || []} />
						)}
					</div>
				</div>
			</section>

			{/* Features/Trust Section */}
			<section className="bg-card py-24 px-4 border-y">
				<div className="container mx-auto grid md:grid-cols-3 gap-12 text-center">
					{features.map((feature) => {
						const Icon = feature.icon;
						return (
							<div key={feature.title}>
								<div className="flex items-center justify-center h-16 w-16 mx-auto bg-primary text-primary-foreground rounded-lg mb-4">
									<Icon className="h-8 w-8" />
								</div>
								<h3 className="mt-4 text-xl font-bold text-primary">{feature.title}</h3>
								<p className="mt-2 text-muted-foreground">{feature.description}</p>
							</div>
						);
					})}
				</div>
			</section>
		</>
	);
}