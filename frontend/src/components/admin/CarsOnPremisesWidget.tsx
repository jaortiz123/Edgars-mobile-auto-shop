import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Car, User, Clock, CheckCircle, Wrench } from 'lucide-react';
import { useApi, type CarOnPremises } from '../../lib/api';

export const CarsOnPremisesWidget: React.FC = () => {
  const api = useApi();
  const [carsOnPremises, setCarsOnPremises] = useState<CarOnPremises[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCars = async () => {
      try {
        const response = await api.getCarsOnPremises();
        if (response.success && response.data) {
          setCarsOnPremises(response.data.cars_on_premises);
        }
      } catch (error) {
        console.error("Failed to fetch cars on premises:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCars();
  }, [api]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-6 w-6 text-blue-600" />
            🚗 Cars on Premises
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <p className="text-center text-gray-500">Loading cars...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5 text-blue-600" />
          🚗 Cars on Premises
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {carsOnPremises.length > 0 ? (
          <div className="space-y-4">
            {carsOnPremises.map((car) => (
              <div key={car.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-base text-gray-900">{car.make} {car.model}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    car.status === 'in-service' ? 'bg-blue-100 text-blue-800' :
                    car.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {car.status.replace('-', ' ').toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-600 flex items-center gap-1 mb-1">
                  <User className="h-5 w-5" /> {car.owner}
                </p>
                <p className="text-xs text-gray-600 flex items-center gap-1 mb-1">
                  <Clock className="h-5 w-5" /> Arrived: {car.arrivalTime}
                </p>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <CheckCircle className="h-5 w-5" /> Pickup: {car.pickupTime}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">No cars currently on premises.</p>
        )}
      </CardContent>
    </Card>
  );
};