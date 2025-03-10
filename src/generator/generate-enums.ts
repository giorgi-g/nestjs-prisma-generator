import { DMMF } from '@prisma/generator-helper';
import { camel, pascal } from 'case';
import { each } from './template-helpers';

export const generateEnums = (
  enumModels: DMMF.DatamodelEnum[],
  prismaClientImportPath: string | undefined,
) => {
  const enumsList = enumModels.map((x) => x.name);
  const prismaImportPath = prismaClientImportPath
    ? prismaClientImportPath.replace('../', '')
    : '@prisma/client';
  const enumImports = enumsList.length
    ? `import { ${enumsList.join(', ')} } from "${prismaImportPath}";`
    : '';
  console.log('Generate enums for enums...', enumImports);
  return `import { registerEnumType } from "@nestjs/graphql";
${enumImports}
${each(
  enumModels,
  (model) => {
    return `
export const ${camel(model.name)} = [${each(model.values, (v) => `'${v.name}'`, ', ')}] as const;

export enum ${pascal(model.name)}Enum {
  ${each(model.values, (v) => `${v.name.toUpperCase()} = '${v.name.toUpperCase()}'\n`, ', ')}
}

registerEnumType(${pascal(model.name)}, {
    name: "${pascal(model.name)}",
});
`;
  },
  '\n',
)}
`;
};
