import React from 'react'
import type { Service } from '../services/api'

interface Props extends Service {
  onSelect?: (id: number) => void
}

export default React.memo(function ServiceCard({ id, name, description, onSelect }: Props) {
  return (
    <div className="rounded border p-4">
      <h4 className="font-bold">{name}</h4>
      {description && <p>{description}</p>}
      {onSelect && (
        <button className="mt-2 rounded bg-blue-600 px-3 py-1 text-white" onClick={() => onSelect(id)}>
          Select
        </button>
      )}
    </div>
  )
})
