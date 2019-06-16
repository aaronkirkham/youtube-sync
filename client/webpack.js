/* eslint-disable */

const webpack = require('webpack');
const path = require('path');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, options) => {
  return {
    entry: ['./src/main.js'],
    output: {
      path: path.resolve(__dirname, './dist'),
      filename: 'app.js',
    },
    devServer: {
      historyApiFallback: true,
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules|vue\/src|vue-router\//,
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
        {
          test: /\.scss$/,
          use: [
            { loader: 'style-loader' },
            { loader: 'css-loader' },
            { loader: 'sass-loader' },
          ],
        },
        {
          test: /\.vue$/,
          use: 'vue-loader',
        },
      ],
    },
    plugins: [
      new webpack.EnvironmentPlugin({
        MODE: options.mode,
        ROUTER_BASE: options.ROUTER_BASE ? options.ROUTER_BASE : '/',
      }),
      new VueLoaderPlugin(),
      new CopyWebpackPlugin([
        { from: './src/index.html' },
        { from: './src/.htaccess' },
      ]),
    ],
    resolve: {
      extensions: ['.js', '.vue', '.json'],
      alias: {
        vue$: 'vue/dist/vue.common.js',
      },
    },
  };
};
