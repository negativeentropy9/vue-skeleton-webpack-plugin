/**
 * @file generate skeleton
 * @author panyuqi <panyuqi@baidu.com>
 */

/* eslint-disable no-console, fecs-no-require */
const htmlWebpackPlugin = require('html-webpack-plugin');
const ssr = require('./ssr');
const {insertAt, isObject, isFunction, generateRouterScript} = require('./util');

const DEFAULT_PLUGIN_OPTIONS = {
    webpackConfig: {},
    insertAfter: '<div id="app">',
    quiet: false
};

const DEFAULT_ENTRY_NAME = 'main';

const PLUGIN_NAME = 'VueSkeletonWebpackPlugin';

var neededSkeletonsMap = {};

class SkeletonPlugin {

    constructor(options = {}) {
        this.options = Object.assign({}, DEFAULT_PLUGIN_OPTIONS, options);
    }

    apply(compiler) {
        let skeletons;
        // compatible with webpack 4.x
        if (compiler.hooks) {
            compiler.hooks.make.tapAsync(PLUGIN_NAME, (compilation, cb) => {
                this.generateSkeletonForEntries(this.extractEntries(compiler.options.entry), compiler, compilation)
                    .then(skeletonResults => {
                        skeletons = skeletonResults.reduce((cur, prev) => Object.assign(prev, cur), {});

                        cb();
                    })
                    .catch(e => console.log(e));

                compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing && compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing.tapAsync(PLUGIN_NAME, (htmlPluginData, callback) => {
                    this.generateInjectTemplate(htmlPluginData, skeletons);

                    callback(null, htmlPluginData);
                });

                !compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing && htmlWebpackPlugin.getHooks(compilation).beforeAssetTagGeneration.tapAsync(PLUGIN_NAME, (htmlPluginData, callback) => {
                    neededSkeletonsMap[htmlPluginData.outputName] = this.findSkeleton(htmlPluginData, skeletons);

                    callback(null, htmlPluginData);
                });

                !compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing && htmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(PLUGIN_NAME, (htmlPluginData, callback) => {
                    this.injectToHtml(htmlPluginData, neededSkeletonsMap[htmlPluginData.outputName]);

                    callback(null, htmlPluginData);
                });
            });
        }
        else {
            compiler.plugin('make', (compilation, cb) => {
                this.generateSkeletonForEntries(this.extractEntries(compiler.options.entry), compiler, compilation)
                    .then(skeletonResults => {
                        skeletons = skeletonResults.reduce((cur, prev) => Object.assign(prev, cur), {});

                        cb();
                    })
                    .catch(e => console.log(e));

                compilation.plugin('html-webpack-plugin-before-html-processing', (htmlPluginData, callback) => {
                    this.generateInjectTemplate(htmlPluginData, skeletons);

                    callback(null, htmlPluginData);
                });
            });
        }
    }

    /**
     * format entries for all skeletons from options
     *
     * @param {Object} parentEntry entry in webpack.config
     * @return {Object} entries entries for all skeletons
     */
    extractEntries(parentEntry) {
        let entry = Object.assign({}, this.options.webpackConfig.entry);
        let skeletonEntries;

        if (isObject(entry)) {
            skeletonEntries = entry;
        }
        else {
            let entryName = DEFAULT_ENTRY_NAME;

            if (isObject(parentEntry)) {
                entryName = Object.keys(parentEntry)[0];
            }
            skeletonEntries = {
                [entryName]: entry
            };
        }

        return skeletonEntries;
    }

    /**
     * find skeleton for current html-plugin in all skeletons
     *
     * @param {Object} htmlPluginData data for html-plugin
     * @param {Object} skeletons skeletons
     * @param {Object} target skeleton
     */
    findSkeleton(htmlPluginData, skeletons = {}) {
        const usedChunks = htmlPluginData.assets.chunks ? Object.keys(htmlPluginData.assets.chunks) : htmlPluginData.assets.js;
        let entryKey;

        // find current processing entry
        if (Array.isArray(usedChunks)) {
            entryKey = Object.keys(skeletons).find(v => {
                for (var i = 0; i < usedChunks.length; i++) {
                    if (!!~usedChunks[i].indexOf(v)) {
                        return true;
                    }
                }
            });
        }
        else {
            entryKey = DEFAULT_ENTRY_NAME;
        }

        return {
            name: entryKey,
            skeleton: skeletons[entryKey]
        };
    }

    /**
     * generate HTML, CSS and JS
     *
     * @param {Object} htmlPluginData data for html-plugin
     * @param {Object} skeleton skeleton
     */
    generateInjectTemplate(htmlPluginData, skeletons) {
        const skeletonData = this.findSkeleton(htmlPluginData, skeletons);

        this.injectToHtml(htmlPluginData, skeletonData);
    }

    /**
     * inject HTML, CSS and JS
     *
     * @param {Object} htmlPluginData data for html-plugin
     * @param {Object} skeletonData skeleton
     */
    injectToHtml(htmlPluginData, skeletonData) {
        let {insertAfter} = this.options;
        const {name, skeleton} = skeletonData;

        if (!name || !skeleton) {
            return;
        }

        const {html = '', css = '', script = ''} = skeleton;

        // insert inlined styles into html
        let headTagEndPos = htmlPluginData.html.lastIndexOf('</head>');
        htmlPluginData.html = insertAt(htmlPluginData.html, `<style>${css}</style>`, headTagEndPos);

        // replace mounted point with ssr result in html
        if (isFunction(insertAfter)) {
            insertAfter = insertAfter(name);
        }
        let appPos = htmlPluginData.html.lastIndexOf(insertAfter) + insertAfter.length;
        htmlPluginData.html = insertAt(htmlPluginData.html, html + script, appPos);
    }

    /**
     * generate skeletons for all entries
     *
     * @param {Object} entries entries for all skeletons
     * @param {Object} compiler compiler
     * @param {Object} compilation compilation
     * @return {Promise} promise
     */
    generateSkeletonForEntries(entries, compiler, compilation) {
        const {router, minimize, quiet} = this.options;

        return Promise.all(Object.keys(entries).map(entryKey => {
            let skeletonWebpackConfig = Object.assign({}, this.options.webpackConfig);

            // set current entry & output in webpack config
            skeletonWebpackConfig.entry = entries[entryKey];
            if (!skeletonWebpackConfig.output) {
                skeletonWebpackConfig.output = {};
            }
            skeletonWebpackConfig.output.filename = `skeleton-${entryKey}.js`;

            // inject router code in SPA mode
            let routerScript = '';
            if (router) {
                const isMPA = !!(Object.keys(entries).length > 1);
                routerScript = generateRouterScript(router, minimize, isMPA, entryKey);
            }

            // server side render skeleton for current entry
            return ssr(skeletonWebpackConfig, {
                quiet, compilation, context: compiler.context
            }).then(({skeletonHTML, skeletonCSS}) => {
                return {
                    [entryKey]: {
                        html: skeletonHTML,
                        css: skeletonCSS,
                        script: routerScript
                    }
                };
            });
        }));
    }

    static loader(ruleOptions = {}) {
        console.log('[DEPRECATED] SkeletonPlugin.loader is DEPRECATED now. Hot reload in dev mode is supported already, so you can remove this option.');
        return Object.assign(ruleOptions, {
            loader: require.resolve('./loader'),
            options: Object.assign({}, ruleOptions.options)
        });
    }
}

module.exports = SkeletonPlugin;
