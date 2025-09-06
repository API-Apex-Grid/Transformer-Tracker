'use client'

import { useEffect } from 'react';
import Link from 'next/link';

export default function NotFound() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = '/';
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f8f9fa',
      color: '#343a40',
      fontFamily: 'Arial, sans-serif',
    }}>
      <h1 style={{ fontSize: '6rem', margin: '0' }}>404</h1>
      <h2 style={{ fontSize: '2rem', margin: '0.5rem 0' }}>Page Not Found</h2>
      <p style={{ fontSize: '1rem', margin: '1rem 0', textAlign: 'center' }}>
        Sorry, the page you are looking for does not exist. You will be redirected to the{' '}
        <Link href="/">
          homepage
        </Link>{' '}
      </p>
    </div>
  );
}
