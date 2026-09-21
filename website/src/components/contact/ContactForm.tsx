import { Link as RouterLink } from 'react-router-dom';
import { useRef, useState, type ChangeEvent, type FocusEvent, type FormEvent } from 'react';
import { AnimatePresence, m } from 'motion/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SendRounded from '@mui/icons-material/SendRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import { ContactNotConfiguredError, submitContactMessage, type ContactPayload } from '../../services/contact';
import { CONTACT_LIMITS, validateContact, validateContactField, type ContactErrors, type ContactField } from '../../utils/validation';
import { siteConfig } from '../../config/site';
import { mailto } from '../../utils/url';
import { routes } from '../../data/navigation';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const EMPTY: ContactPayload = { name: '', email: '', subject: '', message: '' };

const FIELDS: { name: ContactField; label: string; autoComplete?: string; type?: string; multiline?: boolean; half?: boolean }[] = [
  { name: 'name', label: 'Name', autoComplete: 'name', half: true },
  { name: 'email', label: 'Email', autoComplete: 'email', type: 'email', half: true },
  { name: 'subject', label: 'Subject' },
  { name: 'message', label: 'Message', multiline: true },
];

export default function ContactForm() {
  const [values, setValues] = useState<ContactPayload>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [submitError, setSubmitError] = useState<{ message: string; notConfigured: boolean } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const onChange = (field: ContactField) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
    // Re-validate live only after the user has left the field once, so errors don't appear mid-typing.
    if (touched[field]) setErrors((prev) => ({ ...prev, [field]: validateContactField(field, value) }));
  };

  const onBlur = (field: ContactField) => (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateContactField(field, e.target.value) }));
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'submitting') return;

    const nextErrors = validateContact(values);
    setErrors(nextErrors);
    setTouched({ name: true, email: true, subject: true, message: true });
    const firstInvalid = FIELDS.find((f) => nextErrors[f.name]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid.name}"]`)?.focus();
      return;
    }

    setStatus('submitting');
    setSubmitError(null);
    try {
      await submitContactMessage({
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
      });
      setStatus('success');
      setValues(EMPTY);
      setTouched({});
    } catch (error) {
      const notConfigured = error instanceof ContactNotConfiguredError;
      setSubmitError({
        notConfigured,
        message: notConfigured
          ? 'Online messages are not available yet. Please email us directly — your message has not been sent.'
          : error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
      });
      setStatus('error');
    }
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  if (status === 'success') {
    return (
      <m.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <Box ref={statusRef} tabIndex={-1} role="status" sx={{ textAlign: 'center', py: { xs: 6, md: 8 }, px: 2, outline: 'none' }}>
          <Box sx={{ width: 64, height: 64, mx: 'auto', mb: 3, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(74, 222, 154, 0.14)', color: 'success.main' }}>
            <CheckCircleRounded sx={{ fontSize: 36 }} aria-hidden />
          </Box>
          <Typography variant="h4" component="h2">
            Message sent
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 420, mx: 'auto' }}>
            Thanks for getting in touch. We will reply to the email address you provided.
          </Typography>
          <Button variant="outlined" sx={{ mt: 4 }} onClick={() => setStatus('idle')}>
            Send another message
          </Button>
        </Box>
      </m.div>
    );
  }

  const submitting = status === 'submitting';

  return (
    <Box component="form" ref={formRef} noValidate onSubmit={onSubmit} aria-labelledby="contact-form-title" aria-busy={submitting}>
      <Typography id="contact-form-title" variant="h4" component="h2" sx={{ mb: 1 }}>
        Send us a message
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        All fields are required.
      </Typography>

      <AnimatePresence>
        {submitError && (
          <m.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <Alert
              ref={statusRef}
              tabIndex={-1}
              severity={submitError.notConfigured ? 'info' : 'error'}
              role="alert"
              sx={{ mb: 3, borderRadius: 3, outline: 'none' }}
              action={
                <Button
                  component="a"
                  href={mailto(siteConfig.supportEmail, values.subject || 'Question about Flint')}
                  color="inherit"
                  size="small"
                  sx={{ whiteSpace: 'nowrap', alignSelf: 'center' }}
                >
                  Email us
                </Button>
              }
            >
              {submitError.message}
            </Alert>
          </m.div>
        )}
      </AnimatePresence>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {FIELDS.map((f) => {
          const error = touched[f.name] ? errors[f.name] : undefined;
          const limit = f.name === 'message' ? CONTACT_LIMITS.message : undefined;
          return (
            <TextField
              key={f.name}
              name={f.name}
              label={f.label}
              type={f.type ?? 'text'}
              value={values[f.name]}
              onChange={onChange(f.name)}
              onBlur={onBlur(f.name)}
              required
              disabled={submitting}
              error={Boolean(error)}
              helperText={
                error ??
                (limit ? `${values.message.trim().length} / ${limit} characters` : f.name === 'email' ? 'We only use this to reply to you.' : ' ')
              }
              multiline={f.multiline}
              minRows={f.multiline ? 6 : undefined}
              sx={{ gridColumn: f.half ? 'auto' : '1 / -1' }}
              slotProps={{
                htmlInput: {
                  autoComplete: f.autoComplete,
                  maxLength: f.name === 'message' ? CONTACT_LIMITS.message + 200 : 200,
                  'aria-required': true,
                },
                formHelperText: { 'aria-live': f.name === 'message' ? 'off' : 'polite' } as object,
              }}
            />
          );
        })}
      </Box>

      <Box sx={{ mt: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 360 }}>
          By sending this form you agree that we may use your details to respond. See our{' '}
          <Link component={RouterLink} to={routes.privacy} sx={{ fontWeight: 600 }}>
            Privacy Policy
          </Link>
          .
        </Typography>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={submitting}
          endIcon={submitting ? <CircularProgress size={18} sx={{ color: 'inherit' }} aria-hidden /> : <SendRounded />}
          sx={{ minWidth: 180, flexShrink: 0, whiteSpace: 'nowrap', '&.Mui-disabled': { color: 'rgba(255,255,255,0.85)', backgroundImage: 'linear-gradient(135deg, #7440E6, #CF2C79)', opacity: 0.7 } }}
        >
          {submitting ? 'Sending…' : 'Send message'}
        </Button>
      </Box>
    </Box>
  );
}
