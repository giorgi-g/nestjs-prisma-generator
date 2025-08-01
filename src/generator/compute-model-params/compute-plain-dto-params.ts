import { slash } from '../../utils';
import path from 'node:path';
import {
  DTO_API_HIDDEN,
  DTO_CAST_TYPE,
  DTO_ENTITY_HIDDEN,
  DTO_EXCLUDE_PLAIN_ONLY,
  DTO_OVERRIDE_API_PROPERTY_TYPE,
  DTO_OVERRIDE_TYPE,
  DTO_RELATION_INCLUDE_ID,
} from '../annotations';
import { isAnnotatedWith, isRelation, isType } from '../field-classifiers';
import {
  concatUniqueIntoArray,
  getRelationScalars,
  getRelativePath,
  makeCustomImports,
  makeImportsFromPrismaClient,
  mapDMMFToParsedField,
  zipImportStatementParams,
} from '../helpers';

import type { DMMF } from '@prisma/generator-helper';
import type { TemplateHelpers } from '../template-helpers';
import type {
  IClassValidator,
  IDecorators,
  ImportStatementParams,
  Model,
  ParsedField,
  PlainDtoParams,
} from '../types';
import {
  makeImportsFromNestjsSwagger,
  parseApiProperty,
} from '../api-decorator';
import {
  makeImportsFromClassValidator,
  parseClassValidators,
} from '../class-validator';

interface ComputePlainDtoParamsParam {
  model: Model;
  allModels: Model[];
  templateHelpers: TemplateHelpers;
}

export const computePlainDtoParams = ({
  model,
  allModels,
  templateHelpers,
}: ComputePlainDtoParamsParam): PlainDtoParams => {
  const imports: ImportStatementParams[] = [];
  const classValidators: IClassValidator[] = [];
  const apiExtraModels: string[] = [];

  const relationScalarFields = getRelationScalars(model.fields);
  const relationScalarFieldNames = Object.keys(relationScalarFields);

  const fields = model.fields.reduce((result, field) => {
    const { name } = field;
    const overrides: Partial<DMMF.Field> = {
      isRequired: true,
      isNullable: !field.isRequired,
    };
    const decorators: IDecorators = {};

    if (isAnnotatedWith(field, DTO_ENTITY_HIDDEN)) return result;

    if (isRelation(field)) return result;
    if (
      !isAnnotatedWith(field, DTO_RELATION_INCLUDE_ID) &&
      relationScalarFieldNames.includes(name)
    )
      return result;

    if (isType(field)) {
      // don't try to import the class we're preparing params for
      if (
        field.type !== model.name &&
        !(
          (isAnnotatedWith(field, DTO_OVERRIDE_TYPE) ||
            isAnnotatedWith(field, DTO_CAST_TYPE)) &&
          isAnnotatedWith(field, DTO_OVERRIDE_API_PROPERTY_TYPE)
        )
      ) {
        const modelToImportFrom = allModels.find(
          ({ name }) => name === field.type,
        );

        if (!modelToImportFrom)
          throw new Error(
            `related type '${field.type}' for '${model.name}.${field.name}' not found`,
          );

        const importName = templateHelpers.plainDtoName(field.type);
        const importFrom = slash(
          `${getRelativePath(model.output.dto, modelToImportFrom.output.dto)}${
            path.sep
          }${templateHelpers.plainDtoFilename(field.type)}`,
        );

        imports.push({
          destruct: [
            importName,
            ...(templateHelpers.config.wrapRelationsAsType
              ? [`type ${importName} as ${importName}AsType`]
              : []),
          ],
          from: importFrom,
        });
      }
    }

    if (templateHelpers.config.classValidation) {
      if (isAnnotatedWith(field, DTO_EXCLUDE_PLAIN_ONLY)) {
        overrides.documentation = (
          overrides.documentation ?? field.documentation
        )?.replace(DTO_EXCLUDE_PLAIN_ONLY, '@Exclude({ toPlainOnly: true })');
      }

      decorators.classValidators = parseClassValidators(
        {
          ...field,
          ...overrides,
        },
        overrides.type || templateHelpers.createDtoName,
      );
      concatUniqueIntoArray(
        decorators.classValidators,
        classValidators,
        'name',
      );
    }

    if (!templateHelpers.config.noDependencies) {
      if (
        isAnnotatedWith(field, DTO_API_HIDDEN) ||
        isAnnotatedWith(field, DTO_EXCLUDE_PLAIN_ONLY)
      ) {
        decorators.apiHideProperty = true;
        decorators.apiExcludeProperty = true;
      } else {
        const { apiProperties, gqlProperties } = parseApiProperty(
          {
            ...field,
            isRequired: templateHelpers.config.requiredResponseApiProperty
              ? !!overrides.isRequired
              : false,
            isNullable: !field.isRequired,
          },
          {
            default: false,
            type: templateHelpers.config.outputApiPropertyType,
          },
        );
        decorators.apiProperties = apiProperties;
        decorators.gqlProperties = gqlProperties;
        const typeProperty = decorators.apiProperties.find(
          (p) => p.name === 'type',
        );
        if (typeProperty?.value === field.type)
          typeProperty.value =
            '() => ' +
            (field.type === 'Json'
              ? 'Object'
              : templateHelpers.plainDtoName(typeProperty.value));
      }
    }

    if (templateHelpers.config.noDependencies) {
      if (field.type === 'Json') field.type = 'Object';
      else if (field.type === 'Decimal') field.type = 'Number';
      // else if (field.type === 'Decimal') field.type = 'String';

      if (field.kind === 'enum') {
        imports.push({
          from: slash(
            `${getRelativePath(
              model.output.entity,
              templateHelpers.config.outputPath,
            )}${path.sep}enums`,
          ),
          destruct: [field.type],
        });
      }
    }

    return [...result, mapDMMFToParsedField(field, overrides, decorators)];
  }, [] as ParsedField[]);

  const importPrismaClient = makeImportsFromPrismaClient(
    fields,
    templateHelpers.config.prismaClientImportPath,
    !templateHelpers.config.noDependencies,
  );
  const importNestjsSwagger = makeImportsFromNestjsSwagger(
    fields,
    apiExtraModels,
  );
  const importClassValidator = makeImportsFromClassValidator(classValidators);
  const customImports = makeCustomImports(fields);

  return {
    model,
    fields,
    imports: zipImportStatementParams([
      ...importPrismaClient,
      ...importNestjsSwagger,
      ...importClassValidator,
      ...customImports,
      ...imports,
    ]),
    apiExtraModels,
  };
};
