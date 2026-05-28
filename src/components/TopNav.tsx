import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

export function TopNav() {
  const { currentUserName } = useApp();

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-lg font-bold text-brand-700">
          Split-wise
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-brand-600 hover:text-brand-800">
            Home
          </Link>
          {currentUserName && (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">
              {currentUserName}
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
