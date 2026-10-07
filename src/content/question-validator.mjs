import Ajv from 'ajv';
export function createQuestionValidators(trustedQuestionSchema, trustedBlockSchema) {
  const ajv = new Ajv({ allErrors: true, strict: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  ajv.addSchema(trustedBlockSchema);
  const question = ajv.compile(trustedQuestionSchema);
  const response = ajv.compile({ $ref: trustedQuestionSchema.$id + '#/definitions/response' });
  const wrap = (stage, validate) => value => {
    const structureValid = Boolean(validate(value));
    const diagnostics = (validate.errors ?? []).map(error => ({
      path: error.instancePath || '/', keyword: error.keyword,
      message: error.message ?? 'Invalid typed content',
      params: JSON.parse(JSON.stringify(error.params))
    }));
    return { stage, structureValid, publicationChecked: false, diagnostics };
  };
  return { question: wrap('question', question), response: wrap('response', response) };
}
