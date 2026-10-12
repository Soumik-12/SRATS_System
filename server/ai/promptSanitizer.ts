/**
 * SRATS Prompt Sanitizer and Untrusted Document Boundary Guard
 * 
 * Enforces security invariants from AI_CONTRACT.md & SECURITY.md:
 * 1. Untrusted documents are strictly framed as passive data payloads using boundary delimiters.
 * 2. Instructions inside uploaded resumes must never override system instructions.
 * 3. Detects potential prompt injection attempts and flags them.
 * 4. Minimizes sensitive data leakage.
 */

export const UNTRUSTED_DOC_START = '<<<BEGIN_UNTRUSTED_DOCUMENT_CONTENT>>>';
export const UNTRUSTED_DOC_END = '<<<END_UNTRUSTED_DOCUMENT_CONTENT>>>';

// Heuristic patterns commonly used in prompt injection / jailbreak attempts
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /override\s+(all\s+)?(system|safety|security)\s+(rules|prompts|guidelines)/i,
  /you\s+are\s+now\s+(a|an|in)\s+(developer\s+mode|unrestricted|god\s+mode|dan)/i,
  /system\s*:\s*you\s+must/i,
  /<\s*script\b[^>]*>/i,
  /drop\s+table\s+/i,
  /select\s+\*\s+from\s+users/i,
  /admin\s+token\s*=/i,
  /print\s+(your\s+)?(system\s+prompt|api\s+key)/i,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions)/i,
];

export interface SanitizationResult {
  hasSuspiciousPatterns: boolean;
  detectedPatterns: string[];
  safeFramedContent: string;
  charCount: number;
}

/**
 * Checks text for prompt injection risks and returns detected patterns.
 */
export function detectPromptInjection(text: string): { hasInjectionRisk: boolean; detectedPatterns: string[] } {
  const result = sanitizeAndFrameDocument(text);
  return {
    hasInjectionRisk: result.hasSuspiciousPatterns,
    detectedPatterns: result.detectedPatterns,
  };
}

/**
 * Scans untrusted document text for injection patterns and wraps it with strict boundary delimiters.
 */
export function sanitizeAndFrameDocument(rawContent: string): SanitizationResult {
  const detectedPatterns: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(rawContent)) {
      detectedPatterns.push(pattern.source);
    }
  }

  // Neutralize common delimiter breakout attempts
  let neutralized = rawContent
    .replace(new RegExp(UNTRUSTED_DOC_START, 'g'), '[ESCAPED_DELIMITER_START]')
    .replace(new RegExp(UNTRUSTED_DOC_END, 'g'), '[ESCAPED_DELIMITER_END]');

  // Limit excessive payload length (e.g. 50k chars max to prevent token exhaustion)
  if (neutralized.length > 50000) {
    neutralized = neutralized.slice(0, 50000) + '\n...[TRUNCATED_FOR_LENGTH]';
  }

  const safeFramedContent = `${UNTRUSTED_DOC_START}\n${neutralized}\n${UNTRUSTED_DOC_END}`;

  return {
    hasSuspiciousPatterns: detectedPatterns.length > 0,
    detectedPatterns,
    safeFramedContent,
    charCount: neutralized.length,
  };
}

/**
 * Extracts printable ASCII and readable Unicode characters from a binary or text buffer.
 */
export function extractTextFromBuffer(buffer: Buffer, mimeType: string): string {
  if (!buffer || buffer.length === 0) {
    return '';
  }

  // Convert buffer to string
  const rawString = buffer.toString('utf-8');

  // Filter out excessive non-printable control characters while preserving whitespace & newlines
  const printable = rawString.replace(/[^\x20-\x7E\t\r\n\u00A0-\uFFFF]/g, ' ');

  // Collapse multiple blank lines
  const normalized = printable
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  if (normalized.trim().length > 0) {
    return normalized;
  }

  // Fallback for purely binary documents where ASCII streams are sparse
  return `[Binary document: ${mimeType}, size: ${buffer.length} bytes]`;
}
