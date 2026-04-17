const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "stripe_key", regex: /\bsk_live_[a-zA-Z0-9]{20,}\b/g },
  { name: "stripe_test", regex: /\bsk_test_[a-zA-Z0-9]{20,}\b/g },
  { name: "pi_key", regex: /\bpi_[a-zA-Z0-9_]{16,}\b/g },
  { name: "generic_secret", regex: /(?:password|secret|token)\s*[:=]\s*['"]([^'"]{8,})['"]/gi },
];

export function redactSource(code: string): { redacted: string; found: string[] } {
  let redacted = code;
  const found = new Set<string>();

  for (const { name, regex } of PATTERNS) {
    redacted = redacted.replace(regex, (match) => {
      found.add(name);
      return match.replace(/[A-Za-z0-9]/g, "*");
    });
  }

  return { redacted, found: [...found] };
}
