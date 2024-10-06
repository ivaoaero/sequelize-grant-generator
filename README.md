# Sequelize Grant Generator

Typescript plugin that extracts Sequelize models' usage in source code and generates SQL grants accordingly.

## Context

This tool was built by and for the [IVAO](https://www.ivao.aero/) Web Development team to automatically grant its API the rights access to the databases and tables based on the models used in the code.

## Usage

### Recommended

The easiest way to extract the models is with this simple code:

```ts
import { getModelsFromSourceFiles } from "@ivaoaero/sequelize-grant-generator";
import { sequelize } from "@ivaoaero/database"; // or '../injection/db';

const PATH_TO_TS_PROJECT = "/home/tchekda/Prog/IVAO/core-api";
const MY_MODELS = sequelize.models;

const foundModels = getModelsFromSourceFiles(PATH_TO_TS_PROJECT, MY_MODELS);
// Dump all models and how they are interacting with the DB (CRUD)
console.log(JSON.stringify(foundModels));
```

### Advanced

If you need some custom logic that we don't support, feel free to create your own parser and make it extend `SequelizeParser` to reuser parts of our logic.

## Documentation

For now we haven't had the time to format the code documentation into something easily readable. We suggest you go over the source code directly as we tried to extensively comment all available options and logic used.

## Bugs and Features

If you encounter any bugs or need any additional feature, please open a GitHub Issue.

## Contribution

Feel free to contribute to this repository by making Pull Requests.

## Credits:

The tool was inspired by this [StackOverflow response](https://stackoverflow.com/a/78130948/8277881) and became a reality thanks to [David T. (Web Developer Manager)](https://github.com/tchekda)'s craziness, free time and dedication.

## Contact

Feel free to contact us at [web@ivao.aero](mailto:web@ivao.aero) if needed or open an issue for discussions related to this plugin.
