import { useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { assets } from '../lib/assets';
import { useLogout, useMe } from '../hooks/useAuth';
import { selectCount, useCart } from '../store/cart';
import NotificationBell from './NotificationBell';

const links = [
  { to: '/', label: 'Home' },
  { to: '/collection', label: 'Collection' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const count = useCart(selectCount);
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/collection${term.trim() ? `?search=${encodeURIComponent(term.trim())}` : ''}`);
    setSearchOpen(false);
  };

  return (
    <header>
      <div className="flex items-center justify-between py-4 font-medium">
        <Link to="/" aria-label="DesiDrapes home">
          <img src={assets.logo} className="w-20" alt="DesiDrapes" />
        </Link>

        <nav className="hidden gap-6 text-sm text-gray-700 sm:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end className="flex flex-col items-center gap-1">
              <p>{l.label.toUpperCase()}</p>
              <hr className="hidden h-[1.5px] w-2/4 border-none bg-gray-700" />
            </NavLink>
          ))}
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin" className="flex flex-col items-center gap-1 text-brand">
              <p>ADMIN</p>
              <hr className="hidden h-[1.5px] w-2/4 border-none bg-brand" />
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <button onClick={() => setSearchOpen((o) => !o)} aria-label="Search" aria-expanded={searchOpen}>
            <img src={assets.search} className="w-5" alt="" />
          </button>

          {user && <NotificationBell />}

          <div className="group relative">
            <button
              onClick={() => !user && navigate('/login')}
              aria-label={user ? `Account menu for ${user.name}` : 'Log in'}
              className="flex"
            >
              <img src={assets.profile} className="w-5" alt="" />
            </button>
            {user && (
              <div className="absolute right-0 z-30 hidden pt-4 group-focus-within:block group-hover:block">
                <div className="flex w-44 flex-col gap-2 rounded bg-slate-100 px-5 py-3 text-sm text-gray-500 shadow">
                  <p className="truncate text-gray-800">Hi, {user.name.split(' ')[0]}</p>
                  <Link to="/orders" className="hover:text-black">
                    My orders
                  </Link>
                  {user.role === 'ADMIN' && (
                    <Link to="/admin" className="hover:text-black">
                      Admin dashboard
                    </Link>
                  )}
                  <button
                    className="text-left hover:text-black"
                    onClick={() =>
                      logout.mutate(undefined, {
                        onSuccess: () => {
                          toast.info('Logged out');
                          navigate('/');
                        },
                      })
                    }
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

          <Link to="/cart" className="relative" aria-label={`Cart, ${count} items`}>
            <img src={assets.cart} className="w-5 min-w-5" alt="" />
            <span className="absolute -bottom-1.5 -right-1.5 flex aspect-square w-4 items-center justify-center rounded-full bg-black text-[8px] leading-4 text-white">
              {count}
            </span>
          </Link>

          <button onClick={() => setMenuOpen(true)} className="sm:hidden" aria-label="Open menu">
            <img src={assets.menu} className="w-5" alt="" />
          </button>
        </div>
      </div>

      {searchOpen && (
        <form onSubmit={submitSearch} className="mb-4 flex items-center gap-2 border-y bg-gray-50 px-4 py-4">
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search sarees, kurtas, lehengas…"
            className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-black"
            aria-label="Search products"
          />
          <button className="rounded-full bg-black px-5 py-2 text-sm text-white">Search</button>
          <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search">
            <img src={assets.cross} className="w-3" alt="" />
          </button>
        </form>
      )}

      {/* Mobile slide-in menu */}
      <div
        className={`fixed inset-y-0 right-0 z-40 overflow-hidden bg-white transition-all ${menuOpen ? 'w-full' : 'w-0'}`}
        aria-hidden={!menuOpen}
      >
        <div className="flex flex-col text-gray-600">
          <button onClick={() => setMenuOpen(false)} className="flex items-center gap-4 p-3">
            <img className="h-4 rotate-180" src={assets.dropdown} alt="" />
            <p>Back</p>
          </button>
          {[...links, ...(user?.role === 'ADMIN' ? [{ to: '/admin', label: 'Admin' }] : [])].map((l) => (
            <NavLink key={l.to} onClick={() => setMenuOpen(false)} className="border py-3 pl-6" to={l.to} end>
              {l.label.toUpperCase()}
            </NavLink>
          ))}
          {user ? (
            <NavLink onClick={() => setMenuOpen(false)} className="border py-3 pl-6" to="/orders">
              MY ORDERS
            </NavLink>
          ) : (
            <NavLink onClick={() => setMenuOpen(false)} className="border py-3 pl-6" to="/login">
              LOGIN
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
