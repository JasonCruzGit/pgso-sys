import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Eye,
  EyeOff,
  Hash,
  Lock,
  Mail,
  Phone,
  Shield,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import AppLogo from '../components/AppLogo';
import { BRANDING } from '../constants/branding';
import { PROCUREMENT_CYCLE_SUMMARY } from '../constants/procurementCycle';
import api from '../api/client';
import type { Department } from '../types';

type AuthMode = 'signin' | 'register';

const REMEMBER_EMAIL_KEY = 'pgp-gso-remember-email';

function FieldLabel({ htmlFor, children, required }: { htmlFor: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="login-input-label">
      {children}
      {required && <span className="text-palawan-600"> *</span>}
    </label>
  );
}

function IconInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  required,
  minLength,
  placeholder,
  autoComplete,
  icon,
  trailing,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  autoComplete?: string;
  icon: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>
      <div className="login-input-wrap">
        <span className="login-input-icon">{icon}</span>
        <input
          id={id}
          type={type}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`login-input${trailing ? ' login-input-with-trailing' : ''}`}
        />
        {trailing}
      </div>
    </div>
  );
}

const SHOWCASE_SLIDES = [
  {
    eyebrow: 'Inventory Intelligence',
    headline: 'A unified hub for smarter inventory and property management',
    copy: `Track supplies, stock movements, and warehouse records for ${BRANDING.lguName}.`,
    features: ['Stocks', 'Procurement', 'Assets', 'Reports'],
  },
  {
    eyebrow: 'Procurement Workflow',
    headline: 'From purchase request to delivery acceptance',
    copy: `Follow the government cycle: ${PROCUREMENT_CYCLE_SUMMARY}.`,
    features: ['PR & PO', 'DR & AIR', 'MR Release', 'ICS / PAR'],
  },
  {
    eyebrow: 'Property Accountability',
    headline: 'Issue ICS and PAR after every material release',
    copy: 'Document custodian responsibility for semi-expendable and high-value government property.',
    features: ['ICS', 'PAR', 'Assets', 'Inspections'],
  },
] as const;

function LoginShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % SHOWCASE_SLIDES.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  const slide = SHOWCASE_SLIDES[activeSlide];

  return (
    <aside className="login-showcase">
      <div className="login-showcase-glow login-showcase-glow-a" />
      <div className="login-showcase-glow login-showcase-glow-b" />
      <div className="login-showcase-grid" />

      <div className="login-showcase-inner">
        <div className="login-showcase-brand">
          <div className="login-showcase-logo-wrap">
            <AppLogo size="lg" className="ring-4 ring-white/20" />
          </div>
          <p className="login-showcase-eyebrow">{slide.eyebrow}</p>
          <h2 className="login-showcase-headline">{slide.headline}</h2>
          <p className="login-showcase-copy">{slide.copy}</p>

          <div className="login-showcase-features">
            {slide.features.map((feature) => (
              <span key={feature}>{feature}</span>
            ))}
          </div>

          <div className="login-showcase-dots" aria-hidden="true">
            {SHOWCASE_SLIDES.map((_, index) => (
              <button
                key={index}
                type="button"
                className={index === activeSlide ? 'active' : ''}
                onClick={() => setActiveSlide(index)}
                aria-label={`Show slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [name, setName] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectTo = (() => {
    const fromQuery = searchParams.get('redirect');
    if (fromQuery?.startsWith('/')) return fromQuery;
    const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
    if (!from?.pathname) return '/';
    return `${from.pathname}${from.search ?? ''}`;
  })();

  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const { data: departments } = useQuery({
    queryKey: ['registration-departments'],
    queryFn: () => api.get('/auth/registration-departments').then((r) => r.data.data as Department[]),
    enabled: mode === 'register',
  });

  const register = useMutation({
    mutationFn: () => api.post('/auth/register', {
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
      department_id: Number(departmentId),
      employee_id: employeeId || undefined,
      phone: phone || undefined,
    }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setMode('signin');
      setPassword('');
      setPasswordConfirmation('');
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const errors = e.response?.data?.errors;
      const firstError = errors ? Object.values(errors)[0]?.[0] : null;
      toast.error(firstError ?? e.response?.data?.message ?? 'Registration failed');
    },
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      toast.success('Welcome back!');
      const defaultHome = (loggedInUser.role?.slug === 'document_tracking' || loggedInUser.role?.slug === 'document_tracking_admin')
        ? '/documents'
        : loggedInUser.role?.slug === 'gso_inventory_officer'
          ? '/item-registry'
          : '/';
      navigate(redirectTo === '/' ? defaultHome : redirectTo);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      toast.error('Passwords do not match');
      return;
    }
    register.mutate();
  };

  const resetRegisterForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setPasswordConfirmation('');
    setEmployeeId('');
    setPhone('');
    setDepartmentId('');
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((prev) => !prev)}
      className="login-input-trailing"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );

  return (
    <div className="login-layout safe-top safe-bottom">
      <section className="login-form-side">
        <header className="login-topbar">
          <div className="login-topbar-brand">
            <AppLogo size="sm" className="ring-2 ring-palawan-100" />
            <span>{BRANDING.appName}</span>
          </div>
        </header>

        <div className="login-form-center">
          <div className="login-form-inner">
            <h1 className="login-heading">Welcome to {BRANDING.appName}</h1>
            <p className="login-lead">
              Start your experience with {BRANDING.officeName} by signing in or signing up.
            </p>

            <div className="login-tabs" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                className={mode === 'signin' ? 'active' : ''}
                onClick={() => setMode('signin')}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={mode === 'register' ? 'active' : ''}
                onClick={() => { setMode('register'); resetRegisterForm(); }}
              >
                Sign Up
              </button>
            </div>

            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="login-form space-y-4">
                <IconInput
                  id="login-email"
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                  autoComplete="email"
                  placeholder="Enter your email address"
                  icon={<Mail size={18} />}
                />
                <IconInput
                  id="login-password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  icon={<Lock size={18} />}
                  trailing={passwordToggle}
                />

                <div className="login-options">
                  <label className="login-remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    Remember me
                  </label>
                  <span className="text-xs text-slate-400">Contact GSO IT for password help</span>
                </div>

                <button type="submit" disabled={loading} className="login-submit">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="login-form space-y-4">
                <IconInput
                  id="register-name"
                  label="Full Name"
                  value={name}
                  onChange={setName}
                  required
                  placeholder="Enter your full name"
                  icon={<User size={18} />}
                />
                <IconInput
                  id="register-email"
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                  placeholder="Enter your email address"
                  icon={<Mail size={18} />}
                />

                <div>
                  <FieldLabel htmlFor="register-department" required>Department</FieldLabel>
                  <div className="login-input-wrap">
                    <span className="login-input-icon"><Shield size={18} /></span>
                    <select
                      id="register-department"
                      required
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="login-input login-select"
                    >
                      <option value="">Select department</option>
                      {(departments ?? []).map((d) => (
                        <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <IconInput
                    id="register-employee-id"
                    label="Employee ID"
                    value={employeeId}
                    onChange={setEmployeeId}
                    placeholder="EMP-001"
                    icon={<Hash size={18} />}
                  />
                  <IconInput
                    id="register-phone"
                    label="Phone"
                    value={phone}
                    onChange={setPhone}
                    placeholder="0917-000-0000"
                    icon={<Phone size={18} />}
                  />
                </div>

                <IconInput
                  id="register-password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={8}
                  placeholder="Create a password"
                  icon={<Lock size={18} />}
                  trailing={passwordToggle}
                />
                <IconInput
                  id="register-password-confirm"
                  label="Confirm Password"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirmation}
                  onChange={setPasswordConfirmation}
                  required
                  minLength={8}
                  placeholder="Re-enter your password"
                  icon={<Lock size={18} />}
                />

                <p className="login-note">
                  Your account will remain inactive until a system administrator approves your registration.
                </p>

                <button type="submit" disabled={register.isPending} className="login-submit">
                  {register.isPending ? 'Submitting...' : 'Sign Up'}
                </button>
              </form>
            )}
          </div>
        </div>

        <footer className="login-legal">
          <p>Copyright © {BRANDING.appName}, All Rights Reserved</p>
          <p className="login-legal-links">
            <span>Authorized personnel only</span>
            <span className="login-legal-dot">·</span>
            <span>{BRANDING.lguName}</span>
          </p>
        </footer>
      </section>

      <LoginShowcase />
    </div>
  );
}
