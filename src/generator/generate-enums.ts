import { DMMF } from '@prisma/generator-helper';
import { camel, pascal } from 'case';
import { each } from './template-helpers';

export const generateEnums = (enumModels: DMMF.DatamodelEnum[]) => `
${each(
  enumModels,
  (model) => {
    return `import { registerEnumType } from "@nestjs/graphql";

export const ${camel(model.name)} = [${each(model.values, (v) => `'${v.name}'`, ', ')}] as const;

export enum ${pascal(model.name)} {
  ${each(model.values, (v) => `${v.name.toUpperCase()} = '${v.name.toUpperCase()}'\n`, ', ')}
}

registerEnumType(pascal(model.name), {
    name: "${pascal(model.name)}",
});
`;
  },
  '\n',
)}
`;
