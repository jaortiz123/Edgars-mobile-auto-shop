import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getServices } from '../api'
import type { Service } from '../api'

export default function Landing() {
  const { data: services } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: getServices,
  })

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
          {services?.map((s: Service) => (
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
