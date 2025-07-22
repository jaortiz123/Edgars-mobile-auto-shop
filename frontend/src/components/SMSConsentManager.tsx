// SMS Consent Management Component
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';

interface SMSConsentManagerProps {
  customerPhone?: string;
  smsConsent?: boolean;
  onConsentChange?: (consent: boolean) => void;
}

export const SMSConsentManager: React.FC<SMSConsentManagerProps> = ({
  customerPhone,
  smsConsent = false,
  onConsentChange
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleConsentToggle = async () => {
    setIsUpdating(true);
    try {
      // Call API to update SMS consent
      const response = await fetch('/api/customers/sms-consent', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sms_consent: !smsConsent,
          phone: customerPhone
        })
      });

      if (response.ok) {
        onConsentChange?.(!smsConsent);
      }
    } catch (error) {
      console.error('Failed to update SMS consent:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!customerPhone) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <p className="text-sm text-yellow-800">
            📱 Add your phone number to receive SMS notifications
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          📱 SMS Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">
              {smsConsent ? '✅ Enabled' : '❌ Disabled'}
            </p>
            <p className="text-sm text-gray-600">
              Phone: {customerPhone}
            </p>
          </div>
          <Button
            onClick={handleConsentToggle}
            disabled={isUpdating}
            variant={smsConsent ? 'secondary' : 'primary'}
            size="sm"
          >
            {isUpdating ? 'Updating...' : (smsConsent ? 'Opt Out' : 'Opt In')}
          </Button>
        </div>
        
        <div className="text-xs text-gray-600 space-y-2">
          <p>
            {smsConsent ? (
              <>
                ✅ You will receive appointment confirmations and reminders via SMS.
                <br />
                Reply <strong>STOP</strong> to any message to unsubscribe.
              </>
            ) : (
              <>
                You are currently not receiving SMS notifications.
                <br />
                Opt in to receive appointment confirmations and reminders.
              </>
            )}
          </p>
          
          <div className="border-t pt-2 mt-2">
            <p className="font-medium">How to manage SMS notifications:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Reply <strong>STOP</strong> to any SMS to unsubscribe</li>
              <li>Reply <strong>START</strong> to re-subscribe</li>
              <li>Use this dashboard to manage preferences</li>
              <li>Message and data rates may apply</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SMSConsentManager;
