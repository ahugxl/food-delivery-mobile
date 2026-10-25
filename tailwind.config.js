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
        teal: '#159E98',
        tealLight: '#E7F7F5',
        cream: '#FFFBF5',
        ink: '#17241B',
        forest: '#21422B',
        coral: '#E45B3F',
        muted: '#827A71',
        line: '#EFE5DA',
        card: '#FFFFFF',
        sage: '#E5F0E5',
      },
    },
  },
  plugins: [],
};
