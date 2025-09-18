import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, money, dtLocal } from '@/utils/format';
import { Calendar, DollarSign, Phone, Mail, Clock, Star } from 'lucide-react';

interface CustomerHeaderCardProps {
  customer: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    isVip: boolean;
    createdAt: string | null;
    updatedAt: string | null;
    customerSince?: string | null;
    relationshipDurationDays?: number | null;
    preferredContactMethod?: string | null;
    preferredContactTime?: string | null;
    tags?: string[];
    notes?: string | null;
  };
  metrics: {
    totalSpent: number;
    unpaidBalance: number;
    visitsCount: number;
    completedCount: number;
    avgTicket: number;
    lastServiceAt: string | null;
    lastVisitAt: string | null;
    last12MonthsSpent: number;
    last12MonthsVisits: number;
    vehiclesCount: number;
    isVip: boolean;
    isOverdueForService: boolean;
  };
  onBookAppointment?: () => void;
  onEditCustomer?: () => void;
  isLoading?: boolean;
}

export function CustomerHeaderCard({
  customer,
  metrics,
  onBookAppointment,
  onEditCustomer,
  isLoading = false
}: CustomerHeaderCardProps) {
  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="flex gap-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 bg-gray-200 rounded-full w-20"></div>
              <div className="h-6 bg-gray-200 rounded-full w-16"></div>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // Format customer since date
  const formatCustomerSince = (dateStr?: string | null) => {
    if (!dateStr) return 'Unknown';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  // Format relationship duration
  const formatRelationshipDuration = (days?: number | null) => {
    if (!days || days < 0) return 'New customer';

    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);

    if (years > 0) {
      if (months > 0) {
        return `${years}y ${months}m`;
      }
      return `${years} ${years === 1 ? 'year' : 'years'}`;
    }

    if (months > 0) {
      return `${months} ${months === 1 ? 'month' : 'months'}`;
    }

    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  // Get preferred contact method badge variant and icon
  const getContactMethodInfo = (method?: string | null) => {
    switch (method?.toLowerCase()) {
      case 'phone':
        return { icon: Phone, variant: 'primary' as const, label: 'Phone Preferred' };
      case 'email':
        return { icon: Mail, variant: 'secondary' as const, label: 'Email Preferred' };
      case 'sms':
        return { icon: Phone, variant: 'success' as const, label: 'SMS Preferred' };
      default:
        return { icon: Phone, variant: 'outline' as const, label: 'No Preference' };
    }
  };

  const contactMethodInfo = getContactMethodInfo(customer.preferredContactMethod);
  const ContactIcon = contactMethodInfo.icon;

  return (
    <Card className="mb-6" data-testid="customer-header-card">
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Main Customer Info */}
          <div className="flex-1">
            <div className="flex items-start gap-3 mb-3">
              <CardTitle className="text-2xl lg:text-3xl" data-testid="customer-name">
                {customer.name}
              </CardTitle>
              {customer.isVip && (
                <Badge variant="warning" className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  VIP
                </Badge>
              )}
            </div>

            {/* Contact Information */}
            <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-600 mb-4">
              {customer.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  <span data-testid="customer-phone">{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  <span data-testid="customer-email">{customer.email}</span>
                </div>
              )}
            </div>

            {/* Customer Since & Relationship Duration */}
            <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Customer Since: </span>
                <span className="font-medium" data-testid="customer-since">
                  {formatCustomerSince(customer.customerSince)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Relationship: </span>
                <span className="font-medium" data-testid="relationship-duration">
                  {formatRelationshipDuration(customer.relationshipDurationDays)}
                </span>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge
                variant={contactMethodInfo.variant}
                className="flex items-center gap-1"
                data-testid="preferred-contact-badge"
              >
                <ContactIcon className="h-3 w-3" />
                {contactMethodInfo.label}
              </Badge>

              {customer.tags && customer.tags.length > 0 &&
                customer.tags.map((tag) => (
                  <Badge key={tag} variant="outline" data-testid="customer-tag">
                    {tag}
                  </Badge>
                ))
              }
            </div>

            {/* Customer Notes Preview */}
            {customer.notes && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                <span className="font-medium">Notes: </span>
                <span data-testid="customer-notes">
                  {customer.notes.length > 120
                    ? `${customer.notes.slice(0, 120)}...`
                    : customer.notes
                  }
                </span>
              </div>
            )}
          </div>

          {/* Key Metrics & Actions */}
          <div className="lg:min-w-[280px] space-y-4">
            {/* Lifetime Value */}
            <div className="text-center lg:text-right">
              <div className="text-sm text-gray-500 mb-1">Lifetime Value</div>
              <div className="text-2xl lg:text-3xl font-bold text-green-600" data-testid="lifetime-value">
                {money(metrics.totalSpent)}
              </div>
              <div className="text-xs text-gray-500">
                {metrics.visitsCount} visits • Avg {money(metrics.avgTicket)}
              </div>
            </div>

            {/* Unpaid Balance */}
            {metrics.unpaidBalance > 0 && (
              <div className="text-center lg:text-right">
                <div className="text-sm text-red-500 mb-1">Unpaid Balance</div>
                <div className="text-lg font-semibold text-red-600" data-testid="unpaid-balance">
                  {money(metrics.unpaidBalance)}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 lg:items-end">
              <Button
                onClick={onBookAppointment}
                className="w-full lg:w-auto"
                data-testid="book-appointment-btn"
              >
                Book Appointment
              </Button>
              <Button
                variant="outline"
                onClick={onEditCustomer}
                className="w-full lg:w-auto"
                data-testid="edit-customer-btn"
              >
                Edit Customer
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
