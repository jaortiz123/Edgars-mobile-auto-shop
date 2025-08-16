import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { fetchCustomerProfile, CustomerProfileResponse } from '@/lib/customerProfileApi';
import CustomerHeader from '@/components/customer/CustomerHeader';
import MetricsSummary from '@/components/customer/MetricsSummary';
import VehicleList from '@/components/customer/VehicleList';
import AppointmentHistory from '@/components/customer/AppointmentHistory';

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CustomerProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const fetchGen = useRef(0);

  const load = useCallback(() => {
    if (!id) return;
    const myGen = ++fetchGen.current;
    setLoading(true);
    setError(null);
    fetchCustomerProfile(id, { includeDetails: showDetails })
      .then(d => { if (fetchGen.current === myGen) setData(d); })
      .catch(e => { if (fetchGen.current === myGen) setError(e.message); })
      .finally(() => { if (fetchGen.current === myGen) setLoading(false); });
  }, [id, showDetails]);

  useEffect(() => { load(); }, [load]);

  const handleToggleDetails = (next: boolean) => {
    setShowDetails(next);
  };

  if (loading) return <div className="p-4" data-testid="customer-profile-loading">Loading profile…</div>;
  if (error) return <div className="p-4 text-red-600" data-testid="customer-profile-error">{error}</div>;
  if (!data) return <div className="p-4" data-testid="customer-profile-empty">No data.</div>;

  return (
    <div className="p-6 space-y-8" data-testid="customer-profile-page">
      <CustomerHeader customer={data.customer} metrics={data.metrics} onEdit={() => { /* TODO */ }} onBook={() => { /* TODO */ }} />
      <MetricsSummary metrics={data.metrics} />
      <section data-testid="customer-vehicles-section" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" data-testid="vehicles-heading">Vehicles</h2>
          {/* Placeholder for future add vehicle action */}
        </div>
        <VehicleList vehicles={data.vehicles} />
      </section>
      <section data-testid="customer-appointments-section" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" data-testid="appointments-heading">Appointment History</h2>
          {/* Toggle + filters will go here */}
        </div>
  <AppointmentHistory appointments={data.appointments} showDetails={showDetails} onToggleDetails={handleToggleDetails} />
      </section>
      {/* Future sections: detail toggle expansion rows, Messages timeline */}
    </div>
  );
}
