import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import StyleAssistant from './components/StyleAssistant';
import ErrorBoundary from './components/ErrorBoundary';
import { RequireAdmin, RequireAuth } from './components/RouteGuards';
import { Spinner } from './components/ui';
import Home from './pages/Home';
import Collection from './pages/Collection';
import ProductPage from './pages/ProductPage';
import Cart from './pages/Cart';
import Login from './pages/Login';
import { ForgotPassword, ResetPassword } from './pages/PasswordReset';
import PlaceOrder from './pages/PlaceOrder';
import MockCheckout from './pages/MockCheckout';
import OrderSuccess from './pages/OrderSuccess';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import { About, Contact, NotFound } from './pages/StaticPages';

// The admin area is code-split: shoppers never download it.
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, which React would treat as a cleanup.
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const isAdmin = useLocation().pathname.startsWith('/admin');

  return (
    <div className="px-4 sm:px-[5vw] md:px-[7vw] lg:px-[9vw]">
      <ScrollToTop />
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar newestOnTop />
      <Navbar />
      <ErrorBoundary>
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/product/:slug" element={<ProductPage />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/place-order" element={<RequireAuth><PlaceOrder /></RequireAuth>} />
            <Route path="/checkout/mock" element={<RequireAuth><MockCheckout /></RequireAuth>} />
            <Route path="/order-success" element={<RequireAuth><OrderSuccess /></RequireAuth>} />
            <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
            <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
            <Route
              path="/admin/*"
              element={
                <RequireAdmin>
                  <Suspense fallback={<Spinner label="Loading dashboard" />}>
                    <AdminApp />
                  </Suspense>
                </RequireAdmin>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </ErrorBoundary>
      {!isAdmin && <StyleAssistant />}
      {!isAdmin && <Footer />}
    </div>
  );
}
