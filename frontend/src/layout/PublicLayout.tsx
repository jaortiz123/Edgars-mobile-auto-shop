import { Link, Outlet } from 'react-router-dom';
import { Suspense } from 'react';
import { Button } from '../components/ui/Button';
import { Phone, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import UserMenu from '../components/UserMenu';
import MobileMenu from '../components/MobileMenu';

export default function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* NEW URGENCY BANNER */}
      <div className="bg-primary text-primary-foreground py-2 px-4 text-center text-xs sm:text-sm font-semibold">
        <p>
          <span className="bg-accent text-accent-foreground rounded-md px-2 py-0.5 mr-2">SAVE $25</span>
          Book your first service today! Next available appointment is in 2 Hours.
        </p>
      </div>
      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="container flex h-20 items-center justify-between">
          <Link to="/" className="text-2xl font-black text-primary">
            Edgar's Mobile Auto Shop Repair
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 md:flex">
            <a href="tel:555-123-4567" className="text-base font-medium flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary">
                <Phone size={16} />
                (555) 123-4567
            </a>
            <Link to="/about" className="text-base font-medium text-muted-foreground transition-colors hover:text-primary">About</Link>
            <Link to="/service-areas" className="text-base font-medium text-muted-foreground transition-colors hover:text-primary">Service Areas</Link>
            
            {/* Authentication-dependent navigation */}
            {user ? (
              <UserMenu />
            ) : (
              <>
                <Link to="/login" className="text-base font-medium text-muted-foreground transition-colors hover:text-primary">Sign In</Link>
                <Button asLink to="/register" variant="outline">
                  Sign Up
                </Button>
              </>
            )}
            
            {/* The dual funnel is now in the main navigation */}
            <Button asLink to="/booking" variant="outline">
              Schedule Service
            </Button>
            <Button asLink to="/emergency" className="bg-accent text-accent-foreground hover:bg-accent/90">
              Emergency Help
            </Button>
          </nav>

          {/* Mobile Navigation */}
          <MobileMenu />
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1">
        <Suspense fallback={<div className="flex h-96 items-center justify-center font-semibold">Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>
      
      {/* FOOTER */}
      <footer className="bg-primary text-primary-foreground">
        <div className="container grid grid-cols-1 md:grid-cols-3 gap-8 py-16 text-center md:text-left">
          {/* Col 1: Brand */}
          <div className="md:col-span-1">
            <h3 className="text-xl font-bold">Edgar's Mobile Auto Shop Repair</h3>
            <p className="mt-2 text-primary-foreground/80">Expert auto repair, delivered to your door.</p>
          </div>
          {/* Col 2: Navigation (Aligned) */}
          <div className="md:justify-self-center">
            <h4 className="font-semibold uppercase tracking-wider">Navigation</h4>
            <ul className="mt-4 space-y-2 text-primary-foreground/80">
              <li><a href="/" className="hover:underline">Home</a></li>
              <li><a href="/#services" className="hover:underline">Services</a></li>
              <li><a href="/booking" className="hover:underline">Book Now</a></li>
            </ul>
          </div>
          {/* Col 3: Contact (Aligned) */}
          <div className="md:justify-self-end">
            <h4 className="font-semibold uppercase tracking-wider">Contact</h4>
            <ul className="mt-4 space-y-2 text-primary-foreground/80">
              <li>(555) 123-4567</li>
              <li>contact@edgarsmobile.com</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-primary-foreground/10 py-6">
            <p className="text-center text-sm text-primary-foreground/60">
                © {new Date().getFullYear()} Edgar's Mobile Auto Shop Repair. All Rights Reserved.
            </p>
        </div>
      </footer>

      {/* ENHANCED: Live Chat / Text Us Widget */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
            size="lg" 
            className="rounded-full h-16 w-16 shadow-2xl bg-accent hover:bg-accent/90 transform transition-transform hover:scale-110"
            onClick={() => {
              const userChoice = window.confirm(
                '💬 Contact Edgar\'s Mobile Auto Shop\n\n' +
                '📱 Text us directly: (555) 123-4567\n' +
                '📞 Call us now: (555) 123-4567\n' +
                '🚨 Emergency? Click OK for emergency service!\n\n' +
                'Click OK to call now, or Cancel to text us.'
              );
              
              if (userChoice) {
                // User chose to call
                window.open('tel:555-123-4567');
              } else {
                // User chose to text - open SMS on mobile devices
                const message = encodeURIComponent('Hi! I need help with auto service. Can you assist me?');
                const smsLink = `sms:555-123-4567?body=${message}`;
                
                // Try to open SMS app, fallback to showing instructions
                try {
                  window.open(smsLink);
                } catch (error) {
                  alert(
                    '📱 Text us at: (555) 123-4567\n\n' +
                    'Send: "Hi! I need help with auto service."\n\n' +
                    '⚡ We typically respond within 5 minutes!\n' +
                    '🚨 For emergencies, please call instead.'
                  );
                }
              }
            }}
        >
            <MessageSquare className="h-8 w-8 text-accent-foreground" />
        </Button>
      </div>
      {/* NEW: Sticky Mobile CTA */}
      <div className="sticky bottom-0 z-40 md:hidden bg-background/80 backdrop-blur-sm p-4 border-t">
          <Button asLink to="/booking" size="lg" className="w-full bg-accent text-accent-foreground">
            Book Mobile Service Now
          </Button>
      </div>
    </div>
  );
}
