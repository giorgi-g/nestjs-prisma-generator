import type { TemplateHelpers } from './template-helpers';
import type { ConnectDtoParams } from './types';
import { ClassType } from '../enums';

interface GenerateConnectDtoParam extends ConnectDtoParams {
  exportRelationModifierClasses: boolean;
  templateHelpers: TemplateHelpers;
}

export const generateConnectDto = ({
  model,
  fields,
  imports,
  extraClasses,
  apiExtraModels,
  exportRelationModifierClasses,
  templateHelpers: t,
}: GenerateConnectDtoParam) => {
  const currentImports = t.importStatements(imports);
  const importsString = currentImports == '' ? null : currentImports;

  return `
${importsString || ''}

${t.each(
  extraClasses,
  exportRelationModifierClasses
    ? (content) => `@InputType()\nexport ${content}`
    : t.echo,
  '\n',
)}

${t.if(apiExtraModels.length, t.apiExtraModels(apiExtraModels))}
${importsString != null ? '@ObjectType()' : ''}
export ${t.config.outputType} ${t.connectDtoName(model.name)} {
  ${t.fieldsToDtoProps(fields, ClassType.PLAIN, true, false)}
}
`;
};
