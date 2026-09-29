module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans TC"', '"PingFang TC"', 'Microsoft JhengHei', 'sans-serif'],
        display: ['"Noto Serif TC"', 'serif'],
      },
      colors: {
        ink: '#172439', forest: '#24496b', leaf: '#39799c', moss: '#dcebf1',
        paper: '#f4f7fb', coral: '#d57858', sun: '#e2b94e', line: '#dbe3ed',
      },
    },
  },
  plugins: [],
};