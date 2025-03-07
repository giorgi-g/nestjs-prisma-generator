import { DMMF } from '@prisma/generator-helper';
import { IApiProperty, ImportStatementParams, ParsedField } from './types';
import { DTO_OVERRIDE_API_PROPERTY_TYPE } from './annotations';
import { isAnnotatedWith } from './field-classifiers';
import { ClassType } from '../enums';

const ApiProps = [
  'description',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'example',
];

const PrismaScalarToFormat: Record<string, { type: string; format?: string }> =
  {
    String: { type: 'string' },
    Boolean: { type: 'boolean' },
    Int: { type: 'integer', format: 'int32' },
    BigInt: { type: 'integer', format: 'int64' },
    Float: { type: 'number', format: 'float' },
    Decimal: { type: 'string', format: 'Decimal.js' },
    DateTime: { type: 'string', format: 'date-time' },
  };

export function isAnnotatedWithDoc(field: ParsedField): boolean {
  return ApiProps.some((prop) =>
    new RegExp(`@${prop}\\s+(.+)\\s*$`, 'm').test(field.documentation || ''),
  );
}

function getDefaultValue(field: ParsedField): any {
  if (!field.hasDefaultValue) return undefined;

  if (Array.isArray(field.default)) return JSON.stringify(field.default);

  switch (typeof field.default) {
    case 'string':
    case 'number':
    case 'boolean':
      return field.default;
    case 'object':
      if (field.default.name) {
        return field.default.name;
      }
    // fall-through
    default:
      return undefined;
  }
}

export function extractAnnotation(
  field: ParsedField,
  prop: string,
): IApiProperty | null {
  const regexp = new RegExp(`@${prop}\\s+(.+)$`, 'm');
  const matches = regexp.exec(field.documentation || '');

  if (matches && matches[1]) {
    return {
      name: prop,
      value: matches[1].trim(),
    };
  }

  return null;
}

/**
 * Wrap string with single-quotes unless it's a (stringified) number, boolean, null, or array.
 */
export function encapsulateString(value: string): string {
  // don't quote booleans, numbers, or arrays
  if (
    value === 'true' ||
    value === 'false' ||
    value === 'null' ||
    /^-?\d+(?:\.\d+)?$/.test(value) ||
    /^\[.*]$/.test(value)
  ) {
    return value;
  }

  // quote everything else
  return `'${value.replace(/'/g, "\\'")}'`;
}

export const jsonTypeToString = (str: string = ''): string => {
  const lwc = str.toLowerCase();
  if (lwc === 'json') {
    return 'String';
  }

  return str;
};

export const mapToGQLType = (str: string = ''): string => {
  const lwc = str.toLowerCase();
  if (lwc === 'date-time') {
    return 'Date';
  } else if (lwc === 'decimal.js' || lwc === 'float' || lwc === 'number') {
    return 'Float';
  } else if (lwc === 'int32' || lwc === 'integer') {
    return 'Int';
  } else if (lwc === 'boolean') {
    return 'Boolean';
  }

  return 'String';
};

/**
 * Parse all types of annotation that can be decorated with `@ApiProperty()`.
 * @param field
 * @param include All default to `true`. Set to `false` if you want to exclude a type of annotation.
 */
export function parseApiProperty(
  field: DMMF.Field,
  include: {
    default?: boolean;
    doc?: boolean;
    enum?: boolean;
    type?: boolean;
  } = {},
): { apiProperties: IApiProperty[]; gqlProperties: IApiProperty[] } {
  const incl = {
    default: true,
    doc: true,
    enum: true,
    type: true,
    ...include,
  };

  const properties: IApiProperty[] = [];
  const gqlProperties: IApiProperty[] = [];

  if (incl.doc && field.documentation) {
    for (const prop of ApiProps) {
      const property = extractAnnotation(field, prop);
      if (property) {
        properties.push(property);
      }
    }
  }

  if (incl.type) {
    const rawCastType = isAnnotatedWith(field, DTO_OVERRIDE_API_PROPERTY_TYPE, {
      returnAnnotationParameters: true,
    });
    const castType = rawCastType ? rawCastType.split(',')[0] : undefined;
    const scalarFormat = PrismaScalarToFormat[field.type];
    if (castType) {
      properties.push({
        name: 'type',
        value: '() => ' + castType,
        noEncapsulation: true,
      });

      gqlProperties.push({
        name: 'type',
        base: castType,
        value: field.isList ? '() => [' + castType + ']' : '() => ' + castType,
      });
    } else if (scalarFormat) {
      properties.push({
        name: 'type',
        value: scalarFormat.type,
      });

      gqlProperties.push({
        name: 'type',
        base: scalarFormat.type,
        value: field.isList
          ? `() => [${mapToGQLType(scalarFormat.type)}]`
          : `() => ${mapToGQLType(scalarFormat.type)}`,
      });

      if (scalarFormat.format) {
        properties.push({ name: 'format', value: scalarFormat.format });
        gqlProperties.push({
          name: 'format',
          base: scalarFormat.format,
          value: field.isList
            ? `() => [${mapToGQLType(scalarFormat.format)}]`
            : `() => ${mapToGQLType(scalarFormat.format)}`,
        });
      }
    } else if (field.kind !== 'enum') {
      properties.push({
        name: 'type',
        value: field.type,
        noEncapsulation: true,
      });

      gqlProperties.push({
        name: 'enum',
        value: field.isList
          ? '() => [' + jsonTypeToString(field.type) + ']'
          : '() => ' + jsonTypeToString(field.type),
        noEncapsulation: true,
      });
    }
    if (field.isList) {
      properties.push({ name: 'isArray', value: 'true' });
    }
  }

  if (incl.enum && field.kind === 'enum') {
    properties.push({ name: 'enum', value: field.type });
    properties.push({ name: 'enumName', value: field.type });
  }

  const defaultValue = getDefaultValue(field);
  if (incl.default && defaultValue !== undefined) {
    properties.push({ name: 'default', value: `${defaultValue}` });
    gqlProperties.push({ name: 'defaultValue', value: `${defaultValue}` });
  }

  if (!field.isRequired) {
    properties.push({ name: 'required', value: 'false' });
  }

  if (
    typeof field.isNullable === 'boolean' ? field.isNullable : !field.isRequired
  ) {
    properties.push({ name: 'nullable', value: 'true' });
    gqlProperties.push({ name: 'nullable', value: 'true' });
  }

  // set dummy property to force `@ApiProperty` decorator
  if (properties.length === 0) {
    properties.push({ name: 'dummy', value: '' });
    gqlProperties.push({ name: 'dummy', value: '' });
  }

  return { apiProperties: properties, gqlProperties };
}

