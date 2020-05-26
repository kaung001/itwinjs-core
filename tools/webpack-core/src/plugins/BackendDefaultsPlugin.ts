/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Compiler, DefinePlugin } from "webpack";
import { IModelJsOptionsDefaulter } from "../utils/IModelJsOptionsDefaulter";
import { CopyAppAssetsPlugin, CopyBentleyStaticResourcesPlugin } from "./CopyBentleyStaticResourcesPlugin";
import { CopyExternalsPlugin } from "./CopyExternalsPlugin";

// tslint:disable:no-var-requires variable-name
const FilterWarningsPlugin = require("webpack-filter-warnings-plugin");
const ExternalsPlugin = require("webpack/lib/ExternalsPlugin");
// tslint:enable:no-var-requires variable-name

export class BackendDefaultsPlugin {
  public apply(compiler: Compiler) {
    // By default, webpack will prefer ES Modules over CommonJS modules.
    // This causes trouble with importing node-fetch, so we need to explicitly prefer CommonJS over ES/Harmony.
    // https://github.com/bitinn/node-fetch/issues/450#issuecomment-494475397
    compiler.options.resolve!.mainFields = ["main"];

    // Don't bother minimizing backends...
    compiler.options.optimization!.minimize = false;

    compiler.options = new IModelJsOptionsDefaulter().process(compiler.options);

    // Add default plugins
    new CopyAppAssetsPlugin("assets").apply(compiler);
    new CopyBentleyStaticResourcesPlugin(["assets"]).apply(compiler);
    new CopyExternalsPlugin().apply(compiler);
    new DefinePlugin({
      "global.GENTLY": false,
    }).apply(compiler);
    new FilterWarningsPlugin({ exclude: /Cannot find source file/ }).apply(compiler);
    new ExternalsPlugin("commonjs", [
      "electron",
      "debug",
      "@bentley/imodeljs-native/package.json",
      "dtrace-provider",
      "node-report/api",
      "applicationinsights-native-metrics",
      "@opentelemetry/tracing",
    ]).apply(compiler);
  }
}
