import { lazy, Suspense } from 'react';
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
import EditOPR from './pages/EditOPR';
import SejarahOPR from './pages/SejarahOPR';
import DuplicateOPR from './pages/DuplicateOPR';

// Kemas Kini 1: Pratonton OPR dimuatkan secara lazy - PDF.js (saiz besar)
// berada dalam chunk berasingan dan hanya dimuat turun apabila halaman ini
// dibuka, tidak menambah beban halaman lain.
const LihatOPR = lazy(() => import('./pages/LihatOPR'));

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
            <Route
              path="/opr/:id/lihat"
              element={
                <Suspense
                  fallback={
                    <div className="page">
                      <p>Memuatkan...</p>
                    </div>
                  }
                >
                  <LihatOPR />
                </Suspense>
              }
            />
            {/* Kemas Kini 2: Edit 24 jam, sejarah versi & PDF versi arkib (Admin) */}
            <Route path="/opr/:id/edit" element={<EditOPR />} />
            <Route path="/opr/:id/sejarah" element={<SejarahOPR />} />
            {/* Kemas Kini 3: Duplicate & Edit (rekod baharu melalui aliran CREATE) */}
            <Route path="/opr/:id/duplicate" element={<DuplicateOPR />} />
            <Route
              path="/opr/:id/versi/:version/lihat"
              element={
                <Suspense
                  fallback={
                    <div className="page">
                      <p>Memuatkan...</p>
                    </div>
                  }
                >
                  <LihatOPR />
                </Suspense>
              }
            />
          </Routes>
        </main>
        <Footer />
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
