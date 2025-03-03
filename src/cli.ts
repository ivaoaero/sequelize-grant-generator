import { program } from "@commander-js/extra-typings";
import { getModelsFromSourceFiles } from "./parser";
import { generateSQLCommandsFromFoundModels } from "./sql_generator";
import { Sequelize } from "sequelize";

program
  .version("0.0.1")
  .description(
    "A CLI tool to scan a directory for sequelize models usage and grant permissions to the database user"
  )
  .command("scan-and-grant")
  .argument("<directory>", "Directory to scan for sequelize models")
  .argument("<sequelize-models-package>", "Package name of sequelize models")
  .option(
    "--sequelize-instance-import-path <sequelize-instance-import-path>",
    "Import path of sequelize instance from main export. Example: `a.b.c` will be imported as `import { c } from 'a.b'`. Default: `sequelize`",
    "sequelize"
  )
  .option(
    "--db-target-username <db-target-username>",
    "Target database username, Default: env.DB_TARGET_USERNAME",
    process.env.DB_TARGET_USERNAME
  )
  .option("--dry-run", "Do not execute the SQL commands, just print them")
  .option("--print-sql", "Print the SQL commands")
  .action(async (directory, packageName, options) => {
    if (!options.dbTargetUsername) {
      console.error(
        "`env.DB_TARGET_USERNAME` and `--db-target-username` not set, need at least one"
      );
      process.exit(1);
    }
    // Will fail if package is not installed
    const topLevelPackage = require(packageName);
    // Will transform `sequelize.models` into `import { sequelize } from 'packageName'; const models = sequelize.models;`
    // https://stackoverflow.com/a/6394168/8277881
    const sequelize: Sequelize = options.sequelizeInstanceImportPath
      .split(".")
      .reduce((o, i) => o[i], topLevelPackage);
    // console.log(directory, options.dbTargetUsername, sequelize.models);

    // Start actual scanning
    // Extract all models and how they are interacting with the DB (CRUD)
    const foundModels = getModelsFromSourceFiles(directory, sequelize.models);

    // Generate the SQL query that will grant the right priviledges
    const query = generateSQLCommandsFromFoundModels(
      foundModels,
      options.dbTargetUsername
    );

    if (options.printSql) console.log(query);

    if (!options.dryRun) await sequelize.query(query);
  });
program.parse(process.argv);
