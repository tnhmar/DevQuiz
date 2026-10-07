import Ajv from 'ajv';
export function createEnvelopeValidator(schema) {
  const ajv = new Ajv({ allErrors: true, strict: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  const validate = ajv.compile(schema);
  return (value) => {
    const envelopeValid = Boolean(validate(value));
    const diagnostics = (validate.errors ?? []).map(error => ({
      path: error.instancePath || '/',
      keyword: error.keyword,
      message: error.message ?? 'Envelope validation failed',
      params: { ...error.params }
    }));
    return { stage: 'envelope', envelopeValid, publicationChecked: false, diagnostics };
  };
}
