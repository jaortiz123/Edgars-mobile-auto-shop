import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { serviceAPI, type Service } from '../services/api'

// Temporary fallback services for local UI testing when the API is unavailable
const mockServices: Service[] = [
  {
    id: 1,
    name: 'Oil Change',
    description: 'Full synthetic oil change',
    base_price: 50,
    duration_minutes: 30,
  },
  {
    id: 2,
    name: 'Brake Repair',
    description: 'Brake system service',
    base_price: 120,
    duration_minutes: 60,
  },
  {
    id: 3,
    name: 'Battery Replacement',
    description: 'Battery install and diagnostics',
    base_price: 90,
    duration_minutes: 45,
  },
]

export default function Landing() {
  const { data: services } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await serviceAPI.getAll()
      return data
    },
  })

  const servicesToRender = services && services.length > 0 ? services : mockServices

  return (
    <div>
      <section className="prose mx-auto text-center py-10">
        <h2>Reliable Mobile Auto Repair</h2>
        <p>We come to you for all of your maintenance needs.</p>
        <Link
          to="/booking"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
        >
          Book Now
        </Link>
      </section>
      <section className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Our Services</h3>
        <ul className="grid gap-4 md:grid-cols-3">
          {servicesToRender.map((s: Service) => (
            <li key={s.id} className="rounded border p-4">
              <h4 className="font-bold">{s.name}</h4>
              <p>{s.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}