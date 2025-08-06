# Sequelize Grant Generator

Typescript plugin that extracts Sequelize models' usage in source code and generates SQL grants accordingly.

## Context

This tool was built by and for the [IVAO](https://www.ivao.aero/) Web Development team to automatically grant its API the rights access to the databases and tables based on the models used in the code.

## Usage

### Installation

```bash
npm install --save-dev @ivaoaero/sequelize-grant-generator
```

```bash
yarn add -D @ivaoaero/sequelize-grant-generator
```

### With CLI

A CLI is exposed to run the tool. The command line looks like this:

```bash
node ./dist/cli.js scan-and-grant /home/tchekda/Prog/IVAO/core/packages/api @ivaoaero/database --db-target-username test --dry-run --print-sql
```

All options are avaible with

```bash
node ./dist/cli.js --help
```

### With code

The easiest way to extract the models is with this simple code:

```ts
import {
  generateSQLCommandsFromFoundModels,
  getModelsFromSourceFiles,
} from "@ivaoaero/sequelize-grant-generator";
import { sequelize } from "@ivaoaero/database"; // or '../injection/db';

const PATH_TO_TS_PROJECT = "/home/tchekda/Prog/IVAO/core-api";
const MY_MODELS = sequelize.models;
const DB_USERNAME = "ivao_core_api";

// Extract all models and how they are interacting with the DB (CRUD)
const foundModels = getModelsFromSourceFiles(PATH_TO_TS_PROJECT, MY_MODELS);

// Generate the SQL query that will grant the right priviledges
const query = generateSQLCommandsFromFoundModels(foundModels, DB_USERNAME);

// Execute the query
sequelize.query(query);
```

### As a NPM dependency

After installing the package, add the following script to your `package.json`:

```json
  "scripts": {
    "db-grant": "sequelize-grant-generator scan-and-grant . @ivaoaero/database --print-sql --additional-found-models-path @ivaoaero/common-api/dist/grants.json --clear-all-grants"
  }
```

So you can now use `npm run db-grant` to execute the command

### Advanced

Both main functions (`getModelsFromSourceFiles` and `generateSQLCommandsFromFoundModels`) take optional options to customize their behaviour. Might be useful in some cases.

If you need some custom parser logic that we don't support, feel free to create your own parser and make it extend `SequelizeParser` to reuser parts of our logic.

## Documentation

For now we haven't had the time to format the code documentation into something easily readable. We suggest you go over the source code directly as we tried to extensively comment all available options and logic used.

### Parser logic

The parser follows those steps to analyze the code:

- Load the typescript configuration in the root directory passed as parameter and initialize the compiler/type-checker with it
- List all the TS files in the project
- Visit/read each file. Each file is reprensented with an [Abstract Syntax Tree (AST)](https://en.wikipedia.org/wiki/Abstract_syntax_tree)
- Visit each node of the AST with a recursive tree-traversal method
  - If the current node is an import statement and the imported value is a sequelize model, add it to the list of found models and set the default flags to `SELECT` only
  - If the current node is a function call (aka `CallExpression`), check if the method is sequelize method and extract the sequelize model it is called on. Apply the `INSERT`, `UPDATE`, or `DELETE` flag to that model
- Return the list of found models with the respective read/write operations

## Bugs and Features

If you encounter any bugs or need any additional feature, please open a GitHub Issue.

## Contribution

Feel free to contribute to this repository by making Pull Requests.

## Credits:

The tool was inspired by this [StackOverflow response](https://stackoverflow.com/a/78130948/8277881) and became a reality thanks to [David T. (Web Developer Manager)](https://github.com/tchekda)'s craziness, free time and dedication.

## Contact

Feel free to contact us at [web@ivao.aero](mailto:web@ivao.aero) if needed or open an issue for discussions related to this plugin.
