import {
  BelongsToMany,
  BelongsToManyOptions,
  Model,
  ModelStatic,
} from "sequelize";
import ts from "typescript";
import {
  getNodeLocationString,
  getSequelizeModelNameFromThroughModel,
  getSequelizeModelTableName,
  isSequelizeModel,
  isSequelizeModelWriteMethod,
  isSequelizeTypescriptGeneratedWriteMethod,
  SequelizeDefaultWriteMethodsRecord,
  SequelizeTypescriptGeneratedWriteMethod,
} from "./helpers";
import {
  SequelizeFoundModelsRecord,
  SequelizeParserAvailableModelsRecord,
  SequelizeParserOptions,
  SequelizeWriteOperationType,
} from "./types/parser.dto";

/**
 * Main function that parses the source code and returns all the models found in the source code with their respective operations
 * @param {string} basePath Path where the source code is located. Usually the root of the project
 * @param {SequelizeParserOptions} options Some config options to customize the parser
 * @returns {SequelizeFoundModelsRecord} Object containing all the models found in the source code with their respective operations
 */
export function getModelsFromSourceFiles(
  basePath: string,
  availableModels: SequelizeParserAvailableModelsRecord,
  options: SequelizeParserOptions = {}
): SequelizeFoundModelsRecord {
  const parser = new SequelizeParser(basePath, availableModels, options);
  parser.visitAllSourceFiles();
  return parser.foundModels;
}

export class SequelizeParser {
  public foundModels: SequelizeFoundModelsRecord = {};
  private program: ts.Program;
  private checker: ts.TypeChecker;
  /**
   * Constructor for the SequelizeParser class
   * @param {string} basePath Considered the root of the project where the source code is located and the `tsconfig.json` file is located
   * @param {SequelizeParserAvailableModelsRecord} availableModels Record of available models. Key is the model name, value is the model class. Usually, you would pass `sequelize.models` to this
   * @param {SequelizeParserOptions} options Some config options to customize the parser
   */
  constructor(
    basePath: string,
    private availableModels: SequelizeParserAvailableModelsRecord,
    private options: SequelizeParserOptions = {}
  ) {
    this.program = this.loadProjectConfig(
      basePath,
      options.tsConfigName ?? "tsconfig.json"
    );
    this.checker = this.program.getTypeChecker();
  }

  /**
   * Load the project configuration from the `tsconfig` file
   * @param {string} basePath Path where the source code is located. Usually the root of the project
   * @param {string} tsConfigName Name or location of the `tsconfig.json` file
   * @returns {ts.Program} The TypeScript program used to parse the source code
   */
  public loadProjectConfig(basePath: string, tsConfigName: string) {
    const configPath = ts.findConfigFile(
      basePath,
      ts.sys.fileExists,
      tsConfigName
    );
    if (!configPath)
      throw new Error(`Could not find a valid '${tsConfigName}'.`);

    const configFile = ts.readJsonConfigFile(configPath, ts.sys.readFile);
    const { fileNames, options } = ts.parseJsonSourceFileConfigFileContent(
      configFile,
      ts.sys,
      basePath
    );
    const program = ts.createProgram(fileNames, options);
    return program;
  }

  /**
   * Function that visits all source files in the project and applies the node visitor to each node
   */
  public visitAllSourceFiles() {
    this.program.getSourceFiles().forEach((sourceFile) => {
      if (sourceFile.isDeclarationFile) return;
      // We are only interested in the source files as no database operations should performed in declaration files
      this.nodeVisitor(sourceFile);
    });

    // Once all the models are found, we can add hidden many-to-many models
    this.addHiddenManyToManyModels();
  }

