// src/pages/NotFound.tsx
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--sp-6, 3rem)', color: '#1F2937' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold' }}>404</h1>
      <p style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>Page Not Found</p>
      <Link to="/" style={{ color: '#F97316', textDecoration: 'underline' }}>
        Go back to the homepage
      </Link>
    </div>
  );
}
