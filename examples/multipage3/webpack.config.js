/**
 * @file skeleton conf
 * @author panyuqi (pyqiverson@gmail.com)
 */

/* eslint-disable fecs-no-require */

'use strict';

const path = require('path');
const utils = require('./utils');
const merge = require('webpack-merge');
const baseWebpackConfig = require('./webpack.base.conf');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const SkeletonWebpackPlugin = require('../../lib');

function resolve(dir) {
    return path.join(__dirname, dir);
}

let webpackConfig = merge(baseWebpackConfig, {
    module: {
        rules: utils.styleLoaders({
            sourceMap: false,
            extract: true
        }).concat(SkeletonWebpackPlugin.loader({
            include: [
                resolve('src/pages/page1/entry.js')
            ],
            options: {
                entry: ['page1'],
                routePathTemplate: '/[name]',
                insertAfter: 'routes: [',
                importTemplate: 'import [name] from \'./[name].vue\';'
            }
        }))
    },
    devtool: false,
    plugins: [

        new ExtractTextPlugin({
            filename: utils.assetsPath('css/[name].css')
        }),

        new SkeletonWebpackPlugin({
            webpackConfig: {
                entry: {
                    // 仅 page1 使用 Skeleton
                    page1: resolve('./src/pages/page1/entry-skeleton.js')
                }
            }
        }),

        new HtmlWebpackPlugin({
            filename: utils.assetsPath('../page1.html'),
            template: path.join(__dirname, './src/pages/page1/index.html'),
            chunks: ['page1'], // 或者使用 excludeChunks
            // excludeChunks: ['page2'],
            chunksSortMode: 'dependency'
        }),

        new HtmlWebpackPlugin({
            filename: utils.assetsPath('../page2.html'),
            template: path.join(__dirname, './src/pages/page2/index.html'),
            chunks: ['page2'],
            // excludeChunks: ['page1'],
            chunksSortMode: 'dependency'
        })
    ]
});

module.exports = webpackConfig;
