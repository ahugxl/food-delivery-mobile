/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        regular: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
      },
      colors: {
        teal: '#008B45',
        tealLight: '#EAF7EF',
        cream: '#FFFFFF',
        ink: '#17241B',
        forest: '#124C42',
        coral: '#E45B3F',
        muted: '#727772',
        line: '#E9ECE9',
        card: '#FFFFFF',
        sage: '#E5F0E5',
      },
    },
  },
  plugins: [],
};
