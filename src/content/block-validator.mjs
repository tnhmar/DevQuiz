import Ajv from 'ajv';
export function createBlockValidator(trustedSchema) {
  const ajv = new Ajv({ allErrors: true, strict: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  const validate = ajv.compile(trustedSchema);
  return (value) => ({
    stage: 'lesson_block',
    structureValid: Boolean(validate(value)),
    publicationChecked: false,
    diagnostics: (validate.errors ?? []).map(error => ({
      path: error.instancePath || '/',
      keyword: error.keyword,
      message: error.message ?? 'Invalid lesson block',
      params: { ...error.params }
    }))
  });
}
