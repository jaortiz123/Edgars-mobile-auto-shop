import React from 'react'

interface Props {
  message?: string
}

export default function ErrorMessage({ message }: Props) {
  if (!message) return null
  return <p className="text-sm text-red-600">{message}</p>
}
