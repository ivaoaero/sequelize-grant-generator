export type SQLGeneratorOptions = {
  /**
   * Should the generated SQL commands start with a `REVOKE SELECT, INSERT, UPDATE, DELETE` command to remove all grants from the user
   * This is useful if you want to clear all grants before adding new ones
   * @default false
   */
  clearAllGrants?: boolean;

  /**
   * Should the generated SQL commands end with a `FLUSH PRIVILEGES` command
   * @default true
   */
  flushPrivileges?: boolean;

  /**
   * Host of the database user
   * @default "%"
   */
  databaseUserHost?: string;
};
