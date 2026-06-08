import { Link, NavLink, Outlet } from 'react-router-dom';
import { TOOLS } from '../tools/registry';
import PrivacyBanner from './PrivacyBanner';

export default function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-brand-700 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <PrivacyBanner />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md text-lg font-bold text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              📄
            </span>
            paperless-pdf
          </Link>

          <nav aria-label="Tools" className="flex flex-1 flex-wrap gap-1 text-sm">
            {TOOLS.map((t) => (
              <NavLink
                key={t.id}
                to={`/${t.path}`}
                className={({ isActive }) =>
                  [
                    'rounded-md px-2.5 py-1.5 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    isActive
                      ? 'bg-brand-100 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
              >
                {t.title}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">
          <p>
            100% client-side · no uploads · no servers · no analytics.{' '}
            <a
              className="font-medium text-brand-700 underline-offset-2 hover:underline"
              href="https://github.com/IACBI/paperless-pdf"
              target="_blank"
              rel="noreferrer"
            >
              Open source (MIT)
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
