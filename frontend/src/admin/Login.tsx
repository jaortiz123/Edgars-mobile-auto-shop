import { useState } from 'react'
import { login } from '../lib/api'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(username, password)
    navigate('/admin')
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto mt-20 space-y-4">
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        className="border p-2 w-full"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="border p-2 w-full"
      />
      <button className="bg-blue-500 text-white px-4 py-2">Login</button>
    </form>
  )
}
