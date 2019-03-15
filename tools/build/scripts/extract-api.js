/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
"use strict";

const spawn = require('cross-spawn');
const argv = require("yargs").argv;
const fs = require("fs-extra");

if (argv.entry === undefined) {
  console.log("No argument found");
  return;
}

const isCI = (process.env.TF_BUILD);
const entryPointFileName = argv.entry;
const isPresentation = argv.isPresentation;

const config = {
  $schema: "https://developer.microsoft.com/json-schemas/api-extractor/api-extractor.schema.json",
  compiler: {
    configType: "tsconfig",
    rootFolder: isPresentation ? "./src" : "."
  },
  project: {
    entryPointSourceFile: isPresentation ? `../lib/${entryPointFileName}.d.ts` : `lib/${entryPointFileName}.d.ts`
  },
  policies: {
    namespaceSupport: "permissive"
  },
  validationRules: {
    missingReleaseTags: "allow"
  },
  apiJsonFile: {
    enabled: false
  },
  apiReviewFile: {
    enabled: true,
    apiReviewFolder: isPresentation ? "../../../common/api" : "../../common/api",
    tempFolder: isPresentation ? "../../../common/temp/api" : "../../common/temp/api"
  }
};

if (!fs.existsSync("lib")) {
  process.stderr.write("lib folder not found. Run `rush build` before extract-api");
  process.exit(1);
}

const configFileName = `lib/${entryPointFileName}.json`;
fs.writeFileSync(configFileName, JSON.stringify(config, null, 2));

const args = [
  "run",
  "-c", configFileName
];
if (!isCI)
  args.push("-l");

//Temporarily re-implementing features of simple-spawn till version 7 of api-extractor is released
//Spawns a child process to run api-extractor and pipes the errors to be handled in this script

console.log("Arguments to TypeDoc: " + JSON.stringify(args, null, 2));

const child = spawn(require.resolve(".bin/api-extractor"), args, {
  cwd: process.cwd(),
  env: Object.assign({ FORCE_COLOR: "1" }, process.env),
  stdio: 'pipe',
});
child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

let errorCode = 0;
child.stderr.on('data', (data) => {
  if (data.includes("You have changed the public API signature for this project.") && isCI)
    errorCode = 1;

  // Workaround: Errors we currently hit in the iModel.js that will be fixed with API-extractor v7.
  if (data.includes("The @param block") ||
    data.includes("TSDoc") ||
    data.includes("HTML") ||
    data.includes("Structured content") ||
    data.includes("The code span") ||
    data.includes("A backslash can only be used") ||
    data.includes("for a code fence")) {
    //Filter out these errors
  } else {
    process.stderr.write(data);
    if (isCI)
      errorCode = 1;
  }
});
child.on('error', function (data) { console.log(chalk.red(data)); });
child.on('close', (code) => {
  if (fs.existsSync(configFileName))
    fs.unlinkSync(configFileName);

  if (fs.existsSync("dist/tsdoc-metadata.json")) {
    fs.unlinkSync("dist/tsdoc-metadata.json");
    fs.rmdirSync("dist");
  }
  process.exit(errorCode);
});