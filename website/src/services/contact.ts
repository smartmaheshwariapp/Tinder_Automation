/**
 * Contact-form submission.
 *
 * No contact API exists in the repository. Set VITE_CONTACT_ENDPOINT to any endpoint that
 * accepts a JSON POST of `ContactPayload` (your own API, a serverless function, or a form
 * service). Until then, submissions fail with `ContactNotConfiguredError` so the UI can offer
 * the support email instead — the form never pretends a message was delivered.
 */

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export class ContactNotConfiguredError extends Error {
  constructor() {
    super('The contact form is not connected to a delivery service yet.');
    this.name = 'ContactNotConfiguredError';
  }
}

export class ContactDeliveryError extends Error {
  constructor(message = 'Your message could not be sent. Please try again.') {
    super(message);
    this.name = 'ContactDeliveryError';
  }
}

const endpoint = (import.meta.env.VITE_CONTACT_ENDPOINT as string | undefined)?.trim();

export const isContactConfigured = Boolean(endpoint);

export async function submitContactMessage(payload: ContactPayload, signal?: AbortSignal): Promise<void> {
  if (!endpoint) throw new ContactNotConfiguredError();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ContactDeliveryError('We could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) throw new ContactDeliveryError();
}
