import React, { useMemo, useState } from 'react'
import { product } from '../assets/assets'

const categories = ['All', 'Kids', 'Men', 'Women']

const Collectionpg = () => {
  const [activeCategory, setActiveCategory] = useState('All')

  const visibleProducts = useMemo(() => {
    if (activeCategory === 'All') return product
    return product.filter((item) => item.category === activeCategory)
  }, [activeCategory])

  return (
    <div className='py-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p className='text-sm text-gray-500'>Browse our catalog</p>
          <h1 className='text-2xl font-semibold text-gray-800'>Collection</h1>
        </div>

        <div className='flex flex-wrap gap-2'>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeCategory === category
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 text-gray-600 hover:border-black'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className='mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3'>
        {visibleProducts.map((item) => (
          <div key={item._id} className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
            <img src={item.image[0]} alt={item.name} className='h-64 w-full object-cover' />
            <div className='p-4'>
              <div className='mb-2 flex items-center justify-between'>
                <h2 className='text-lg font-semibold text-gray-800'>{item.name}</h2>
                {item.bestseller && (
                  <span className='rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700'>Bestseller</span>
                )}
              </div>
              <p className='mb-3 text-sm text-gray-600'>{item.description}</p>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-semibold text-gray-900'>{item.price}</span>
                <button className='rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 transition hover:border-black hover:text-black'>View</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Collectionpg
