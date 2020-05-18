const webpack = require('webpack');
const path = require('path')
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const packageFile = require('./package.json');
//const gitRevision = require('git-revision');

module.exports = (env) => {
    const mode = process.env.NODE_ENV || "development";
    return {
        mode: mode,
        context: __dirname,
        entry: './app/index.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'bookmarklet.js'
        },
        devtool: 'source-map',
        module: {
            rules: [
                {
                    test: /\.js$/,
                    loader: "transform-loader?brfs"
                }
            ]
        },
        plugins: [
            new CleanWebpackPlugin(),
            new CopyWebpackPlugin({ 
              patterns:[
                {from: './app/resources', to: 'resources'},
                {from: './doc/bookmarkInstallation.html'}
              ]
            }),
            new webpack.DefinePlugin({
                APP: JSON.stringify({
                    version: packageFile.version,
                    issueTrackingUrl: packageFile.bugs.url
                }),
            }),
            mode == 'production' && new UglifyJsPlugin({ 
              uglifyOptions: {ecma: 8},
              sourceMap: true 
            })
        ].filter(Boolean)
    }
};