/**
 * Compose `@Field()` decorator.
 */
export function decorateField(field: ParsedField, dtoType?: ClassType): string {
  if (field.apiExcludeProperty) {
    return '';
  }

  if (
    field.gqlProperties?.length === 1 &&
    field.gqlProperties[0].name === 'dummy'
  ) {
    return '@Field()\n';
  }

  const currentType = field?.apiProperties?.find((x) => x?.name === 'type');
  const isEntity =
    currentType?.value?.includes('Entity') &&
    currentType?.value?.includes('() =>');

  let decorator = '';

  if (field.gqlProperties?.length) {
    const typeProperty = field.gqlProperties.find((x) => x.name === 'type');
    const enumProperty = field.gqlProperties.find((x) => x.name === 'enum');
    const formatProperty = field.gqlProperties.find((x) => x.name === 'format');
    const type = formatProperty || typeProperty || enumProperty;

    const filteredProps = field.gqlProperties.filter(
      (x) => !['dummy', 'type', 'enum', 'format'].includes(x.name),
    );
    const hasOtherProps = filteredProps.length;

    let typeValue = type?.value;

    if (dtoType === ClassType.CREATE || dtoType === ClassType.UPDATE) {
      if (type?.base === 'date-time') {
        typeValue = typeValue?.replace('Date', 'String');
      }
    }

    if (typeValue != null && isEntity) {
      if (typeValue.endsWith(']')) {
        typeValue = typeValue.replace(']', 'Entity]');
      } else {
        typeValue = `${typeValue}Entity`;
      }
    }

    decorator += `@Field(${typeValue != null ? `${eval(typeValue)}${hasOtherProps ? ', ' : ''}` : ''}${hasOtherProps ? '{\n' : ''}`;

    filteredProps.forEach((prop) => {
      decorator += ` ${prop.name}: ${
        prop.noEncapsulation ? prop.value : encapsulateString(prop.value)
      },\n`;
    });

    decorator += `${hasOtherProps ? '}' : ''})`;
  }

  return decorator;
}

/**
 * Compose `@ApiProperty()` decorator.
 */
export function decorateApiProperty(
  field: ParsedField,
  dtoType?: ClassType,
): string {
  if (field.apiHideProperty && field.apiExcludeProperty) {
    return '@ApiHideProperty()\n@Exclude({ toPlainOnly: true })\n';
  }

  if (field.apiHideProperty) {
    return '@ApiHideProperty()\n';
  }

  if (field.apiExcludeProperty) {
    return '@Exclude({ toPlainOnly: true })\n';
  }

  if (
    field.apiProperties?.length === 1 &&
    field.apiProperties[0].name === 'dummy'
  ) {
    return '@ApiProperty()\n';
  }

  let decorator = '';

  if (field.apiProperties?.length) {
    decorator += '@ApiProperty({\n';
    field.apiProperties.forEach((prop) => {
      if (prop.name === 'dummy') return;
      const propValue =
        (dtoType === ClassType.CREATE || dtoType === ClassType.UPDATE) &&
        prop?.value === 'date-time'
          ? 'string'
          : prop.value;

      decorator += `  ${prop.name}: ${
        prop.name === 'enum' || prop.noEncapsulation
          ? propValue
          : encapsulateString(prop.value)
      },\n`;
    });
    decorator += '})\n';
  }

  return decorator;
}

export function makeImportsFromNestjsSwagger(
  fields: ParsedField[],
  apiExtraModels?: string[],
): ImportStatementParams[] {
  const hasApiProperty = fields.some((field) => field.apiProperties?.length);
  const hasGqlProperties = fields.some((field) => field.gqlProperties?.length);
  const hasApiHideProperty = fields.some((field) => field.apiHideProperty);
  const hasExcludeProperty = fields.some((field) => field.apiExcludeProperty);

  if (hasApiProperty || hasApiHideProperty || apiExtraModels?.length) {
    const destruct: string[] = [];
    const destructGqlTypes: string[] = ['Field', 'InputType', 'ObjectType'];

    if (apiExtraModels?.length) destruct.push('ApiExtraModels');
    if (hasApiHideProperty || hasExcludeProperty)
      destruct.push('ApiHideProperty');
    if (hasApiProperty) destruct.push('ApiProperty');
    // if (hasExcludeProperty) destruct.push('Exclude');

    if (hasGqlProperties) {
      destructGqlTypes.push('Int');
      destructGqlTypes.push('Float');
    }

    return [
      { from: '@nestjs/swagger', destruct },
      { from: '@nestjs/graphql', destruct: destructGqlTypes },
    ];
  }

  return [];
}
