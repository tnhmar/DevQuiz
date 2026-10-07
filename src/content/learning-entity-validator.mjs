import Ajv from 'ajv';
export function createLearningValidators(trustedLearningSchema, trustedQuestionSchema, trustedBlockSchema) {
  const ajv = new Ajv({ allErrors: true, strict: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  ajv.addSchema(trustedBlockSchema);
  ajv.addSchema(trustedQuestionSchema);
  ajv.addSchema(trustedLearningSchema);
  const result = {};
  for (const kind of ['domain', 'track', 'concept', 'chapter', 'lesson', 'glossary']) {
    const validate = ajv.compile({ $ref: trustedLearningSchema.$id + '#/definitions/' + kind });
    result[kind] = value => {
      const structureValid = Boolean(validate(value));
      const diagnostics = (validate.errors ?? []).map(error => ({
        path: error.instancePath || '/', keyword: error.keyword,
        message: error.message ?? 'Invalid learning entity',
        params: JSON.parse(JSON.stringify(error.params))
      }));
      return { stage: 'learning_entity', kind, structureValid, referencesChecked: false, publicationChecked: false, diagnostics };
    };
  }
  return result;
}
