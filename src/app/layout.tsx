import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Allo Inventory | Multi-Warehouse Stock Reservation',
  description:
    'Real-time inventory reservation system for multi-warehouse retail. Reserve products, track stock levels, and manage fulfillment across warehouses.',
  keywords: 'inventory, warehouse, stock, reservation, fulfillment',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(139,92,246,0.08) 0%, transparent 50%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(10,10,15,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              padding: '0 24px',
              height: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <a
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 800,
                  color: 'white',
                }}
              >
                A
              </div>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                Allo
                <span style={{ color: 'var(--accent-light)', marginLeft: '4px' }}>
                  Inventory
                </span>
              </span>
            </a>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  display: 'inline-block',
                  boxShadow: '0 0 8px rgba(16,185,129,0.6)',
                  animation: 'pulse-danger 2s infinite',
                }}
              />
              Live Stock
            </div>
          </div>
        </nav>
        <main style={{ position: 'relative', zIndex: 1 }}>{children}</main>
        <footer
          style={{
            borderTop: '1px solid var(--border)',
            padding: '32px 24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
            marginTop: '80px',
          }}
        >
          © {new Date().getFullYear()} Allo Inventory — Multi-Warehouse Fulfillment Platform
        </footer>
      </body>
    </html>
  )
}
