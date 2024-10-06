import { SequelizeFoundModelsRecord } from "./types/parser.dto";
import { SQLGeneratorOptions } from "./types/sql_generator.dto";

/**
 * Generate SQL commands to grant permissions to a database user based on the found models
 * @param {SequelizeFoundModelsRecord} foundModels Models and their usage from the parser
 * @param {string} databaseUsername Username of the database user to generate the SQL commands for
 * @param {SQLGeneratorOptions} options Additional options for the SQL generator
 * @returns {string} SQL commands to grant permissions to the database user
 */
export function generateSQLCommandsFromFoundModels(
  foundModels: SequelizeFoundModelsRecord,
  databaseUsername: string,
  options: SQLGeneratorOptions = {}
): string {
  // Setting default value
  if (!options.databaseUserHost) options.databaseUserHost = "%";
  if (options.flushPrivileges === undefined) options.flushPrivileges = true;

  const tablePermissions = Object.values(foundModels).map(
    ({ table, isSelect, isInsert, isUpdate, isDelete }) => {
      const permissions = [
        isSelect ? "SELECT" : "",
        isInsert ? "INSERT" : "",
        isUpdate ? "UPDATE" : "",
        isDelete ? "DELETE" : "",
      ].filter(Boolean);

      return {
        table,
        permissions,
      };
    }
  );

  const grantCommands = [];
  if (options.clearAllGrants)
    grantCommands.push(
      `REVOKE SELECT, INSERT, UPDATE, DELETE ON *.* FROM '${databaseUsername}'@'%';`
    );

  grantCommands.push(
    ...tablePermissions
      .map(({ table, permissions }) => {
        return permissions.map((permission) => {
          return `GRANT ${permission} ON ${table} TO '${databaseUsername}'@'%';`;
        });
      })
      .flat()
  );

  if (options.flushPrivileges) grantCommands.push("FLUSH PRIVILEGES;");

  return grantCommands.join("\n");
}
