import { Link } from 'react-router-dom';
import { assets } from '../lib/assets';

export default function Footer() {
  return (
    <footer className="mt-32">
      <div className="grid gap-10 text-sm sm:grid-cols-[3fr_1fr_1fr]">
        <div>
          <img src={assets.logo} className="mb-5 w-24" alt="DesiDrapes" />
          <p className="max-w-md text-gray-600">
            DesiDrapes brings the colour and craft of Indian ethnic wear to Australia: lehengas, sarees, kurtas and
            sherwanis for every celebration, for the whole family.
          </p>
        </div>
        <div>
          <p className="mb-4 text-lg font-medium">COMPANY</p>
          <ul className="flex flex-col gap-1 text-gray-600">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About us</Link></li>
            <li><Link to="/collection">Shop</Link></li>
            <li><Link to="/orders">My orders</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 text-lg font-medium">GET IN TOUCH</p>
          <ul className="flex flex-col gap-1 text-gray-600">
            <li>support@desidrapes.example</li>
            <li><Link to="/contact">Contact page</Link></li>
          </ul>
        </div>
      </div>
      <hr className="mt-10" />
      <p className="py-5 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} DesiDrapes. A portfolio project. Payments run in test mode and no real orders are fulfilled.
      </p>
    </footer>
  );
}
