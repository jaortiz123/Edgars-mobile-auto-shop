import { Link, Outlet } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-blue-600 text-white p-4">
        <div className="container mx-auto flex justify-between">
          <h1 className="text-lg font-bold">Edgar's Mobile Auto Shop</h1>
          <nav className="space-x-4">
            <Link to="/" className="hover:underline">Home</Link>
            <Link to="/booking" className="hover:underline">Book</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4">
        <Outlet />
      </main>
      <footer className="bg-gray-100 p-4 text-center">
        <p>Contact us: (555) 123-4567</p>
      </footer>
    </div>
  )
}
