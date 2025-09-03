import type { TemplateHelpers } from './template-helpers';
import type { CreateDtoParams } from './types';
import { ClassType } from '../enums';

interface GenerateCreateDtoParam extends CreateDtoParams {
  exportRelationModifierClasses: boolean;
  templateHelpers: TemplateHelpers;
}

export const generateCreateDto = ({
  model,
  fields,
  imports,
  extraClasses,
  apiExtraModels,
  exportRelationModifierClasses,
  templateHelpers: t,
}: GenerateCreateDtoParam) => {
  const currentImports = t.importStatements(imports);
  // console.log(
  //   '\n\n\n >>> model.name',
  //   t.createDtoName(model.name),
  // currentImports,
  // );

  const importsString = currentImports == '' ? null : currentImports;
  const mappedFields = fields.map((x) => {
    return {
      ...x,
      type: x.type === 'DateTime' ? 'String' : x.type,
    };
  });

  return `
${importsString || ''}

${t.each(
  extraClasses,
  exportRelationModifierClasses ? (content) => `export ${content}` : t.echo,
  '\n',
)}

${t.if(apiExtraModels.length, t.apiExtraModels(apiExtraModels))}
${importsString != null ? '@InputType()' : ''}
export ${t.config.outputType} ${t.createDtoName(model.name)} {
  ${t.fieldsToDtoProps(mappedFields, ClassType.CREATE, true).replace(/date-time/gm, 'string')}
}
`;
};
