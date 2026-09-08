export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#26262a',
        paper: '#ffffff',
        muted: '#f3f1fb',
        border: '#e4e1f0',
        'border-strong': '#c9c5de',
        accent: '#E8823C',
        'accent-ink': '#4A2A0C',
        'ui-accent': '#6f4bc9',
        'ui-accent-ink': '#2e1f57',
        'text-secondary': '#726f85',
        danger: '#c0392b',
        success: '#1f8a4c',
        info: '#3d55c9',
        'brand-deep': '#22201f'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
};
