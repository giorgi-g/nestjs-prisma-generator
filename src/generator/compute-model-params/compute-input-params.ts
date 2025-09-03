import {
  DTO_INPUT_HIDDEN,
  DTO_INPUT_OPTIONAL,
  DTO_INPUT_REQUIRED,
  DTO_INPUT_VALIDATE_IF,
} from '../annotations';
import {
  isAnnotatedWith,
  isIdWithDefaultValue,
  isReadOnly,
  isRequiredWithDefaultValue,
  isUpdatedAt,
} from '../field-classifiers';
import {
  concatUniqueIntoArray,
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
  InputParams,
  Model,
  ParsedField,
} from '../types';
import {
  makeImportsFromNestjsSwagger,
  parseApiProperty,
} from '../api-decorator';
import {
  makeImportsFromClassValidator,
  parseClassValidators,
} from '../class-validator';
import { ClassType } from '../../enums';

interface ComputeInputParamsParam {
  model: Model;
  templateHelpers: TemplateHelpers;
}

export const computeInputParams = ({
  model,
  templateHelpers,
}: ComputeInputParamsParam): InputParams => {
  const imports: ImportStatementParams[] = [];
  const apiExtraModels: string[] = [];
  const extraClasses: string[] = [];
  const classValidators: IClassValidator[] = [];

  const primitiveFields = model.fields
    .filter((x) => ['enum', 'scalar'].includes(x.kind))
    .filter((x) => x.type !== 'Json')
    .filter(
      (x) => !['size', 'page', 'totalItems', 'totalPages'].includes(x.name),
    )
    .map((x) => ({
      ...x,
      isRequired: false,
      hasDefaultValue: false,
    }));

  const allFields = [
    ...primitiveFields,
    ...primitiveFields
      .filter((x) => !['DateTime'].includes(x.type))
      .map((x) => ({
        ...x,
        name: `${x.name}List`,
        isList: true,
      })),
  ];

  const fields = allFields.reduce((result, field) => {
    const overrides: Partial<DMMF.Field> = {};
    const decorators: IDecorators = {};

    if (isReadOnly(field)) return result;
    if (isAnnotatedWith(field, DTO_INPUT_HIDDEN)) return result;

    // fields annotated with @DtoReadOnly are filtered out before this
    // so this safely allows to mark fields that are required in Prisma Schema
    // as **not** required in CreateDTO
    const isDtoOptional = isAnnotatedWith(field, DTO_INPUT_OPTIONAL);

    if (!isDtoOptional) {
      if (isIdWithDefaultValue(field)) return result;
      if (isUpdatedAt(field)) return result;

      if (isRequiredWithDefaultValue(field) && field.kind !== 'enum') {
        if (templateHelpers.config.showDefaultValues)
          overrides.isRequired = false;
        else return result;
      }
    }

    if (isDtoOptional) {
      overrides.isRequired = false;
    }

    if (isAnnotatedWith(field, DTO_INPUT_REQUIRED)) {
      overrides.isRequired = true;
    }

    overrides.isNullable = !(field.isRequired || overrides.isRequired);

    if (templateHelpers.config.classValidation) {
      if (isAnnotatedWith(field, DTO_INPUT_VALIDATE_IF)) {
        overrides.documentation = (
          overrides.documentation ?? field.documentation
        )?.replace(DTO_INPUT_VALIDATE_IF, '@ValidateIf');
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
      const includeType = templateHelpers.config.outputApiPropertyType
        ? !overrides.type
        : false;
      const { apiProperties, gqlProperties } = parseApiProperty(
        {
          ...field,
          ...overrides,
        },
        {
          type: includeType,
        },
        ClassType.INPUT,
      );
      decorators.apiProperties = apiProperties;
      decorators.gqlProperties = gqlProperties;
      if (overrides.type && templateHelpers.config.outputApiPropertyType)
        decorators.apiProperties.push({
          name: 'type',
          value: overrides.type,
          noEncapsulation: true,
        });
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
    extraClasses,
    apiExtraModels,
  };
};
