/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        prata: ['Prata', 'Georgia', 'serif'],
      },
      colors: {
        ink: '#414141',
        brand: { DEFAULT: '#7a1f3d', light: '#f7ecef' },
      },
    },
  },
  plugins: [],
};
