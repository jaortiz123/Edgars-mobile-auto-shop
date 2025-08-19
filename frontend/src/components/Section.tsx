import type { ReactNode } from 'react'

interface SectionProps {
  children: ReactNode
  className?: string
  bgColor?: 'white' | 'light' | 'navy'
  ariaLabel?: string
  ariaLabelledBy?: string
}

export default function Section({
  children,
  className = '',
  bgColor = 'white',
  ariaLabel,
  ariaLabelledBy
}: SectionProps) {
  const bgClasses = {
    white: 'bg-white',
    light: 'bg-bg-light',
    navy: 'bg-navy'
  }

  return (
    <section
      className={`px-sp-3 py-sp-6 ${bgClasses[bgColor]} ${className}`}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <div className="container mx-auto">
        {children}
      </div>
    </section>
  )
}
