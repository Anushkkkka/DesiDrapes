import { Link } from 'react-router-dom';
import { assets } from '../lib/assets';
import { useProducts } from '../hooks/useCatalog';
import ProductCard from '../components/ProductCard';
import { ErrorState, ProductGridSkeleton, Title } from '../components/ui';

function Hero() {
  return (
    <section className="flex flex-col border border-gray-400 sm:flex-row">
      <div className="flex w-full items-center justify-center py-10 sm:w-1/2 sm:py-0">
        <div className="text-ink">
          <div className="flex items-center gap-2">
            <p className="h-[2px] w-8 bg-ink md:w-11" />
            <p className="text-sm font-medium md:text-base">OUR BESTSELLERS</p>
          </div>
          <h1 className="prata-regular text-3xl leading-relaxed sm:py-3 lg:text-5xl">Latest Arrivals</h1>
          <Link to="/collection" className="group flex items-center gap-2">
            <p className="text-sm font-semibold md:text-base">SHOP NOW</p>
            <p className="h-[1px] w-8 bg-ink transition-all group-hover:w-14 md:w-11" />
          </Link>
        </div>
      </div>
      <img className="w-full sm:w-1/2" src={assets.hero} alt="Model wearing a DesiDrapes outfit" />
    </section>
  );
}

function ProductRow({ title, subtitle, filters }: { title: [string, string]; subtitle: string; filters: Parameters<typeof useProducts>[0] }) {
  const { data, isLoading, isError, refetch } = useProducts(filters);
  return (
    <section className="my-14">
      <Title first={title[0]} second={title[1]} subtitle={subtitle} />
      {isLoading ? (
        <ProductGridSkeleton count={filters.limit} />
      ) : isError ? (
        <ErrorState message="We couldn't load products right now." onRetry={() => refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-4 gap-y-8 md:grid-cols-3 lg:grid-cols-5">
          {data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </section>
  );
}

const POLICIES = [
  { icon: '⇄', title: 'Easy exchange', text: 'Hassle-free size exchanges' },
  { icon: '↺', title: '7-day returns', text: 'Change of mind? No problem' },
  { icon: '☏', title: 'Friendly support', text: 'Real people, 7 days a week' },
];

export default function Home() {
  return (
    <>
      <Hero />
      <ProductRow
        title={['LATEST', 'COLLECTIONS']}
        subtitle="Fresh drops of handcrafted ethnic wear: festive colours, rich fabrics and timeless silhouettes."
        filters={{ sort: 'newest', limit: 10 }}
      />
      <ProductRow
        title={['BEST', 'SELLERS']}
        subtitle="The pieces our customers keep coming back for."
        filters={{ bestseller: true, sort: 'popular', limit: 5 }}
      />
      <section className="grid gap-12 py-16 text-center text-sm text-gray-700 sm:grid-cols-3">
        {POLICIES.map((p) => (
          <div key={p.title}>
            <p className="mx-auto mb-4 text-3xl" aria-hidden>
              {p.icon}
            </p>
            <p className="font-semibold">{p.title}</p>
            <p className="text-gray-400">{p.text}</p>
          </div>
        ))}
      </section>
    </>
  );
}
