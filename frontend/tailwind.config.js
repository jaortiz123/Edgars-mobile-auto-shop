/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html', 
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0A1A3A',
        'light-blue': '#33C3F0',
        gray: '#9F9EA1',
        accent: '#F97316',
        white: '#FFFFFF',
        'bg-light': '#F3F4F6',
        'text-dark': '#1F2937',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-out',
        'fadeInUp': 'fadeInUp 0.6s ease-out',
        'slideInRight': 'slideInRight 0.5s ease-out',
        'scaleIn': 'scaleIn 0.4s ease-out',
        'bounceIn': 'bounceIn 0.6s ease-out',
        'float': 'float-gentle 4s ease-in-out infinite',
        'gradient': 'gradient-shift 4s ease infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        fadeInUp: {
          from: {
            opacity: '0',
            transform: 'translateY(30px)'
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        slideInRight: {
          from: {
            opacity: '0',
            transform: 'translateX(-30px)'
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)'
          }
        },
        scaleIn: {
          from: {
            opacity: '0',
            transform: 'scale(0.9)'
          },
          to: {
            opacity: '1',
            transform: 'scale(1)'
          }
        },
        bounceIn: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.3)'
          },
          '50%': {
            opacity: '1',
            transform: 'scale(1.05)'
          },
          '70%': { 
            transform: 'scale(0.9)' 
          },
          '100%': { 
            transform: 'scale(1)' 
          }
        },
        'float-gentle': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' }
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' }
        }
      },
      backgroundSize: {
        '300%': '300% 300%',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
