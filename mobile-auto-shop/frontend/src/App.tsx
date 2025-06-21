import { useState } from 'react'


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <h1 className="text-3xl font-bold">Vite + React</h1>
      <div className="mt-4">
        <button
          className="rounded bg-blue-500 px-4 py-2 text-white"
          onClick={() => setCount((count) => count + 1)}
        >
          count is {count}
        </button>
      </div>
    </>
  )
}

export default App
