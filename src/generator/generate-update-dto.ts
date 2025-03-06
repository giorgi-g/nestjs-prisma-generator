import type { TemplateHelpers } from './template-helpers';
import type { UpdateDtoParams } from './types';

interface GenerateUpdateDtoParam extends UpdateDtoParams {
  exportRelationModifierClasses: boolean;
  templateHelpers: TemplateHelpers;
}

export const generateUpdateDto = ({
  model,
  fields,
  imports,
  extraClasses,
  apiExtraModels,
  exportRelationModifierClasses,
  templateHelpers: t,
}: GenerateUpdateDtoParam) => {
  const currentImports = t.importStatements(imports);
  const importsString = currentImports == '' ? null : currentImports;

  // const filteredFields = fields.filter((x) => x?.isId !== true);

  return `
${importsString || ''}

${t.each(
  extraClasses,
  exportRelationModifierClasses ? (content) => `export ${content}` : t.echo,
  '\n',
)}

${t.if(apiExtraModels.length, t.apiExtraModels(apiExtraModels))}
${importsString != null ? '@InputType()' : ''}
export ${t.config.outputType} ${t.updateDtoName(model.name)} {
  ${t.fieldsToDtoProps(fields, 'update', true)}
}
`;
};
