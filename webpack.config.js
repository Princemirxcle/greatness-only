const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const InlineChunkHtmlPlugin = require('inline-chunk-html-plugin');

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
        clean: true,
      },
      devtool: isProduction ? false : 'inline-source-map',
    },
    // UI code (runs in an iframe)
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
          {
            test: /\.css$/,
            use: ['style-loader', 'css-loader'],
          },
        ],
      },
      resolve: {
        extensions: ['.ts', '.js'],
      },
      output: {
        filename: 'ui.js',
        path: path.resolve(__dirname, 'dist'),
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: './src/ui/ui.html',
          filename: 'ui.html',
          inject: 'body',
          chunks: ['main'],
        }),
        new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/ui/]),
      ],
      devtool: isProduction ? false : 'inline-source-map',
    },
  ];
};
