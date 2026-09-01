module.exports = {
  content: ['../index.html'],
  theme: { extend: {
    fontFamily: { sans: ['Outfit','system-ui','sans-serif'], display: ['Playfair Display','Georgia','serif'] },
    colors: {
      forest: { 50:'#f0f7f4', 100:'#dbeee5', 200:'#bfe0d1', 700:'#0f5c43', 800:'#0d4835', 900:'#0f3d2e' },
      sand:   { 50:'#faf9f6', 100:'#f4f1ea', 200:'#e8e3d7' },
      ember:  { 500:'#d97706', 600:'#b45309' }
    },
    boxShadow: { soft: '0 1px 2px rgba(15,61,46,.04), 0 8px 24px -12px rgba(15,61,46,.18)' }
  }}
}
