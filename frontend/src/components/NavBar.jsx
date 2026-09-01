import { NavLink } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

function linkClass({ isActive }) {
  return `navbar-link${isActive ? ' is-active' : ''}`;
}

export default function NavBar() {
  const { admin } = useAdminAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand">
          <img src="/assets/logo-sekolah.svg" alt="" className="navbar-logo" />
          <span>Sistem OPR</span>
        </NavLink>

        <nav className="navbar-links" aria-label="Navigasi utama">
          <NavLink to="/" end className={linkClass}>
            Utama
          </NavLink>
          <NavLink to="/buat" className={linkClass}>
            Buat OPR
          </NavLink>
          <NavLink to="/rekod" className={linkClass}>
            Rekod OPR
          </NavLink>
          <NavLink to="/admin" className={linkClass}>
            {admin ? admin.name : 'Admin'}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
