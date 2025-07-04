import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'RxJSDevToolsReact',
      fileName: (format) => format === 'cjs' ? 'index.cjs' : 'index.esm.js',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['react', 'rxjs', 'redux-observable'],
      output: {
        globals: {
          react: 'React',
          rxjs: 'rxjs',
          'redux-observable': 'ReduxObservable'
        }
      }
    }
  }
})
