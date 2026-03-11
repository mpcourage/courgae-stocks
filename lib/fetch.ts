/**
 * Safely parse JSON from a fetch Response.
 * Throws with a descriptive error if the body is empty or not valid JSON.
 */
export async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) throw new Error(`Empty response (${res.status})`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON: ${text.slice(0, 120)}`);
  }
}
