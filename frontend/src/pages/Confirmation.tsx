import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, Calendar, Clock, MapPin, ArrowLeft, Wrench, Star, Sparkles, Phone, Mail, Download, Share2, PartyPopper, Trophy, Shield, Award, Zap, Heart } from 'lucide-react';
import type { Appointment } from '../services/api';
import { useEffect, useState } from 'react';

// Extended appointment interface for enhanced booking data
interface EnhancedAppointment extends Appointment {
  service_name?: string;
  customer_name?: string;
  customer_phone?: string;
  duration?: number;
  estimated_total?: number;
  date?: string;
  time?: string;
  address?: string;
}

// Celebration particle component
const ConfettiParticle = ({ delay }: { delay: number }) => (
  <div 
    className="absolute w-2 h-2 bg-accent rounded-full animate-bounce opacity-80"
    style={{
      left: `${Math.random() * 100}%`,
      animationDelay: `${delay}ms`,
      animationDuration: `${1000 + Math.random() * 1000}ms`
    }}
  />
);

// Success animation component
const SuccessAnimation = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative">
      {/* Confetti particles */}
      {[...Array(20)].map((_, i) => (
        <ConfettiParticle key={i} delay={i * 100} />
      ))}
      
      {/* Success icon with animation */}
      <div className={`relative transition-all duration-1000 ${isVisible ? 'scale-100 rotate-0' : 'scale-0 rotate-180'}`}>
        <div className="w-24 h-24 bg-gradient-to-br from-accent to-light-blue rounded-full flex items-center justify-center mx-auto shadow-2xl">
          <CheckCircle className="h-12 w-12 text-white animate-pulse" />
          
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent to-light-blue rounded-full opacity-20 animate-ping"></div>
        </div>
        
        {/* Celebration icons */}
        <PartyPopper className="absolute -top-2 -right-2 h-8 w-8 text-accent animate-bounce" />
        <Trophy className="absolute -bottom-2 -left-2 h-6 w-6 text-light-blue animate-pulse" />
      </div>
    </div>
  );
};

