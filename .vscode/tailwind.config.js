module.exports = {
    content: [
      './src/**/*.{js,ts,jsx,tsx}',
      './node_modules/@clerk/**/*.{js,ts,jsx,tsx}'
    ],
    darkMode: 'media',
    theme: {
      extend: {
        transitionDuration: {
          '300': '300ms',
          '400': '400ms',
        },
        keyframes: {
          'fade-in-up': {
            '0%': { opacity: '0', transform: 'translateY(20px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          }
        },
        animation: {
          'fade-in-up': 'fade-in-up 0.8s ease-out',
        }
      }
    },
    plugins: [
      require('@tailwindcss/forms'),
      require('@tailwindcss/typography')
    ]
  }