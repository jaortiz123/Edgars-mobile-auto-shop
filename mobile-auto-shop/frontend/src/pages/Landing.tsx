import { Link } from 'react-router-dom'
import ServiceListContainer from '../containers/ServiceListContainer'

export default function Landing() {

  return (
    <div className="px-4 md:px-0">
      <section className="prose mx-auto text-center py-10">
        <h2 className="text-xl sm:text-2xl">Reliable Mobile Auto Repair</h2>
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
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <ServiceListContainer />
        </div>
      </section>
    </div>
  )
}

