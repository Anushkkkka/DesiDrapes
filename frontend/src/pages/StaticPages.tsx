import { Link } from 'react-router-dom';
import { assets } from '../lib/assets';
import { Title } from '../components/ui';

export function About() {
  return (
    <div className="border-t pt-10">
      <Title first="ABOUT" second="US" />
      <div className="my-10 flex flex-col gap-12 md:flex-row">
        <img src={assets.hero} alt="" className="w-full md:max-w-[450px]" />
        <div className="flex flex-col justify-center gap-5 text-gray-600 md:w-2/4">
          <p>
            DesiDrapes began with a simple idea: Indian families in Australia shouldn't have to wait for a trip home to find
            beautiful, well-made ethnic wear. We bring together lehengas, sarees, anarkalis, kurtas and sherwanis for every
            festival, wedding and celebration.
          </p>
          <p>
            Every piece is chosen for its fabric, finish and comfort, with sizes for the whole family, from little ones'
            festive sets to bridal and groom collections.
          </p>
          <b className="text-gray-800">Our mission</b>
          <p>To make celebrating culture effortless: great design, honest prices and service that feels like family.</p>
        </div>
      </div>
      <div className="mb-20 grid text-sm md:grid-cols-3">
        {[
          ['Quality assurance', 'Each garment is inspected for stitching, colour and finish before it ships.'],
          ['Convenience', 'Shop by occasion, filter by size and budget, or ask our AI stylist for ideas.'],
          ['Exceptional service', 'Easy exchanges and a support team that actually replies.'],
        ].map(([title, text]) => (
          <div key={title} className="flex flex-col gap-4 border px-10 py-8 sm:py-16 md:px-12">
            <b>{title}</b>
            <p className="text-gray-600">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Contact() {
  return (
    <div className="border-t pt-10">
      <Title first="CONTACT" second="US" />
      <div className="mb-28 mt-10 flex flex-col justify-center gap-10 md:flex-row">
        <img src={assets.hero} alt="" className="w-full md:max-w-[420px]" />
        <div className="flex flex-col items-start justify-center gap-6 text-gray-600">
          <p className="text-xl font-semibold text-gray-700">Our store</p>
          <p>
            Online only
            <br />
            Shipping Australia-wide
          </p>
          <p>
            Email: support@desidrapes.example
            <br />
            Hours: Mon to Sun, 9am to 6pm AEST
          </p>
          <p className="text-xl font-semibold text-gray-700">Order questions</p>
          <p>
            Track your order anytime from{' '}
            <Link to="/orders" className="underline">
              My orders
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="prata-regular text-6xl text-gray-300">404</p>
      <p className="text-lg text-gray-700">We couldn't find that page.</p>
      <Link to="/collection" className="btn-primary">
        Browse the collection
      </Link>
    </div>
  );
}
