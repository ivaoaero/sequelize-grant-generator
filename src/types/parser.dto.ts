import { Model, ModelStatic } from "sequelize";

export type SequelizeParserModelOperations = {
  table: string;
  isSelect: true;
  isInsert: boolean;
  isUpdate: boolean;
  isDelete: boolean;
};

export type SequelizeFoundModelsRecord = Record<
  string,
  SequelizeParserModelOperations
>;

export type SequelizeParserOptions = {
  /**
   * Name or location of the `tsconfig.json` file
   * @default "tsconfig.json"
   */
  tsConfigName?: string;
  /**
   * Only get models from a specific module import
   * @example "./models"
   * @example "@myorg/models"
   */
  onlyFromSpecificModuleImport?: string;
};

/**
 * Record of available models.
 * Key is the model name, value is the model class
 * Usually, you would pass `sequelize.models` to this
 */
export type SequelizeParserAvailableModelsRecord = Record<
  string,
  ModelStatic<Model>
>;

export enum SequelizeWriteOperationType {
  INSERT = "INSERT",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}
