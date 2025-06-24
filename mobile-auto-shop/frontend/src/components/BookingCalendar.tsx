import React, { useEffect } from 'react'

export default function BookingCalendar() {
  useEffect(() => {
    const handler = () => {
      // handle resize events or other side effects
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return <div>Calendar</div>
}
