import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard';
import type { Product } from '../lib/types';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Red Silk Saree',
  slug: 'red-silk-saree',
  description: 'A rich red silk saree',
  price: 120,
  images: ['/images/w1.png'],
  category: { id: 'c1', name: 'Women', slug: 'women' },
  subcategory: 'Saree',
  bestseller: false,
  isActive: true,
  inStock: true,
  variants: [{ id: 'v1', size: 'Free Size', stock: 4, lowStock: false }],
  rating: { average: 0, count: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const renderCard = (p: Product) =>
  render(
    <MemoryRouter>
      <ProductCard product={p} />
    </MemoryRouter>,
  );

describe('ProductCard', () => {
  it('links to the product page and shows name and AUD price', () => {
    renderCard(product());
    expect(screen.getByRole('link', { name: 'Red Silk Saree' })).toHaveAttribute('href', '/product/red-silk-saree');
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Red Silk Saree' })).toHaveAttribute('loading', 'lazy');
  });

  it('shows bestseller and sold-out badges only when they apply', () => {
    const { rerender } = renderCard(product());
    expect(screen.queryByText('Bestseller')).not.toBeInTheDocument();
    expect(screen.queryByText('Sold out')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ProductCard product={product({ bestseller: true, inStock: false })} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Bestseller')).toBeInTheDocument();
    expect(screen.getByText('Sold out')).toBeInTheDocument();
  });

  it('shows the rating only when there are reviews', () => {
    renderCard(product({ rating: { average: 4.5, count: 3 } }));
    expect(screen.getByText('(3)')).toBeInTheDocument();
    expect(screen.getByLabelText('4.5 out of 5 stars')).toBeInTheDocument();
  });
});
