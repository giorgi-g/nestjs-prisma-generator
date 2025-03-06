import { DMMF } from '@prisma/generator-helper';
import { pascal } from 'case';
import { each } from './template-helpers';

export const generateEnums = (enumModels: DMMF.DatamodelEnum[]) => `
${each(
  enumModels,
  (model) => {
    return `
export enum ${pascal(model.name)} {
  ${each(model.values, (v) => `${v.name.toUpperCase()} = '${v.name.toUpperCase()}'\n`, ', ')}
}
`;
  },
  '\n',
)}
`;
