import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface ButtonProps {
  children: ReactNode
  to?: string
  href?: string
  variant?: 'primary' | 'outline' | 'accent' | 'light-outline'
  className?: string
  onClick?: () => void
  onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void
  onMouseLeave?: (e: React.MouseEvent<HTMLElement>) => void
  style?: React.CSSProperties
}

export default function Button({
  children,
  to,
  href,
  variant = 'primary',
  className = '',
  onClick,
  onMouseEnter,
  onMouseLeave,
  style
}: ButtonProps) {
  const baseClasses = "inline-flex items-center justify-center font-bold transition-all duration-300"

  const variantClasses = {
    primary: "px-10 py-4 text-white rounded-lg text-lg shadow-lg",
    outline: "px-10 py-4 bg-transparent hover:bg-navy border-2 border-navy text-navy hover:text-white rounded-lg text-lg",
    accent: "px-12 py-4 text-white hover:text-white rounded-lg text-xl transform hover:scale-105 shadow-xl border-2 border-transparent",
    'light-outline': "px-12 py-4 bg-transparent border-2 text-light-blue hover:text-white rounded-lg text-xl"
  }

  const combinedClassName = `${baseClasses} ${variantClasses[variant]} ${className}`

  if (to) {
    return (
      <Link
        to={to}
        className={combinedClassName}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={style}
      >
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a
        href={href}
        className={combinedClassName}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={style}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      className={combinedClassName}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      {children}
    </button>
  )
}
