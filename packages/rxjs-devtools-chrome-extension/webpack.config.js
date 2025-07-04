const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    popup: './src/popup/popup.tsx',
    devtools: './src/devtools.ts',
    panel: './src/panel.tsx',
    background: './src/background.ts',
    content: './src/content.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: '.' },
        { from: 'src/popup/popup.html', to: '.' },
        { from: 'src/devtools.html', to: '.' },
        { from: 'src/panel.html', to: '.' },
        { from: 'src/bridge.js', to: '.' },
        { from: 'public/icons', to: 'icons' },
      ],
    }),
  ],
  devtool: 'cheap-module-source-map',
};
