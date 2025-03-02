import type { TemplateHelpers } from './template-helpers';
import type { EntityParams } from './types';

interface GenerateEntityParam extends EntityParams {
  templateHelpers: TemplateHelpers;
}
export const generatePlainDto = ({
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

${t.if(apiExtraModels.length, t.apiExtraModels(apiExtraModels))}
${importsString != null ? '@ObjectType()' : ''}
export ${t.config.outputType} ${t.plainDtoName(model.name)} {
  ${t.fieldsToEntityProps(fields)}
}
`;
};
