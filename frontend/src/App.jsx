import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import Home from './pages/Home';
import BuatOPR from './pages/BuatOPR';
import RekodOPR from './pages/RekodOPR';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Privacy from './pages/Privacy';

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <NavBar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/buat" element={<BuatOPR />} />
            <Route path="/rekod" element={<RekodOPR />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </main>
        <Footer />
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
