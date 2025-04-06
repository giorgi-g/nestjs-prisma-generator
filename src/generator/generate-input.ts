import type { TemplateHelpers } from './template-helpers';
import type { EntityParams } from './types';

interface GenerateEntityParam extends EntityParams {
  templateHelpers: TemplateHelpers;
}
export const generateInput = ({
  model,
  fields,
  imports,
  apiExtraModels,
  templateHelpers: t,
}: GenerateEntityParam) => {
  const currentImports = t.importStatements(imports);
  const importsString = currentImports == '' ? null : currentImports;

  return `
${importsString || ''}
import { PaginationInput } from '../pagination';

${t.if(apiExtraModels.length, t.apiExtraModels(apiExtraModels))}
${importsString != null ? '@ObjectType()' : ''}
export ${t.config.outputType} ${t.inputName(model.name).replace('Dto', 'Input')} extends PaginationInput {
  ${t.fieldsToEntityProps(fields)}
}
`;
};
