import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * `raw` as an E.164 number (+923001234567), or null when it isn't a valid number with its
 * country code. Signup and contact matching both store and compare numbers in this form.
 */
export function toE164(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const parsed = parsePhoneNumberFromString(raw.trim());
    return parsed?.isValid() ? parsed.number : null;
}
