/** Implements the non-normative IDE conversion algorithm from DAMS v0.3 §13. */
export function normalizeObjectKey(key: string): string | undefined {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return key;
  const words = key.split(" ");
  if (words.length < 2 || words.some((word) => !/^[A-Za-z]+$/.test(word)))
    return undefined;
  let result = words[0]!;
  for (let index = 1; index < words.length; index++) {
    const previous = words[index - 1]!;
    const current = words[index]!;
    const sameCase =
      (/[a-z]/.test(previous.at(-1)!) && /[a-z]/.test(current[0]!)) ||
      (/[A-Z]/.test(previous.at(-1)!) && /[A-Z]/.test(current[0]!));
    result += (sameCase ? "_" : "") + current;
  }
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(result) ? result : undefined;
}
