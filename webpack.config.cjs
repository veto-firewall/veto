const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  entry: {
    background: './src/background/index.ts',
    popup: './src/popup/index.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  optimization: {
    usedExports: true,
    sideEffects: false, // Enable better tree-shaking
    minimize: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    fallback: {
      net: path.resolve(__dirname, './src/utils/net-polyfill.ts'),
      buffer: require.resolve('buffer/')
    }
  },    plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/popup/popup.html', to: 'popup.html' },
        { from: 'src/popup/popup.css', to: 'popup.css' },
        { from: 'assets', to: 'assets' },
        { from: 'filters', to: 'filters' }
      ]
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    // Generate bundle analysis report but exclude from production build
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: '../docs/bundle-report.html', // Save outside the dist folder
      openAnalyzer: false
    })
  ]
};