export default function Confirmation() {
  const location = useLocation();
  const { appointment } = (location.state as { appointment: EnhancedAppointment }) || {};
  const [showCelebration, setShowCelebration] = useState(true);

  // Enhanced celebration effect
  useEffect(() => {
    const timer = setTimeout(() => setShowCelebration(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Redirect to booking if no appointment data
  useEffect(() => {
    if (!appointment && location.state === null) {
      const timeout = setTimeout(() => {
        window.location.href = '/booking';
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [appointment, location.state]);

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-bg-light via-white to-bg-light flex items-center justify-center px-4">
        <div className="max-w-lg mx-auto glass-card p-8 rounded-2xl text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-navy mb-4">No Appointment Found</h2>
          <p className="text-text-dark mb-6">We couldn't find your appointment information.</p>
          <p className="text-sm text-gray mb-6">You will be redirected to the booking page shortly...</p>
          <Link to="/booking" className="btn-accent px-6 py-3">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Booking
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatTime = (timeString: string) => {
    // Handle both time formats: "14:30" and "2:30 PM"
    if (timeString.includes(':') && !timeString.includes('M')) {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    }
    return timeString;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-light via-white to-bg-light relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-light-blue/10 rounded-full blur-3xl"></div>
        
        {/* Celebration overlay */}
        {showCelebration && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-accent rounded-full animate-ping opacity-60"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2000}ms`,
                  animationDuration: `${1000 + Math.random() * 2000}ms`
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        
        {/* Header with Celebration */}
        <header className="text-center mb-12">
          <SuccessAnimation />
          
          <div className="mt-8">
            <h1 className="hero-modern text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-navy via-accent to-light-blue bg-clip-text text-transparent">
              Booking Confirmed!
            </h1>
            <div className="flex items-center justify-center mb-6">
              <Sparkles className="h-6 w-6 text-accent mr-3 animate-pulse" />
              <p className="text-body text-xl text-text-dark">Your premium mobile service is scheduled</p>
              <Sparkles className="h-6 w-6 text-accent ml-3 animate-pulse" />
            </div>
          </div>
        </header>

        {/* Main Confirmation Card */}
        <div className="floating-card mb-12">
          
          {/* Appointment Details Header */}
          <div className="text-center mb-8 pb-8 border-b border-gray-100">
            <div className="inline-flex items-center glass-card px-6 py-3 rounded-full mb-4">
              <Award className="h-5 w-5 text-accent mr-3" />
              <span className="font-bold text-navy">Appointment #{appointment.id}</span>
            </div>
            <p className="text-gray text-lg">Save this reference number for your records</p>
          </div>

          {/* Appointment Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            
            {/* Service Details */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-navy mb-6 flex items-center">
                <Wrench className="h-6 w-6 text-light-blue mr-3" />
                Service Details
              </h3>
              
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-light-blue to-accent rounded-xl flex items-center justify-center mr-4">
                    <Wrench className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-gray">Service</div>
                    <div className="font-bold text-navy text-lg">
                      {appointment.service_name || `Service #${appointment.service_id}`}
                    </div>
                  </div>
                </div>
                
                {appointment.duration && (
                  <div className="flex items-center text-sm text-gray pt-4 border-t border-gray-100">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>Estimated duration: {appointment.duration} minutes</span>
                  </div>
                )}
              </div>

              {/* Pricing */}
              {appointment.estimated_total && (
                <div className="glass-card p-6 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray">Total Amount</div>
                      <div className="text-3xl font-bold text-accent">
                        ${appointment.estimated_total}
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-accent to-light-blue rounded-xl flex items-center justify-center">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-xs text-gray mt-2">Payment due at time of service</p>
                </div>
              )}
            </div>

            {/* Schedule & Location */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-navy mb-6 flex items-center">
                <Calendar className="h-6 w-6 text-light-blue mr-3" />
                Schedule & Location
              </h3>
              
              {/* Date & Time */}
              <div className="glass-card p-6 rounded-xl">
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-light-blue to-accent rounded-xl flex items-center justify-center mr-4">
                      <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-gray">Date</div>
                      <div className="font-bold text-navy">
                        {(appointment.scheduled_date || appointment.date) ? 
                          formatDate(appointment.scheduled_date || appointment.date!) : 
                          'Date not specified'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-accent to-light-blue rounded-xl flex items-center justify-center mr-4">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-gray">Time</div>
                      <div className="font-bold text-navy">
                        {(appointment.scheduled_time || appointment.time) ? 
                          formatTime(appointment.scheduled_time || appointment.time!) : 
                          'Time not specified'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-gradient-to-br from-light-blue to-accent rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-gray">Service Address</div>
                    <div className="font-bold text-navy leading-relaxed">
                      {appointment.location_address || appointment.address}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          {appointment.customer_name && (
            <div className="glass-card p-6 rounded-xl mb-8">
              <h4 className="font-bold text-navy mb-4 flex items-center">
                <Star className="h-5 w-5 text-accent mr-2" />
                Customer Information
              </h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray">Name:</span>
                  <span className="font-semibold text-navy ml-2">{appointment.customer_name}</span>
                </div>
                {appointment.customer_phone && (
                  <div>
                    <span className="text-gray">Phone:</span>
                    <span className="font-semibold text-navy ml-2">{appointment.customer_phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* What's Next Section */}
        <div className="floating-card mb-12">
          <h3 className="text-2xl font-bold text-navy mb-8 text-center flex items-center justify-center">
            <Heart className="h-6 w-6 text-accent mr-3" />
            What Happens Next?
          </h3>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 glass-card rounded-xl">
              <div className="w-16 h-16 bg-gradient-to-br from-light-blue to-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="h-8 w-8 text-white" />
              </div>
              <h4 className="font-bold text-navy mb-2">Confirmation Call</h4>
              <p className="text-gray text-sm">We'll call you within 15 minutes to confirm your appointment details</p>
            </div>
            
            <div className="text-center p-6 glass-card rounded-xl">
              <div className="w-16 h-16 bg-gradient-to-br from-accent to-light-blue rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <h4 className="font-bold text-navy mb-2">Email Confirmation</h4>
              <p className="text-gray text-sm">Check your email for detailed appointment information and preparation tips</p>
            </div>
            
            <div className="text-center p-6 glass-card rounded-xl">
              <div className="w-16 h-16 bg-gradient-to-br from-light-blue to-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h4 className="font-bold text-navy mb-2">Service Day</h4>
              <p className="text-gray text-sm">Our certified technician will arrive at your location with all necessary equipment</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link 
            to="/" 
            className="btn-accent px-8 py-4 text-lg flex items-center group"
          >
            <ArrowLeft className="h-5 w-5 mr-3 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>
          
          <button className="btn-modern px-8 py-4 text-lg flex items-center group">
            <Share2 className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
            Share Confirmation
          </button>
          
          <button className="btn-modern px-8 py-4 text-lg flex items-center group">
            <Download className="h-5 w-5 mr-3 group-hover:translate-y-1 transition-transform" />
            Download Receipt
          </button>
        </div>

        {/* Contact Information */}
        <div className="text-center mt-12 glass-card p-6 rounded-xl">
          <h4 className="font-bold text-navy mb-4">Need to Make Changes?</h4>
          <p className="text-gray mb-4">
            Contact us at least 2 hours before your appointment to make any changes
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm">
            <a href="tel:+15551234567" className="flex items-center text-accent hover:text-light-blue transition-colors">
              <Phone className="h-4 w-4 mr-2" />
              (555) 123-4567
            </a>
            <a href="mailto:booking@edgarsmobile.com" className="flex items-center text-accent hover:text-light-blue transition-colors">
              <Mail className="h-4 w-4 mr-2" />
              booking@edgarsmobile.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
