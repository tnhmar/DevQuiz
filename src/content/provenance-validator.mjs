import Ajv from 'ajv';
export function createProvenanceValidators(trustedProvenanceSchema, trustedQuestionSchema, trustedBlockSchema) {
  const ajv = new Ajv({ allErrors: true, strict: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  ajv.addSchema(trustedBlockSchema);
  ajv.addSchema(trustedQuestionSchema);
  ajv.addSchema(trustedProvenanceSchema);
  const result = {};
  for (const kind of ['source', 'claim', 'asset']) {
    const validate = ajv.compile({ $ref: trustedProvenanceSchema.$id + '#/definitions/' + kind });
    result[kind] = value => {
      const structureValid = Boolean(validate(value));
      const diagnostics = (validate.errors ?? []).map(error => ({
        path: error.instancePath || '/', keyword: error.keyword,
        message: error.message ?? 'Invalid provenance declaration',
        params: JSON.parse(JSON.stringify(error.params))
      }));
      return { stage: 'provenance_entity', kind, structureValid, referencesChecked: false, factualVerificationChecked: false, rightsChecked: false, publicationChecked: false, diagnostics };
    };
  }
  return result;
}
