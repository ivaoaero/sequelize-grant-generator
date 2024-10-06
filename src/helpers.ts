import { Model, ModelStatic, ModelType, ThroughOptions } from "sequelize";
import ts from "typescript";
import { SequelizeWriteOperationType } from "./types/parser.dto";

export function getSequelizeModelTableName<M extends Model>(
  model: ModelStatic<M>
): string {
  if (typeof model.getTableName() === "string") {
    return model.getTableName() as string;
  }
  const { schema, tableName, delimiter } = model.getTableName() as {
    schema: string;
    tableName: string;
    delimiter: string;
  };
  return `${schema}${delimiter}${tableName}`;
}

/**
 * Utils function to get the location of a node in the format `filename:line:character`
 * @param {ts.Node} node Node to get the location from
 * @returns {string} Location of the node in the format `filename:line:character`
 */
export function getNodeLocationString(node: ts.Node): string {
  const { line, character } = node
    .getSourceFile()
    .getLineAndCharacterOfPosition(node.getStart());
  return `${node.getSourceFile().fileName}:${line + 1}:${character + 1}`;
}

/**
 * List of default write methods for a Sequelize model
 * Based on https://sequelize.org/api/v6/class/src/model.js~model
 */
export const SequelizeDefaultWriteMethodsRecord: Record<
  string,
  SequelizeWriteOperationType[]
> = {
  build: [SequelizeWriteOperationType.INSERT],
  bulkCreate: [SequelizeWriteOperationType.INSERT],
  create: [SequelizeWriteOperationType.INSERT],
  findCreateFind: [SequelizeWriteOperationType.INSERT],
  findOrBuild: [SequelizeWriteOperationType.INSERT],
  findOrCreate: [SequelizeWriteOperationType.INSERT],
  bulkUpdate: [SequelizeWriteOperationType.UPDATE],
  decrement: [SequelizeWriteOperationType.UPDATE],
  increment: [SequelizeWriteOperationType.UPDATE],
  restore: [SequelizeWriteOperationType.UPDATE],
  save: [SequelizeWriteOperationType.UPDATE],
  set: [SequelizeWriteOperationType.UPDATE],
  update: [SequelizeWriteOperationType.UPDATE],
  upsert: [
    SequelizeWriteOperationType.INSERT,
    SequelizeWriteOperationType.UPDATE,
  ],
  destroy: [SequelizeWriteOperationType.DELETE],
};

/**
 * Function that checks if a method is a Sequelize model write method
 * Feel free to override/extend this function to add more operations or make a PR to add them to the library
 * @param {string} method method name to check if it is a Sequelize model write method
 * @returns {boolean} True if the method is a Sequelize model write method, false otherwise
 */
export function isSequelizeModelWriteMethod(
  method: string
): method is keyof typeof SequelizeDefaultWriteMethodsRecord {
  return (
    Object.keys(SequelizeDefaultWriteMethodsRecord).includes(method) ||
    isSequelizeTypescriptGeneratedWriteMethod(method)
  );
}

/**
 * Sequelize Typescript generated methods
 * https://github.com/sequelize/sequelize-typescript?tab=readme-ov-file#type-safe-usage-of-auto-generated-functions
 */
export const SequelizeTypescriptGeneratedWriteMixins = [
  "$add",
  "$create",
  "$set",
  "$remove",
];

export type SequelizeTypescriptGeneratedWriteMethod =
  (typeof SequelizeTypescriptGeneratedWriteMixins)[number];

/**
 * Function that checks if a method is a Sequelize-Typescript model write method
 * @param {string} method method name to check if it is a Sequelize-Typescript model write method
 * @returns {boolean} True if the method is a Sequelize-Typescript model write method, false otherwise
 */
export function isSequelizeTypescriptGeneratedWriteMethod(
  method: string
): method is SequelizeTypescriptGeneratedWriteMethod {
  return SequelizeTypescriptGeneratedWriteMixins.includes(method);
}

/**
 * Function that checks if an unknown type is a Sequelize model class
 * @param {unknown} model Possible reference to a Sequelize model class
 * @returns {boolean} True if the unknown type is a Sequelize model class, false otherwise
 */
export function isSequelizeModel<M extends Model>(
  model: unknown
): model is ModelStatic<M> {
  return typeof model === "function" && model.prototype instanceof Model;
}

/**
 * Extract the model name from a Sequelize model class
 * @param {ModelType | string | ThroughOptions} throughModel model reference from BelongsToManyOptions association
 * @returns {string | undefined} Model name extracted from the through model
 */
export function getSequelizeModelNameFromThroughModel(
  throughModel: ModelType | string | ThroughOptions
): string | undefined {
  if (typeof throughModel === "string") return throughModel;

  if (isSequelizeModel(throughModel)) return throughModel.name;

  if (typeof throughModel === "object" && throughModel.model) {
    if (typeof throughModel.model === "string") return throughModel.model;

    if (isSequelizeModel(throughModel.model)) return throughModel.model.name;
  }
  console.error(`Invalid through model: ${throughModel}`);
  return undefined;
}
