import { NavLink } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { asset } from '../../lib/asset';

const LINKS = [
  { to: '/', label: 'Map', end: true },
  { to: '/journeys', label: 'Journeys', end: false },
  { to: '/stats', label: 'Stats', end: false },
  { to: '/guestbook', label: 'Guestbook', end: false },
];

export function Navbar() {
  return (
    <header className="fixed top-0 z-[1200] w-full border-b border-outline-variant/30 bg-surface/80 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-container items-center justify-between px-margin-mobile lg:px-margin-desktop">
        <NavLink
          to="/"
          className="flex min-w-0 items-center gap-3 lg:gap-4"
          aria-label="My Flight Journey, home"
        >
          <img
            src={asset("/images/logo.jpg")}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
          {/* Below the small breakpoint the four links and the avatar leave no
              room for the wordmark; it wrapped and landed on top of them. */}
          <span className="hidden whitespace-nowrap font-display-lg text-headline-md tracking-tight text-on-surface sm:inline">
            My Flight Journey
          </span>
        </NavLink>

        <nav className="hidden items-center gap-stack-lg md:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                [
                  'py-2 font-label-caps text-label-caps uppercase transition-colors',
                  isActive
                    ? 'border-b border-primary font-bold text-primary'
                    : 'text-on-surface-variant hover:text-on-surface',
                ].join(' ')
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-stack-sm md:hidden">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  [
                    'font-label-caps text-[11px] uppercase tracking-widest transition-colors',
                    isActive ? 'font-bold text-primary' : 'text-on-surface-variant',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
