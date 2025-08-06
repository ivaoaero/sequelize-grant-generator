import path from "path";
import fs from "fs";
import { SequelizeFoundModelsRecord } from "./types/parser.dto";

/**
 * Saves the found Sequelize models to a file.
 * @param {SequelizeFoundModelsRecord} foundModels The found Sequelize models.
 * @param {string} filePath The path to the file where the models should be saved.
 */
export function saveModelsToFile(foundModels: SequelizeFoundModelsRecord, filePath: string): void {
  // Ensure the directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Convert found models to a JSON string
  const data = JSON.stringify(foundModels, null, 2);

  // Write the data to the specified file
  fs.writeFileSync(filePath, data, "utf8");
}

/**
 * Reads Sequelize models from a file.
 * @param {string} filePath The path to the file from which the models should be read.
 * @returns {SequelizeFoundModelsRecord} The found Sequelize models.
 * @throws {Error} If the file does not exist or cannot be read.
 */
export function readModelsFromFile(filePath: string): SequelizeFoundModelsRecord {
  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read the file contents
  const data = fs.readFileSync(filePath, "utf8");

  // Parse the JSON data
  return JSON.parse(data) as SequelizeFoundModelsRecord;    
}

/**
 * Reads Sequelize models from a module path.
 * @param {string} modulePath The path to the module from which the models should be read.
 * @returns {SequelizeFoundModelsRecord} The found Sequelize models.
 * @throws {Error} If the module cannot be resolved or the models cannot be read.
 */
export function readModelsFromModulePath(modulePath: string): SequelizeFoundModelsRecord {
  // Construct the file path for the module
  const filePath = require.resolve(modulePath);

  // Read the models from the file
  return readModelsFromFile(filePath);
}
