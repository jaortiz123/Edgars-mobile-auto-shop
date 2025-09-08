import { useState } from 'react'
import { login } from '@lib/api'
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
    <form onSubmit={submit} className="max-w-sm mx-auto mt-sp-20 space-y-sp-4">
      <div>
        <label htmlFor="admin-username" className="block text-sm font-medium mb-1">Username</label>
        <input
          id="admin-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="border p-sp-2 w-full"
          required
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="block text-sm font-medium mb-1">Password</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="border p-sp-2 w-full"
          required
        />
      </div>
      <button type="submit" className="bg-blue-500 text-white px-sp-4 py-sp-2">Login</button>
    </form>
  )
}
