import type { ContactPayload } from '../services/contact';

export type ContactField = keyof ContactPayload;
export type ContactErrors = Partial<Record<ContactField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const CONTACT_LIMITS = { name: 80, subject: 120, message: 2000, messageMin: 20 } as const;

export function validateContactField(field: ContactField, raw: string): string | undefined {
  const value = raw.trim();
  switch (field) {
    case 'name':
      if (!value) return 'Please enter your name.';
      if (value.length < 2) return 'Your name should be at least 2 characters.';
      if (value.length > CONTACT_LIMITS.name) return `Please keep your name under ${CONTACT_LIMITS.name} characters.`;
      return undefined;
    case 'email':
      if (!value) return 'Please enter your email address.';
      if (!EMAIL_PATTERN.test(value)) return 'Enter a valid email address, like name@example.com.';
      return undefined;
    case 'subject':
      if (!value) return 'Please add a subject.';
      if (value.length > CONTACT_LIMITS.subject) return `Please keep the subject under ${CONTACT_LIMITS.subject} characters.`;
      return undefined;
    case 'message':
      if (!value) return 'Please write a message.';
      if (value.length < CONTACT_LIMITS.messageMin) return `Please add a little more detail (at least ${CONTACT_LIMITS.messageMin} characters).`;
      if (value.length > CONTACT_LIMITS.message) return `Please keep your message under ${CONTACT_LIMITS.message} characters.`;
      return undefined;
  }
}

export function validateContact(values: ContactPayload): ContactErrors {
  const errors: ContactErrors = {};
  (Object.keys(values) as ContactField[]).forEach((field) => {
    const error = validateContactField(field, values[field]);
    if (error) errors[field] = error;
  });
  return errors;
}
