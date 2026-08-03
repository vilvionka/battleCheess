import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // или твой текущий плагин

export default defineConfig({
  plugins: [react()],
  base: '/battleCheess/', // 🌟 ВАЖНО: косые черты в начале и конце обязательны!
})
