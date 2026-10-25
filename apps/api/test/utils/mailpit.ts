export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

export interface CaughtMessage {
  Subject: string;
  Text: string;
  HTML: string;
}

export async function clearMailbox(): Promise<void> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Mailpit clear failed: ${res.status}`);
}

async function findMessageIds(email: string): Promise<string[]> {
  const query = encodeURIComponent(`to:"${email}"`);
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
  const body = (await res.json()) as { messages?: { ID: string }[] };
  return (body.messages ?? []).map((m) => m.ID);
}

/** Polls Mailpit until `count` messages to `email` have arrived, then returns them. */
export async function waitForMessagesTo(
  email: string,
  count: number,
  timeoutMs = 5000,
): Promise<CaughtMessage[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ids = await findMessageIds(email);
    if (ids.length >= count) {
      return Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
          if (!res.ok) throw new Error(`Mailpit message fetch failed: ${res.status}`);
          return (await res.json()) as CaughtMessage;
        }),
      );
    }
    if (Date.now() >= deadline) {
      throw new Error(`Only ${ids.length} of ${count} emails to ${email} within ${timeoutMs} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function messageCountTo(email: string): Promise<number> {
  return (await findMessageIds(email)).length;
}

export function extractResetToken(text: string): string {
  const match = /#token=([A-Za-z0-9_-]+)/.exec(text);
  if (!match?.[1]) throw new Error('No reset token in the email text');
  return match[1];
}
