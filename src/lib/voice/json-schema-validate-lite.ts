/**
 * Validates parsed JSON values against a **subset** of JSON Schema compatible with
 * Gemini `responseJsonSchema` (object/array/string/number/boolean, properties, required, items, enum).
 * Used for post-extraction checks; warnings are non-fatal.
 */
export function validateJsonSchemaSubset(schema: unknown, value: unknown, path: string[] = []): string[] {
  const errors: string[] = [];
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return errors;
  }
  const s = schema as Record<string, unknown>;
  const type = s.type;

  if (type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`${path.join(".") || "$"}: expected object`);
      return errors;
    }
    const props = (s.properties ?? {}) as Record<string, unknown>;
    const required = (s.required as string[] | undefined) ?? [];
    const obj = value as Record<string, unknown>;
    for (const key of required) {
      if (!(key in obj) || obj[key] === undefined) {
        errors.push(`${[...path, key].join(".")}: required property missing`);
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in obj) {
        errors.push(...validateJsonSchemaSubset(sub, obj[key], [...path, key]));
      }
    }
    const addl = s.additionalProperties;
    if (addl === false && typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const key of Object.keys(obj)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) {
          errors.push(`${[...path, key].join(".")}: additional properties not allowed`);
        }
      }
    }
    return errors;
  }

  if (type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path.join(".") || "$"}: expected array`);
      return errors;
    }
    const items = s.items;
    if (items && typeof items === "object" && !Array.isArray(items)) {
      value.forEach((item, i) => {
        errors.push(...validateJsonSchemaSubset(items, item, [...path, String(i)]));
      });
    }
    const minItems = s.minItems;
    const maxItems = s.maxItems;
    if (typeof minItems === "number" && value.length < minItems) {
      errors.push(`${path.join(".") || "$"}: array shorter than minItems`);
    }
    if (typeof maxItems === "number" && value.length > maxItems) {
      errors.push(`${path.join(".") || "$"}: array longer than maxItems`);
    }
    return errors;
  }

  if (type === "string") {
    if (typeof value !== "string") {
      errors.push(`${path.join(".") || "$"}: expected string`);
    }
    if (Array.isArray(s.enum)) {
      const allowed = s.enum as unknown[];
      if (!allowed.includes(value)) {
        errors.push(`${path.join(".") || "$"}: not in enum`);
      }
    }
    return errors;
  }

  if (type === "number" || type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`${path.join(".") || "$"}: expected number`);
      return errors;
    }
    if (type === "integer" && !Number.isInteger(value)) {
      errors.push(`${path.join(".") || "$"}: expected integer`);
    }
    if (typeof s.minimum === "number" && value < s.minimum) {
      errors.push(`${path.join(".") || "$"}: below minimum`);
    }
    if (typeof s.maximum === "number" && value > s.maximum) {
      errors.push(`${path.join(".") || "$"}: above maximum`);
    }
    if (Array.isArray(s.enum)) {
      const allowed = s.enum as unknown[];
      if (!allowed.includes(value)) {
        errors.push(`${path.join(".") || "$"}: not in enum`);
      }
    }
    return errors;
  }

  if (type === "boolean") {
    if (typeof value !== "boolean") {
      errors.push(`${path.join(".") || "$"}: expected boolean`);
    }
    return errors;
  }

  if (type === "null") {
    if (value !== null) {
      errors.push(`${path.join(".") || "$"}: expected null`);
    }
    return errors;
  }

  /** anyOf / oneOf (Gemini treats oneOf like anyOf): first branch that produces no errors wins */
  const anyOf = (s.anyOf ?? s.oneOf) as unknown[] | undefined;
  if (Array.isArray(anyOf) && anyOf.length > 0) {
    const branchErrors = anyOf.map((branch) => validateJsonSchemaSubset(branch, value, path));
    const ok = branchErrors.some((e) => e.length === 0);
    if (!ok) {
      errors.push(`${path.join(".") || "$"}: does not match anyOf/oneOf`);
    }
    return errors;
  }

  return errors;
}
