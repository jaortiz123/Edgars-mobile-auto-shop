import { useLocation, Link } from 'react-router-dom'
import type { Appointment } from '../api'

export default function Confirmation() {
  const location = useLocation()
  const appointment = (location.state as { appointment: Appointment }).appointment

  if (!appointment) return <p>No appointment found.</p>

  return (
    <div className="prose mx-auto text-center">
      <h2>Appointment Confirmed!</h2>
      <p>Your appointment ID is {appointment.id}.</p>
      <Link to="/" className="rounded bg-blue-600 px-4 py-2 text-white">
        Back to Home
      </Link>
    </div>
  )
}
