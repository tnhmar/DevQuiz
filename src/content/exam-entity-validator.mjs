import Ajv from 'ajv';
export function createExamValidators(trustedSchemas) {
  const ajv = new Ajv({ allErrors: true, strict: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  for (const name of ['blocks', 'questions', 'learning', 'provenance', 'exams']) ajv.addSchema(trustedSchemas[name]);
  const result = {};
  for (const [kind, definition] of [['profile', 'profile'], ['test', 'test']]) {
    const validate = ajv.compile({ $ref: trustedSchemas.exams.$id + '#/definitions/' + definition });
    result[kind] = value => {
      const structureValid = Boolean(validate(value));
      const diagnostics = (validate.errors ?? []).map(error => ({
        path: error.instancePath || '/', keyword: error.keyword,
        message: error.message ?? 'Invalid exam declaration',
        params: JSON.parse(JSON.stringify(error.params))
      }));
      return { stage: 'exam_entity', kind, structureValid, referencesChecked: false, profileMetadataChecked: false, simulationReadinessChecked: false, publicationChecked: false, diagnostics };
    };
  }
  return result;
}
