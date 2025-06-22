import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  serviceAPI,
  customerAPI,
  appointmentAPI,
  type Service,
} from '../services/api'

interface FormValues {
  name: string
  phone: string
  email: string
  address: string
  date: string
  time: string
  notes: string
}

export default function Booking() {
  const navigate = useNavigate()
  const { data: services } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await serviceAPI.getAll()
      return data
    },
  })

  const [step, setStep] = useState(1)
  const [serviceId, setServiceId] = useState<number | null>(null)
  const { register, handleSubmit } = useForm<FormValues>()

  const onSubmit = async (values: FormValues) => {
    if (!serviceId) return
    const { data: customer } = await customerAPI.create({
      name: values.name,
      phone: values.phone,
      email: values.email,
      address: values.address,
    })
    const { data: appointment } = await appointmentAPI.create({
      customer_id: customer.id,
      vehicle_id: null,
      service_id: serviceId,
      scheduled_date: values.date,
      scheduled_time: values.time,
      location_address: values.address,
      notes: values.notes,
    })
    navigate('/confirmation', { state: { appointment } })
  }

  return (
    <div className="max-w-xl mx-auto">
      {step === 1 && (
        <div>
          <h3 className="mb-4 text-xl font-semibold">Select Service</h3>
          <ul className="space-y-2">
            {services?.map((s: Service) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setServiceId(s.id)
                    setStep(2)
                  }}
                  className="w-full rounded border p-3 text-left hover:bg-gray-100"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {step === 2 && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input {...register('name', { required: true })} className="mt-1 w-full border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Phone</label>
            <input {...register('phone')} className="mt-1 w-full border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input {...register('email')} className="mt-1 w-full border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Address</label>
            <input {...register('address')} className="mt-1 w-full border p-2" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium">Date</label>
              <input type="date" {...register('date')} className="mt-1 w-full border p-2" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium">Time</label>
              <input type="time" {...register('time')} className="mt-1 w-full border p-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Notes</label>
            <textarea {...register('notes')} className="mt-1 w-full border p-2" />
          </div>
          <div className="flex justify-between">
            <button type="button" className="rounded bg-gray-200 px-3 py-2" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
              Submit
            </button>
          </div>
        </form>
      )}
    </div>
  )
}