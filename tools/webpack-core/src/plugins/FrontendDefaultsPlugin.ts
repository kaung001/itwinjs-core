/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { Compiler, Configuration, DefinePlugin, ExternalsPlugin, RuleSetRule, WebpackOptionsNormalized } from "webpack";

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
const FilterWarningsPlugin = require("webpack-filter-warnings-plugin");
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */

const isProductionLikeMode = (
  options: Configuration | WebpackOptionsNormalized
) => {
  return options.mode === "production" || !options.mode;
};

export class FrontendDefaultsPlugin {
  constructor(private _enableSourcemaps = true) { }
  public apply(compiler: Compiler) {
    // Add a loader to remove all asserts in production builds.
    const defaultRules: RuleSetRule[] = [
      {
        test: /\.js$/,
        loader: require.resolve("source-map-loader"),
        enforce: "pre",
      },
    ];

    if (isProductionLikeMode(compiler.options)) {
      defaultRules.push({
        test: /\.js$/,
        loader: path.join(__dirname, "../loaders/strip-assert-loader.js"),
        enforce: "pre",
      });
    }

    compiler.options.module.rules = [
      ...defaultRules,
      ...(compiler.options.module.rules || []),
    ];

    if (this._enableSourcemaps) {
      compiler.options.output.devtoolModuleFilenameTemplate = (
        value: any,
        options: Configuration
      ) => {
        if (value) return value;

        if (isProductionLikeMode(options))
          return (info: any) =>
            path
              .relative(
                options.output?.path || process.cwd(),
                info.absoluteResourcePath
              )
              .replace(/\\/g, "/");

        return (info: any) => info.absoluteResourcePath.replace(/\\/g, "/");
      };
    }

    // Add default plugins
    new DefinePlugin({
      "global.GENTLY": false,
    }).apply(compiler);
    new FilterWarningsPlugin({ exclude: /Failed to parse source map/ }).apply(
      compiler
    );
    new ExternalsPlugin("commonjs", ["electron"]).apply(compiler);
  }
}
