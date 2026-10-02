import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { api, errorMessage } from '../lib/api';
import { passwordSchema } from '../lib/schemas';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="m-auto mt-24 flex w-[90%] flex-col gap-4 sm:max-w-96">
      <h1 className="prata-regular text-3xl">{title}</h1>
      {children}
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const request = useMutation({
    mutationFn: () => api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (request.isSuccess) {
    return (
      <Shell title="Check your email">
        <p className="text-sm text-gray-600">{request.data.message}</p>
        <p className="text-xs text-gray-500">
          Running locally? Reset emails are delivered by n8n to Mailpit at{' '}
          <a href="http://localhost:8025" className="underline" target="_blank" rel="noreferrer">
            localhost:8025
          </a>
          .
        </p>
        <Link to="/login" className="text-sm underline">
          Back to login
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title="Reset password">
      <p className="text-sm text-gray-600">Enter your account email and we'll send you a reset link.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          request.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="input" aria-label="Email" />
        <button disabled={request.isPending} className="btn-primary">
          {request.isPending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const navigate = useNavigate();
  const reset = useMutation({
    mutationFn: () => api<{ message: string }>('/auth/reset-password', { method: 'POST', body: { token, password } }),
    onSuccess: (r) => {
      toast.success(r.message);
      navigate('/login');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!token) {
    return (
      <Shell title="Invalid link">
        <p className="text-sm text-gray-600">This reset link is missing its token.</p>
        <Link to="/forgot-password" className="text-sm underline">
          Request a new link
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title="Choose a new password">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const check = passwordSchema.safeParse(password);
          if (!check.success) return setError(check.error.issues[0].message);
          setError(undefined);
          reset.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" className="input" aria-label="New password" />
          {error && <p className="field-error">{error}</p>}
        </div>
        <button disabled={reset.isPending} className="btn-primary">
          {reset.isPending ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </Shell>
  );
}
