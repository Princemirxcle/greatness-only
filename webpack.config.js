const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return [
    // Main plugin code (runs in Figma's main thread)
    {
      mode: isProduction ? 'production' : 'development',
      entry: './src/main.ts',
      module: {
        rules: [
          {
            test: /\.ts$/,
            use: 'ts-loader',
            exclude: /node_modules/,
          },
        ],
      },
      resolve: {
        extensions: ['.ts', '.js'],
      },
      output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
      },
      devtool: isProduction ? false : 'inline-source-map',
    },
    // UI (runs in an iframe) — self-contained HTML with inline script
    {
      mode: isProduction ? 'production' : 'development',
      entry: './src/ui/ui-entry.ts',
      module: {
        rules: [
          {
            test: /\.ts$/,
            use: 'ts-loader',
            exclude: /node_modules/,
          },
        ],
      },
      resolve: {
        extensions: ['.ts', '.js'],
      },
      output: {
        filename: 'ui-bundle.js',
        path: path.resolve(__dirname, 'dist'),
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: './src/ui/ui.html',
          filename: 'ui.html',
          inject: false,
          minify: isProduction ? {
            collapseWhitespace: true,
            removeComments: true,
          } : false,
        }),
      ],
      devtool: isProduction ? false : 'inline-source-map',
    },
  ];
};
