import React, { useState, useEffect } from 'react';
import { useOptimisticVehicleEdit } from '@/hooks/useOptimisticVehicleEdit';

export interface BasicVehicleForModal { id: string; make?: string | null; model?: string | null; year?: number | null; vin?: string | null; license_plate?: string | null; }

interface Props {
  open: boolean;
  onClose: () => void;
  vehicle: BasicVehicleForModal | null;
}

export function VehicleEditModal({ open, onClose, vehicle }: Props) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [vin, setVin] = useState('');
  const [plate, setPlate] = useState('');
  const mutation = useOptimisticVehicleEdit(vehicle?.id || '');

  useEffect(() => {
    if (vehicle) {
      setMake(vehicle.make ?? '');
      setModel(vehicle.model ?? '');
      setYear(vehicle.year ?? '');
      setVin(vehicle.vin ?? '');
      setPlate(vehicle.license_plate ?? '');
    }
  }, [vehicle]);

  if (!open || !vehicle) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ make, model, year: year === '' ? null : Number(year), vin, license_plate: plate }, { onSuccess: () => onClose() });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50" data-testid="vehicle-edit-modal">
      <form onSubmit={submit} className="bg-white rounded shadow p-6 w-full max-w-md space-y-4" aria-label="Edit Vehicle">
        <h2 className="text-lg font-semibold">Edit Vehicle</h2>
        <label className="block text-sm font-medium">Make
          <input value={make} onChange={e => setMake(e.target.value)} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="block text-sm font-medium">Model
          <input value={model} onChange={e => setModel(e.target.value)} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="block text-sm font-medium">Year
          <input value={year} onChange={e => setYear(e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="block text-sm font-medium">VIN
          <input value={vin} onChange={e => setVin(e.target.value)} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="block text-sm font-medium">License Plate
          <input value={plate} onChange={e => setPlate(e.target.value)} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        {mutation.isError && <div className="text-sm text-red-600" role="alert">Update failed</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded" disabled={mutation.isPending}>Cancel</button>
          <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

export default VehicleEditModal;
