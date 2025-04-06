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
  return `${t.importStatements(imports)}
import {Pagination} from '../pagination';

${t.if(apiExtraModels.length, t.apiExtraModels(apiExtraModels))}
@ObjectType()
export ${t.config.outputType} ${t.entityName(model.name)} {
  ${t.fieldsToEntityProps(fields)}
}

@ObjectType()
export ${t.config.outputType} ${t.entityName(model.name).replace('Entity', 'Response')} extends Pagination {}
`;
};
