import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Phone, User } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import UserMenu from '../components/UserMenu';

const MobileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <div className="md:hidden">
      {/* Mobile menu button */}
      <button
        onClick={toggleMenu}
        className="inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        aria-expanded="false"
      >
        <span className="sr-only">Open main menu</span>
        {isOpen ? (
          <X className="block h-6 w-6" aria-hidden="true" />
        ) : (
          <Menu className="block h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {/* Mobile menu panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/about"
              className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-primary hover:bg-gray-50 rounded-md"
              onClick={closeMenu}
            >
              About
            </Link>
            <Link
              to="/service-areas"
              className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-primary hover:bg-gray-50 rounded-md"
              onClick={closeMenu}
            >
              Service Areas
            </Link>

            {/* Phone number */}
            <a
              href="tel:555-123-4567"
              className="flex items-center px-3 py-2 text-base font-medium text-muted-foreground hover:text-primary hover:bg-gray-50 rounded-md"
              onClick={closeMenu}
            >
              <Phone size={16} className="mr-2" />
              (555) 123-4567
            </a>

            {/* Divider */}
            <div className="border-t border-gray-200 my-2"></div>

            {/* Authentication section */}
            {user ? (
              <div className="space-y-1">
                <Link
                  to="/profile"
                  className="flex items-center px-3 py-2 text-base font-medium text-muted-foreground hover:text-primary hover:bg-gray-50 rounded-md"
                  onClick={closeMenu}
                >
                  <User size={16} className="mr-2" />
                  Profile & Vehicles
                </Link>
                <div className="px-3 py-2">
                  <UserMenu />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/login"
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-primary hover:bg-gray-50 rounded-md"
                  onClick={closeMenu}
                >
                  Sign In
                </Link>
                <div className="px-3">
                  <Button asLink to="/register" variant="outline" className="w-full" onClick={closeMenu}>
                    Sign Up
                  </Button>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-gray-200 my-2"></div>

            {/* Action buttons */}
            <div className="space-y-2 px-3">
              <Button asLink to="/booking" variant="outline" className="w-full" onClick={closeMenu}>
                Schedule Service
              </Button>
              <Button
                asLink
                to="/emergency"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={closeMenu}
              >
                Emergency Help
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay for mobile menu */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-25"
          onClick={closeMenu}
        />
      )}
    </div>
  );
};

export default MobileMenu;