  /**
   * Functions that visits all nodes in the AST and applies specific logic to nodes where models might be used
   * @param {ts.Node} node AST node currently being visited
   */
  public nodeVisitor(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      // Sample import declaration: import { UserModel } from "sequelize";
      this.processImportDeclarationNode(node);
      return; // No need to visit children of an import declaration
    }
    if (ts.isCallExpression(node)) {
      this.findAllWriteOperations(node);
      // A call expression might have additional references to models, in the arguments for example (entity.build({ reference: UserModel.build() }))
    }
    // Visit recursively all children of the current node
    ts.forEachChild(node, (node) => this.nodeVisitor(node));
  }

  /**
   * Function that will check if the import is a sequelize model we are interested in
   * If so, it will add the model to the found models record
   * @param {ts.ImportDeclaration} node Import declaration node
   */
  public processImportDeclarationNode(node: ts.ImportDeclaration) {
    // If a specific module is specified, only process imports from that module
    if (
      this.options.onlyFromSpecificModuleImport !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const from: string = node.moduleSpecifier.text;

      if (from != this.options.onlyFromSpecificModuleImport) return;
    }

    const namedImports: ts.NodeArray<ts.ImportSpecifier> | undefined[] =
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause?.namedBindings)
        ? node.importClause?.namedBindings?.elements
        : [];

    namedImports
      .filter((i) => i) // Remove undefined elements
      .forEach(({ name, propertyName }) => {
        // The value should be either a model class or undefined
        const model: unknown | undefined =
          this.availableModels[
            propertyName?.escapedText?.toString() ?? name.escapedText.toString()
          ];

        // Just in case we make sure it's a sequelize model
        if (!model || !isSequelizeModel(model)) return;

        // If the model is already found, no need to add it again
        if (this.foundModels[name.getText()]) return;

        // Add the model to the found models record with SELECT operation by default
        this.foundModels[name.getText()] = {
          table: getSequelizeModelTableName(model),
          isSelect: true,
          isInsert: false,
          isUpdate: false,
          isDelete: false,
        };
      });
  }

  /**
   * Function that checks if a call expression node is a Sequelize model write operation like Model.update, entity.destroy, ...
   * @param {ts.CallExpression} node Call expression node to check if it relates to a Sequelize model, if so which one and what operation
   * @returns {boolean} True if the node refers to a Sequelize model and a write operation, false otherwise. Used to stop further processing of the node's tree
   */
  public findAllWriteOperations(node: ts.CallExpression): boolean {
    if (!node.expression.getSourceFile() || !node.expression.getFirstToken())
      return false;

    // We expect something of the form: entity.create(), entity.update(), entity.destroy(), Model.create(), Model.update(), Model.destroy(), ....
    // We need to have at least 3 tokens to have a model reference and a method (MODEL, DOT, METHOD)
    if (node.expression.getChildCount() < 3) return false;

    const secondNode = node.expression.getChildAt(2);
    if (!secondNode) return false;
    const method = secondNode.getText();
    // Check if the method is a Sequelize model write method before trying to guess the type
    if (
      !method ||
      !ts.isIdentifier(secondNode) ||
      !isSequelizeModelWriteMethod(method)
    )
      return false;

    const firstNode = node.expression.getFirstToken();
    // Get the sequelize model from the node
    const model = this.findModelFromNode(firstNode);
    if (!model) return false;
    this.updateModelFlagBasedOnMethod(model, method);

    this.updateSequelizeGeneratedAssociationTargetFlag(
      model,
      method,
      node.arguments
    );

    return true;
  }

  /**
   * Function that tries to find a model from a node
   * @param {ts.Node} node Node to check if it is a model class reference or a variable that might be a model instance
   * @returns {SequelizeParserFoundModel | undefined} The model found or undefined if no model was found
   */
  public findModelFromNode(node: ts.Node): ModelStatic<Model> | undefined {
    // Check if the node is a model, like Model.create(), Model.update(), Model.destroy(), ....
    let model = this.availableModels[node.getText()];
    if (model) return model;

    // Check if the node is a variable that might be a model, like entity.create(), entity.update(), entity.destroy(), ....
    // If not, then it might not be a sequelize operation
    if (!ts.isIdentifier(node)) return undefined;

    const typeOfVariable = this.checker.getTypeAtLocation(node);

    // Check if the identifier is a direct instance of Model
    model = this.availableModels[typeOfVariable.getSymbol()?.getName()];
    if (model) return model;

    // entity might be an indirect instance of Model
    // Let's check the declarations of the variable's type
    typeOfVariable
      .getSymbol()
      ?.getDeclarations()
      ?.forEach((declaration) => {
        // interface extends Omit<Model>
        if (ts.isInterfaceDeclaration(declaration)) {
          declaration.heritageClauses?.forEach((h) =>
            h.types.forEach((t) =>
              t.typeArguments.forEach((a) => {
                if (!model) model = this.availableModels[a.getText()];
              })
            )
          );
        }
        // type = Omit<Model>
        else if (ts.isMappedTypeNode(declaration)) {
          // No clue how to handle this
          console.warn(
            node.getText(),
            "Using 'MappedType', can't determine model",
            `at ${getNodeLocationString(node)}`
          );
        }
        // class extends Model, class extends OmitType(Model), class extends PickType(Model)
        else if (ts.isClassDeclaration(declaration)) {
          declaration.heritageClauses?.forEach((m) =>
            m.types.forEach((t) => {
              const expr = t.expression;
              if (ts.isCallExpression(expr)) {
                // class extends OmitType(Model), class extends PickType(Model)
                // Those come from the `@nestjs/swagger` package and might be used to serialize a model instance
                expr.arguments.forEach((arg) => {
                  if (!model) model = this.availableModels[arg.getText()];
                });
              } else if (ts.isIdentifier(expr)) {
                // class extends Model
                if (!model) model = this.availableModels[expr.getText()];
              }
            })
          );
        }
      });
    if (model) return model;
    console.error(
      "Could not find model for",
      `\`${node.getText()}\``,
      `(type: ${this.checker.typeToString(typeOfVariable)})`,
      `at ${getNodeLocationString(node)}`
    );
    return undefined;
  }

  /**
   * Function that updates the flags of a model based on the method used
   * Feel free to override/extend this function to add more operations or make a PR to add them to the library
   * @param {SequelizeParserFoundModel} model found model instance to update
   * @param {string} method method name to determine the operation
   */
  public updateModelFlagBasedOnMethod(
    model: ModelStatic<Model>,
    method: string
  ) {
    // Restrict the method to only Sequelize generated write methods. Sequelize-Typescript generated write methods are handled separately
    if (isSequelizeTypescriptGeneratedWriteMethod(method)) return;

    const operations = SequelizeDefaultWriteMethodsRecord[method];
    if (!operations) {
      console.warn(
        `Method ${method} is not a default write method for a Sequelize model`
      );
      return;
    }

    const modelOperations = this.foundModels[model.name];
    if (!modelOperations) {
      this.foundModels[model.name] = {
        table: getSequelizeModelTableName(model),
        isSelect: true,
        isInsert: false,
        isUpdate: false,
        isDelete: false,
      };
    }

    operations.forEach((op) => {
      switch (op) {
        case SequelizeWriteOperationType.INSERT:
          modelOperations.isInsert = true;
          break;
        case SequelizeWriteOperationType.UPDATE:
          modelOperations.isUpdate = true;
          break;
        case SequelizeWriteOperationType.DELETE:
          modelOperations.isDelete = true;
          break;
      }
    });
  }

  /**
   * Sequelize-Typescript specific code
   * Here we handle operations like entity.$add(), entity.$create(), entity.$set(), entity.$remove()
   * @param {ModelStatic<Model>} model Source model from which the association is being called
   * @param {SequelizeTypescriptGeneratedWriteMethod} method Method name to determine the operation
   * @param {ts.NodeArray<ts.Expression>} args Arguments of the method
   */
  public updateSequelizeGeneratedAssociationTargetFlag(
    model: ModelStatic<Model>,
    method: SequelizeTypescriptGeneratedWriteMethod,
    args: ts.NodeArray<ts.Expression>
  ) {
    // Restrict the method to only Sequelize-Typescript generated write methods
    if (!isSequelizeTypescriptGeneratedWriteMethod(method)) return;

    // The sequelize-typescript-generated write methods look like this: entity.$method(associationName, values, options?)
    if (args.length < 2) return;

    // First argument is the association name
    const associationNameArg = args[0];
    // For now we only support string literals as association names
    if (!ts.isStringLiteral(associationNameArg)) {
      console.warn(
        `Association name is not a string literal in ${
          model.name
        }.${method}: ${associationNameArg.getText()}`
      );
      return;
    }

    const association = model.associations[associationNameArg.text];
    if (!association) {
      console.warn(
        `Association ${associationNameArg.text} not found in model ${model.name}`
      );
      return;
    }

    let targetModelOperations = this.foundModels[association.target.name];
    if (!targetModelOperations) {
      this.foundModels[association.target.name] = {
        table: getSequelizeModelTableName(association.target),
        isSelect: true,
        isInsert: false,
        isUpdate: false,
        isDelete: false,
      };
      targetModelOperations = this.foundModels[association.target.name];
    }

    let throughModelOperations = undefined;
    if (association instanceof BelongsToMany) {
      // Sequelize types are missing the `options` property in the association
      const options = (association as any).options as BelongsToManyOptions;

      const throughModel =
        this.availableModels[
          getSequelizeModelNameFromThroughModel(options.through)
        ];

      if (throughModel) {
        throughModelOperations = this.foundModels[throughModel.name];
        if (!throughModelOperations) {
          this.foundModels[throughModel.name] = {
            table: getSequelizeModelTableName(throughModel),
            isSelect: true,
            isInsert: false,
            isUpdate: false,
            isDelete: false,
          };
          throughModelOperations = this.foundModels[throughModel.name];
        }
      } else
        console.warn(
          `Could not find through model for association ${associationNameArg.text} in model ${model.name}`
        );
    }

    // Most of the time those operations are using on Many-to-Many associations and so the through model is the one impacted
    switch (method) {
      case "$add":
        if (throughModelOperations) throughModelOperations.isInsert = true;
        else targetModelOperations.isUpdate = true;
        break;
      case "$create":
        targetModelOperations.isInsert = true;
        if (throughModelOperations) throughModelOperations.isInsert = true;
        break;
      case "$set":
        if (throughModelOperations) {
          throughModelOperations.isInsert = true;
          throughModelOperations.isUpdate = true;
          throughModelOperations.isDelete = true;
        } else targetModelOperations.isUpdate = true;
        break;
      case "$remove":
        if (throughModelOperations) throughModelOperations.isDelete = true;
        else targetModelOperations.isUpdate = true;
        break;
      default:
        console.error(
          `Method ${method} is not a Sequelize-Typescript generated write method`
        );
        break;
    }
  }

  /**
   * Function that adds hidden many-to-many models to the found models record
   * For example if you have Many-to-Many relation between User and Role, the hidden model would be UserRole
   * UserRole wouldn't be directly used in the code (thank you Sequelize) but it's used in the background so it should be added to the found models record
   */
  public addHiddenManyToManyModels() {
    // Loop through all the found models
    Object.keys(this.foundModels).forEach((modelName) => {
      const model = this.availableModels[modelName];

      // Loop through all the associations of the model
      Object.values(model.associations).forEach((association) => {
        // Only BelongsToMany associations have hidden many-to-many models
        if (!(association instanceof BelongsToMany)) return;

        // Sequelize types are missing the `options` property in the association
        const options = (association as any).options as BelongsToManyOptions;

        const throughModel = getSequelizeModelNameFromThroughModel(
          options.through
        );
        if (!throughModel) return;

        // Add the through model only if the target is used at some point in the code
        const targetModelOperations = this.foundModels[association.target.name];
        if (!targetModelOperations) return;

        if (!this.foundModels[throughModel]) {
          this.foundModels[throughModel] = {
            table: getSequelizeModelTableName(
              this.availableModels[throughModel]
            ),
            isSelect: true,
            isInsert: targetModelOperations.isInsert,
            isUpdate: targetModelOperations.isUpdate,
            isDelete: targetModelOperations.isDelete,
          };
        } else {
          if (targetModelOperations.isInsert)
            this.foundModels[throughModel].isInsert = true;
          if (targetModelOperations.isUpdate)
            this.foundModels[throughModel].isUpdate = true;
          if (targetModelOperations.isDelete)
            this.foundModels[throughModel].isDelete = true;
        }
      });
    });
  }
}
