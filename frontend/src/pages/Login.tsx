import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { errorMessage } from '../lib/api';
import { loginSchema, registerSchema } from '../lib/schemas';
import { useLogin, useMe, useRegister } from '../hooks/useAuth';

type Mode = 'login' | 'register';

/** Only allow same-site redirects after login (prevents open-redirect abuse of ?next=). */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

const loginFormSchema = loginSchema.extend({ name: z.string().optional() });
type FormValues = z.infer<typeof registerSchema>;

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { data: user } = useMe();

  if (user) return <Navigate to={next} replace />;
  // Keyed so each mode mounts a fresh form with its own validation schema.
  return <AuthForm key={mode} mode={mode} next={next} onSwitch={() => setMode(mode === 'login' ? 'register' : 'login')} />;
}

function AuthForm({ mode, next, onSwitch }: { mode: Mode; next: string; onSwitch: () => void }) {
  const navigate = useNavigate();
  const login = useLogin();
  const register = useRegister();
  const form = useForm<FormValues>({
    resolver: zodResolver((mode === 'login' ? loginFormSchema : registerSchema) as typeof registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { user } =
        mode === 'login' ? await login.mutateAsync({ email: values.email, password: values.password }) : await register.mutateAsync(values);
      toast.success(mode === 'login' ? `Welcome back, ${user.name.split(' ')[0]}!` : 'Account created. Welcome to DesiDrapes!');
      navigate(next, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="m-auto mt-14 flex w-[90%] flex-col items-center gap-4 text-gray-800 sm:max-w-96">
      <div className="mb-2 mt-10 inline-flex items-center gap-2">
        <h1 className="prata-regular text-3xl">{mode === 'login' ? 'Login' : 'Sign Up'}</h1>
        <span className="h-[1.5px] w-8 bg-gray-800" aria-hidden />
      </div>

      {mode === 'register' && (
        <div className="w-full">
          <input {...form.register('name')} placeholder="Full name" autoComplete="name" className="input" aria-label="Full name" aria-invalid={Boolean(errors.name)} />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>
      )}
      <div className="w-full">
        <input {...form.register('email')} type="email" placeholder="Email" autoComplete="email" className="input" aria-label="Email" aria-invalid={Boolean(errors.email)} />
        {errors.email && <p className="field-error">{errors.email.message}</p>}
      </div>
      <div className="w-full">
        <input
          {...form.register('password')}
          type="password"
          placeholder="Password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="input"
          aria-label="Password"
          aria-invalid={Boolean(errors.password)}
        />
        {errors.password && <p className="field-error">{errors.password.message}</p>}
        {mode === 'register' && !errors.password && (
          <p className="mt-1 text-xs text-gray-500">8+ characters with upper and lowercase letters and a number.</p>
        )}
      </div>

      <div className="-mt-2 flex w-full justify-between text-sm">
        <Link to="/forgot-password" className="text-gray-600 hover:text-black">
          Forgot your password?
        </Link>
        <button type="button" onClick={onSwitch} className="text-gray-600 hover:text-black">
          {mode === 'login' ? 'Create account' : 'Login here'}
        </button>
      </div>

      <button disabled={isSubmitting} className="btn-primary mt-4">
        {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Sign Up'}
      </button>

      <div className="mt-6 w-full rounded border border-dashed border-gray-300 p-3 text-xs text-gray-500">
        <p className="font-medium text-gray-700">Demo accounts</p>
        <p>Customer: customer@desidrapes.com / Customer@123</p>
        <p>Admin: admin@desidrapes.com / Admin@12345</p>
      </div>
    </form>
  );
}
