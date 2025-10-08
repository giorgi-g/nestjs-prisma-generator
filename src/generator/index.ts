import path from 'node:path';
import { camel, kebab, pascal, snake } from 'case';
import { DMMF } from '@prisma/generator-helper';
import { logger } from '../utils';
import { makeHelpers } from './template-helpers';
import { computeModelParams } from './compute-model-params';
import { computeTypeParams } from './compute-type-params';
import { generateConnectDto } from './generate-connect-dto';
import { generateCreateDto } from './generate-create-dto';
import { generateUpdateDto } from './generate-update-dto';
import { generateEntity } from './generate-entity';
import { generatePlainDto } from './generate-plain-dto';
import { generateEnums as genEnum } from './generate-enums';
import { DTO_IGNORE_MODEL } from './annotations';
import { isAnnotatedWith } from './field-classifiers';
import { Model, NamingStyle, WriteableFileSpecs } from './types';
import { generatePagination } from './generate-pagination';
import { generateInput } from './generate-input';

interface RunParam {
  output: string;
  dmmf: DMMF.Document;
  exportRelationModifierClasses: boolean;
  outputToNestJsResourceStructure: boolean;
  flatResourceStructure: boolean;
  connectDtoPrefix: string;
  createDtoPrefix: string;
  updateDtoPrefix: string;
  dtoSuffix: string;
  entityPrefix: string;
  entitySuffix: string;
  fileNamingStyle: NamingStyle;
  classValidation: boolean;
  outputType: string;
  noDependencies: boolean;
  generateEnums: boolean;
  definiteAssignmentAssertion: boolean;
  requiredResponseApiProperty: boolean;
  prismaClientImportPath: string;
  outputApiPropertyType: boolean;
  generateFileTypes: string;
  wrapRelationsAsType: boolean;
  showDefaultValues: boolean;
  addGraphqlTypes: boolean;
  isMongoDb: boolean;
}

