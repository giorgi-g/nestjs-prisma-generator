import type { TemplateHelpers } from './template-helpers';
import type { EntityParams } from './types';

interface GenerateEntityParam extends EntityParams {
  templateHelpers: TemplateHelpers;
}

export const generateEntity = ({
  model,
  fields,
  imports,
  apiExtraModels,
  templateHelpers: t,
}: GenerateEntityParam) => {
  // console.log(`>>> 1111 ${t.importStatements(imports)}`);

  return `${t.importStatements(imports)}

${t.if(apiExtraModels.length, t.apiExtraModels(apiExtraModels))}
@ObjectType()
export ${t.config.outputType} ${t.entityName(model.name)} {
  ${t.fieldsToEntityProps(fields)}
}
`;
};
