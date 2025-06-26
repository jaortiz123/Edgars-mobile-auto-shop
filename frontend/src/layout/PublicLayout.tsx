import { Link, Outlet } from 'react-router-dom';
import { Suspense } from 'react';
import { Button } from '../components/ui/Button';

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-sm">
        <div className="container flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {/* Placeholder for your logo image. Looks clean as text. */}
            <span className="text-2xl font-black text-primary">Edgar's Mobile Auto</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link to="/#services" className="text-base font-medium text-muted-foreground transition-colors hover:text-primary">
              Services
            </Link>
            <Button asLink to="/booking" className="bg-accent text-accent-foreground hover:bg-accent/90">
              Book Now
            </Button>
          </nav>
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
        <div className="container grid grid-cols-1 gap-8 py-16 md:grid-cols-3">
          <div>
            <h3 className="text-xl font-bold">Edgar's Mobile Auto</h3>
            <p className="mt-2 text-primary-foreground/80">Expert auto repair, delivered to your door.</p>
          </div>
          <div className="md:col-span-2 md:justify-self-end">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold">Navigation</h4>
                <ul className="mt-2 space-y-1 text-primary-foreground/80">
                  <li><Link to="/" className="hover:underline">Home</Link></li>
                  <li><Link to="/#services" className="hover:underline">Services</Link></li>
                  <li><Link to="/booking" className="hover:underline">Book Now</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold">Contact</h4>
                <ul className="mt-2 space-y-1 text-primary-foreground/80">
                  <li>(555) 123-4567</li>
                  <li>contact@edgarsmobile.com</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-primary-foreground/10 py-6">
            <p className="text-center text-sm text-primary-foreground/60">
                © {new Date().getFullYear()} Edgar's Mobile Auto. All Rights Reserved.
            </p>
        </div>
      </footer>
    </div>
  );
}
