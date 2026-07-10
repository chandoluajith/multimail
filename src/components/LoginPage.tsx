import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex flex-col items-center gap-8 px-6 text-center max-w-md w-full">
        {/* Logo / Icon */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-lg"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
          ✉️
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            MailsTracker
          </h1>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            Track your AI service email accounts, cooldowns &amp; usage — all in one place.
          </p>
        </div>

        {/* Sign-in card */}
        <div
          className="w-full rounded-2xl p-8 flex flex-col items-center gap-6"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Sign in to get started
          </p>

          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: '#fff',
              color: '#1f1f1f',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            {/* Google SVG */}
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.1-6.1C34.3 3.02 29.43 1 24 1 14.82 1 7.02 6.5 3.44 14.34l7.12 5.53C12.3 13.62 17.67 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.14-3.14-.4-4.62H24v8.75h12.67c-.55 2.94-2.2 5.43-4.68 7.1l7.18 5.58C43.28 37.35 46.5 31.4 46.5 24.5z"/>
              <path fill="#FBBC05" d="M10.56 28.13A14.55 14.55 0 0 1 9.5 24c0-1.44.2-2.83.56-4.13l-7.12-5.53A23.94 23.94 0 0 0 .5 24c0 3.86.92 7.5 2.55 10.72l7.51-6.59z"/>
              <path fill="#34A853" d="M24 46.5c5.43 0 9.99-1.8 13.32-4.88l-7.18-5.58c-1.8 1.21-4.1 1.93-6.14 1.93-6.33 0-11.7-4.12-13.44-9.87l-7.51 6.59C7.02 41.5 14.82 46.5 24 46.5z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-xs" style={{ color: 'var(--text-tertiary, var(--text-secondary))' }}>
            Your data is stored privately — only you can access it.
          </p>
        </div>
      </div>
    </div>
  );
}
