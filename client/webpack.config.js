/* eslint-disable */

const webpack = require('webpack');
const path = require('path');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WebappWebpackPlugin = require('webapp-webpack-plugin');
const config = require('./config.json');

module.exports = (env, options) => {
  return {
    entry: ['./src/main.js'],
    output: {
      path: path.resolve(__dirname, './public'),
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
        {
          test: /\.(png|jpg|gif|svg|woff|woff2|eot|ttf)$/,
          use: 'url-loader?name=[name].[hash:7].[ext]',
        },
      ],
    },
    plugins: [
      new webpack.EnvironmentPlugin({
        MODE: options.mode,
        SOCKETURL: config.serverUrl,
        APIKEY: config.ytApiPublicKey,
      }),
      new VueLoaderPlugin(),
      new HtmlWebpackPlugin({
        inject: false,
        title: 'YouTube Sync',
        template: require('html-webpack-template'),
        appMountId: 'app',
        appMountHtmlSnippet: '<noscript>Please enable JavaScript to use this app!</noscript>',
        mobile: true,
        lang: 'en',
        links: [
          'https://fonts.googleapis.com/css?family=PT+Sans:400,700',
        ],
        meta: [
          {
            name: 'description',
            content: 'Synchronized YouTube video playback between multiple clients. Create a room, invite your friends and create a playlist of videos to watch together.',
          },
        ],
        hash: true,
        minify: {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true,
        },
      }),
      new WebappWebpackPlugin({
        logo: './src/assets/favicon.png',
        outputPath: './assets',
        inject: 'force',
        favicons: {
          appName: 'YouTube Sync',
          appDescription: 'Synchronized YouTube video playback between multiple clients. Create a room, invite your friends and create a playlist of videos to watch together.',
          developerName: null,
          developerURL: null,
          lang: 'en',
          background: 'transparent',
          theme_color: '#31373d',
          icons: {
            appleStartup: false,
            coast: false,
            favicons: true,
            yandex: false,
          },
        },
      }),
    ],
    resolve: {
      extensions: ['.js', '.vue', '.json'],
      alias: {
        vue$: 'vue/dist/vue.common.js',
      },
    },
  };
};