export const run = ({
  output,
  dmmf,
  isMongoDb,
  ...options
}: RunParam): WriteableFileSpecs[] => {
  const {
    exportRelationModifierClasses,
    outputToNestJsResourceStructure,
    flatResourceStructure,
    fileNamingStyle = 'camel',
    classValidation,
    outputType,
    noDependencies,
    generateEnums,
    definiteAssignmentAssertion,
    requiredResponseApiProperty,
    prismaClientImportPath,
    outputApiPropertyType,
    generateFileTypes,
    wrapRelationsAsType,
    showDefaultValues,
    ...preAndSuffixes
  } = options;

  const transformers: Record<NamingStyle, (str: string) => string> = {
    camel,
    kebab,
    pascal,
    snake,
  };

  const transformFileNameCase = transformers[fileNamingStyle];

  const templateHelpers = makeHelpers({
    transformFileNameCase,
    transformClassNameCase: pascal,
    classValidation,
    outputType,
    noDependencies,
    generateEnums,
    definiteAssignmentAssertion,
    outputPath: output,
    prismaClientImportPath,
    requiredResponseApiProperty,
    outputApiPropertyType,
    wrapRelationsAsType,
    showDefaultValues,
    ...preAndSuffixes,
  });
  const allModels = dmmf.datamodel.models;

  const filteredTypes: Model[] = dmmf.datamodel.types
    .filter((model) => !isAnnotatedWith(model, DTO_IGNORE_MODEL))
    .map((model: DMMF.Model) => ({
      ...model,
      output: {
        dto: outputToNestJsResourceStructure
          ? flatResourceStructure
            ? path.join(output, transformFileNameCase(model.name))
            : path.join(output, transformFileNameCase(model.name), 'dto')
          : output,
        entity: '',
        input: '',
        isMongoDb,
      },
    }));

  if (generateFileTypes === 'entity' && filteredTypes.length) {
    throw new Error(
      `Generating only Entity files while having complex types is not possible. Set 'generateFileTypes' to 'all' or 'dto'.`,
    );
  }

  const filteredModels: Model[] = allModels
    .filter((model) => !isAnnotatedWith(model, DTO_IGNORE_MODEL))
    // adds `output` information for each model, so we can compute relative import paths
    // this assumes that NestJS resource modules (more specifically their folders on disk) are named as `transformFileNameCase(model.name)`
    .map((model) => ({
      ...model,
      type: 'model',
      output: {
        dto: outputToNestJsResourceStructure
          ? flatResourceStructure
            ? path.join(output, transformFileNameCase(model.name))
            : path.join(output, transformFileNameCase(model.name), 'dto')
          : output,
        input: outputToNestJsResourceStructure
          ? flatResourceStructure
            ? path.join(output, transformFileNameCase(model.name))
            : path.join(output, transformFileNameCase(model.name), 'input')
          : output,
        entity: outputToNestJsResourceStructure
          ? flatResourceStructure
            ? path.join(output, transformFileNameCase(model.name))
            : path.join(output, transformFileNameCase(model.name), 'entities')
          : output,
        isMongoDb,
      },
    }));

  const enumFiles: WriteableFileSpecs[] = [];
  if (noDependencies || generateEnums) {
    if (dmmf.datamodel.enums.length) {
      logger('Processing enums');
      enumFiles.push({
        fileName: path.join(output, 'enums.ts'),
        content: genEnum(dmmf.datamodel.enums, prismaClientImportPath),
      });
    }
  }

  const paginationFiles: WriteableFileSpecs[] = [];
  if (noDependencies || generateEnums) {
    if (dmmf.datamodel.models.length) {
      logger('Processing pagination');
      paginationFiles.push({
        fileName: path.join(output, 'pagination.ts'),
        content: generatePagination(),
      });
    }
  }

  const typeFiles = filteredTypes.map((model) => {
    logger(`Processing Type ${model.name}`);

    const typeParams = computeTypeParams({
      model,
      allModels: filteredTypes,
      templateHelpers,
    });

    // generate create-model.dto.ts
    const createDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.createDtoFilename(model.name, true),
      ),
      content: generateCreateDto({
        ...typeParams.create,
        exportRelationModifierClasses,
        templateHelpers,
      }),
    };

    // generate update-model.dto.ts
    const updateDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.updateDtoFilename(model.name, true),
      ),
      content: generateUpdateDto({
        ...typeParams.update,
        exportRelationModifierClasses,
        templateHelpers,
      }),
    };

    // generate model.dto.ts
    const plainDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.plainDtoFilename(model.name, true),
      ),
      content: generatePlainDto({
        ...typeParams.plain,
        templateHelpers,
      }),
    };

    // generate model.input.ts
    const inputPath =
      model.output.input != null && model.output.input !== ''
        ? model.output.input
        : model.output.dto;
    const inputDto = {
      fileName: path.join(
        inputPath,
        templateHelpers.inputFilename(model.name, true),
      ),
      content: generateInput({
        ...typeParams.input,
        templateHelpers,
      }),
    };

    return [createDto, updateDto, plainDto, inputDto];
  });

  const modelFiles = filteredModels.map((model) => {
    logger(`Processing Model ${model.name}`);

    const modelParams = computeModelParams({
      model,
      allModels: [...filteredTypes, ...filteredModels],
      templateHelpers,
    });

    // generate connect-model.dto.ts
    const connectDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.connectDtoFilename(model.name, true),
      ),
      content: generateConnectDto({
        ...modelParams.connect,
        exportRelationModifierClasses,
        templateHelpers,
      }),
    };

    // generate create-model.dto.ts
    const createDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.createDtoFilename(model.name, true),
      ),
      content: generateCreateDto({
        ...modelParams.create,
        exportRelationModifierClasses,
        templateHelpers,
      }),
    };
    // TODO generate create-model.struct.ts

    // generate update-model.dto.ts
    const updateDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.updateDtoFilename(model.name, true),
      ),
      content: generateUpdateDto({
        ...modelParams.update,
        exportRelationModifierClasses,
        templateHelpers,
      }),
    };
    // TODO generate update-model.struct.ts

    const entityPath =
      model.output.entity != null && model.output.entity !== ''
        ? model.output.entity
        : model.output.dto;
    // generate model.entity.ts
    const entity = {
      fileName: path.join(
        entityPath,
        templateHelpers.entityFilename(model.name, true),
      ),
      content: generateEntity({
        ...modelParams.entity,
        templateHelpers,
      }),
    };

    // TODO generate model.struct.ts

    // generate model.dto.ts
    const plainDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.plainDtoFilename(model.name, true),
      ),
      content: generatePlainDto({
        ...modelParams.plain,
        templateHelpers,
      }),
    };

    const inputPath =
      model.output.input != null && model.output.input !== ''
        ? model.output.input
        : model.output.dto;

    // generate model.input.ts
    const inputDto = {
      fileName: path.join(
        inputPath,
        templateHelpers.inputFilename(model.name, true),
      ),
      content: generateInput({
        ...modelParams.input,
        templateHelpers,
      }),
    };

    switch (generateFileTypes) {
      case 'all':
        return [connectDto, createDto, updateDto, entity, plainDto, inputDto];
      case 'dto':
        return [connectDto, createDto, updateDto, plainDto, inputDto];
      case 'entity':
        return [entity];
      default:
        throw new Error(`Unknown 'generateFileTypes' value.`);
    }
  });

  return [...paginationFiles, ...typeFiles, ...modelFiles, ...enumFiles].flat();
};
