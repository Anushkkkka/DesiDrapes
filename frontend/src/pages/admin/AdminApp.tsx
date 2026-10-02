import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './Dashboard';
import AdminProducts from './AdminProducts';
import ProductForm from './ProductForm';
import AdminOrders from './AdminOrders';
import AdminCoupons from './AdminCoupons';
import AdminUsers from './AdminUsers';
import AuditLog from './AuditLog';
import { NotFound } from '../StaticPages';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/coupons', label: 'Coupons' },
  { to: '/admin/users', label: 'Customers' },
  { to: '/admin/audit', label: 'Audit log' },
];

export default function AdminApp() {
  return (
    <div className="flex flex-col gap-6 border-t pb-20 pt-6 md:flex-row">
      <nav className="flex gap-1 overflow-x-auto md:w-48 md:shrink-0 md:flex-col" aria-label="Admin">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `whitespace-nowrap rounded px-3 py-2 text-sm ${isActive ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id" element={<ProductForm />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
}
