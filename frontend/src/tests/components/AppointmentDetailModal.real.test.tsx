import React from 'react';
import { render, screen, fireEvent } from '@test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppointmentDetailModal } from '@/components/admin/AppointmentDetailModal';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: ({ className, ...props }: any) => <div data-testid="x-icon" className={className} {...props} />,
  Phone: ({ className, ...props }: any) => <div data-testid="phone-icon" className={className} {...props} />,
  MapPin: ({ className, ...props }: any) => <div data-testid="mappin-icon" className={className} {...props} />,
  Clock: ({ className, ...props }: any) => <div data-testid="clock-icon" className={className} {...props} />,
  Wrench: ({ className, ...props }: any) => <div data-testid="wrench-icon" className={className} {...props} />,
  Car: ({ className, ...props }: any) => <div data-testid="car-icon" className={className} {...props} />,
}));

describe('AppointmentDetailModal', () => {
  const mockAppointment = {
    id: 'apt-123',
    customer: 'John Smith',
    vehicle: '2020 Honda Civic',
    service: 'Oil Change',
    timeSlot: '10:00 AM',
    dateTime: new Date('2025-09-08T10:00:00'),
    status: 'scheduled' as const,
    phone: '555-0123',
    address: '123 Main Street, Anytown, ST 12345'
  };

  const mockProps = {
    appointment: mockAppointment,
    isOpen: true,
    onClose: vi.fn(),
    onStartJob: vi.fn(),
    onCompleteJob: vi.fn(),
    onCallCustomer: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering Behavior', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <AppointmentDetailModal {...mockProps} isOpen={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders modal when isOpen is true', () => {
      render(<AppointmentDetailModal {...mockProps} />);
      expect(screen.getByText('📋 Appointment Details')).toBeInTheDocument();
    });

    it('renders all required appointment information', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      // Check customer info
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();

      // Check vehicle info
      expect(screen.getByText('2020 Honda Civic')).toBeInTheDocument();
      expect(screen.getByText('Vehicle')).toBeInTheDocument();

      // Check service info
      expect(screen.getByText('Oil Change')).toBeInTheDocument();
      expect(screen.getByText('Service Requested')).toBeInTheDocument();
    });

    it('renders customer initial in avatar', () => {
      render(<AppointmentDetailModal {...mockProps} />);
      expect(screen.getByText('J')).toBeInTheDocument(); // First letter of "John"
    });

    it('displays formatted date and time', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      // Check time format (10:00 AM)
      expect(screen.getByText('10:00 AM')).toBeInTheDocument();

      // Check date format (should be formatted)
      expect(screen.getByText(/Monday, September 8, 2025/)).toBeInTheDocument();
    });
  });

  describe('Status Display and Styling', () => {
    it('displays scheduled status with correct styling', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      const statusBadge = screen.getByText('SCHEDULED');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200');
    });

    it('displays in-progress status with correct styling', () => {
      const inProgressAppointment = { ...mockAppointment, status: 'in-progress' as const };
      render(<AppointmentDetailModal {...mockProps} appointment={inProgressAppointment} />);

      const statusBadge = screen.getByText('IN PROGRESS');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-200');
    });

    it('displays completed status with correct styling', () => {
      const completedAppointment = { ...mockAppointment, status: 'completed' as const };
      render(<AppointmentDetailModal {...mockProps} appointment={completedAppointment} />);

      const statusBadge = screen.getByText('COMPLETED');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200');
    });

    it('displays canceled status with correct styling', () => {
      const canceledAppointment = { ...mockAppointment, status: 'canceled' as const };
      render(<AppointmentDetailModal {...mockProps} appointment={canceledAppointment} />);

      const statusBadge = screen.getByText('CANCELED');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-200');
    });
  });

  describe('Optional Fields', () => {
    it('renders phone number section when phone is provided', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      expect(screen.getByText('555-0123')).toBeInTheDocument();
      expect(screen.getByText('Phone Number')).toBeInTheDocument();
      expect(screen.getByText('📞 Call')).toBeInTheDocument();
    });

    it('does not render phone section when phone is not provided', () => {
      const appointmentWithoutPhone = { ...mockAppointment, phone: undefined };
      render(<AppointmentDetailModal {...mockProps} appointment={appointmentWithoutPhone} />);

      expect(screen.queryByText('Phone Number')).not.toBeInTheDocument();
      expect(screen.queryByText('📞 Call')).not.toBeInTheDocument();
    });

    it('renders address section when address is provided', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      expect(screen.getByText('123 Main Street, Anytown, ST 12345')).toBeInTheDocument();
      expect(screen.getByText('Service Address')).toBeInTheDocument();
    });

    it('does not render address section when address is not provided', () => {
      const appointmentWithoutAddress = { ...mockAppointment, address: undefined };
      render(<AppointmentDetailModal {...mockProps} appointment={appointmentWithoutAddress} />);

      expect(screen.queryByText('Service Address')).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('shows start job button for scheduled appointments', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      const startButton = screen.getByRole('button', { name: /start this job/i });
      expect(startButton).toBeInTheDocument();
      expect(startButton.tagName).toBe('BUTTON');
    });

    it('shows complete job button for in-progress appointments', () => {
      const inProgressAppointment = { ...mockAppointment, status: 'in-progress' as const };
      render(<AppointmentDetailModal {...mockProps} appointment={inProgressAppointment} />);

      const completeButton = screen.getByRole('button', { name: /mark as complete/i });
      expect(completeButton).toBeInTheDocument();
      expect(completeButton.tagName).toBe('BUTTON');
    });

    it('does not show action buttons for completed appointments', () => {
      const completedAppointment = { ...mockAppointment, status: 'completed' as const };
      render(<AppointmentDetailModal {...mockProps} appointment={completedAppointment} />);

      expect(screen.queryByText('🔧 Start This Job')).not.toBeInTheDocument();
      expect(screen.queryByText('✅ Mark as Complete')).not.toBeInTheDocument();
    });

    it('does not show action buttons for canceled appointments', () => {
      const canceledAppointment = { ...mockAppointment, status: 'canceled' as const };
      render(<AppointmentDetailModal {...mockProps} appointment={canceledAppointment} />);

      expect(screen.queryByText('🔧 Start This Job')).not.toBeInTheDocument();
      expect(screen.queryByText('✅ Mark as Complete')).not.toBeInTheDocument();
    });

    it('always shows close button', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      // Should have two close buttons: X icon and "Close" text button
      expect(screen.getAllByText('Close')).toHaveLength(1);
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });
  });

  describe('Event Handling', () => {
    it('calls onClose when X button is clicked', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      expect(mockProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Close button is clicked', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      expect(mockProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onStartJob when start job button is clicked', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      const startButton = screen.getByText('🔧 Start This Job');
      fireEvent.click(startButton);

      expect(mockProps.onStartJob).toHaveBeenCalledWith('apt-123');
    });

    it('calls onCompleteJob when complete job button is clicked', () => {
      const inProgressAppointment = { ...mockAppointment, status: 'in-progress' as const };
      render(<AppointmentDetailModal {...mockProps} appointment={inProgressAppointment} />);

      const completeButton = screen.getByText('✅ Mark as Complete');
      fireEvent.click(completeButton);

      expect(mockProps.onCompleteJob).toHaveBeenCalledWith('apt-123');
    });

    it('calls onCallCustomer when call button is clicked', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      const callButton = screen.getByText('📞 Call');
      fireEvent.click(callButton);

      expect(mockProps.onCallCustomer).toHaveBeenCalledWith('555-0123');
    });

    it('does not call onStartJob when handler is not provided', () => {
      const propsWithoutStartJob = { ...mockProps, onStartJob: undefined };
      render(<AppointmentDetailModal {...propsWithoutStartJob} />);

      const startButton = screen.getByText('🔧 Start This Job');
      fireEvent.click(startButton);

      // Should not throw error
      expect(mockProps.onStartJob).not.toHaveBeenCalled();
    });

    it('does not call onCompleteJob when handler is not provided', () => {
      const inProgressAppointment = { ...mockAppointment, status: 'in-progress' as const };
      const propsWithoutCompleteJob = { ...mockProps, appointment: inProgressAppointment, onCompleteJob: undefined };
      render(<AppointmentDetailModal {...propsWithoutCompleteJob} />);

      const completeButton = screen.getByText('✅ Mark as Complete');
      fireEvent.click(completeButton);

      // Should not throw error
      expect(mockProps.onCompleteJob).not.toHaveBeenCalled();
    });

    it('does not call onCallCustomer when handler is not provided', () => {
      const propsWithoutCallCustomer = { ...mockProps, onCallCustomer: undefined };
      render(<AppointmentDetailModal {...propsWithoutCallCustomer} />);

      const callButton = screen.getByText('📞 Call');
      fireEvent.click(callButton);

      // Should not throw error
      expect(mockProps.onCallCustomer).not.toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    it('formats time correctly for different times', () => {
      const morningAppointment = { ...mockAppointment, dateTime: new Date('2025-09-08T09:30:00') };
      render(<AppointmentDetailModal {...mockProps} appointment={morningAppointment} />);
      expect(screen.getByText('9:30 AM')).toBeInTheDocument();

      // Test afternoon time
      const afternoonAppointment = { ...mockAppointment, dateTime: new Date('2025-09-08T14:45:00') };
      const { rerender } = render(<AppointmentDetailModal {...mockProps} appointment={afternoonAppointment} />);
      expect(screen.getByText('2:45 PM')).toBeInTheDocument();
    });

    it('formats date correctly for different dates', () => {
      const differentDate = { ...mockAppointment, dateTime: new Date('2025-12-25T10:00:00') };
      render(<AppointmentDetailModal {...mockProps} appointment={differentDate} />);
      expect(screen.getByText(/Thursday, December 25, 2025/)).toBeInTheDocument();
    });
  });

  describe('Icon Rendering', () => {
    it('renders all required icons', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
      expect(screen.getByTestId('car-icon')).toBeInTheDocument();
      expect(screen.getAllByTestId('wrench-icon')).toHaveLength(2); // One in service section, one in button
      expect(screen.getByTestId('phone-icon')).toBeInTheDocument();
      expect(screen.getByTestId('mappin-icon')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria labels on interactive elements', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });

    it('uses semantic button elements for interactions', () => {
      render(<AppointmentDetailModal {...mockProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Check specific buttons
      expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start this job/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /call/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles customer names with single character', () => {
      const singleCharCustomer = { ...mockAppointment, customer: 'A' };
      render(<AppointmentDetailModal {...mockProps} appointment={singleCharCustomer} />);

      expect(screen.getAllByText('A')).toHaveLength(2); // Both name and initial
    });

    it('handles empty customer name gracefully', () => {
      const emptyCustomer = { ...mockAppointment, customer: '' };
      render(<AppointmentDetailModal {...mockProps} appointment={emptyCustomer} />);

      // Should still render without errors
      expect(screen.getByText('Customer')).toBeInTheDocument();
    });

    it('handles missing optional callbacks gracefully', () => {
      const minimalProps = {
        appointment: mockAppointment,
        isOpen: true,
        onClose: vi.fn()
      };

      render(<AppointmentDetailModal {...minimalProps} />);

      // Should render without errors
      expect(screen.getByText('📋 Appointment Details')).toBeInTheDocument();
    });
  });
});
