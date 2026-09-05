import React, { useState } from 'react';
import { FileCheck2, ShieldCheck, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Field';
import { Alert } from '../components/ui/Alert';
import { Segmented } from '../components/ui/Segmented';

type Mode = 'signin' | 'register';

export const Auth: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Enter your full name.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp({ email: email.trim(), name: name.trim(), password });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const fillSeed = (which: 'reviewer' | 'approver') => {
    if (mode !== 'signin') setMode('signin');
    setEmail(which === 'reviewer' ? 'reviewer@invoiceops.dev' : 'approver@invoiceops.dev');
    setPassword(which === 'reviewer' ? 'ReviewerPass2026' : 'ApproverPass2026');
    setError(null);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] xl:w-[40%] bg-forest text-white p-10 xl:p-14 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
            <FileCheck2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="font-extrabold text-lg tracking-tight leading-none">
              Invoice<span className="text-accent">Ops</span>
            </p>
            <p className="text-[11px] text-white/55 mt-1">Vendor invoice pre-approval validation</p>
          </div>
        </div>

        <div className="relative space-y-8">
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.08]">
            Every invoice checked.
            <br />
            <span className="text-accent">Every payment decided by a human.</span>
          </h1>
          <div className="space-y-4">
            {[
              { icon: Sparkles, title: 'AI-assisted extraction', text: 'Reads the PDF and repairs ambiguous fields — the decision path stays 100% deterministic.' },
              { icon: FileCheck2, title: '11 evidence-backed checks', text: 'Cross-checks vendors, purchase orders, goods receipts and payment history.' },
              { icon: ShieldCheck, title: 'PASS · REVIEW · BLOCK', text: 'Advisory recommendation plus an evidence package. Approvers make the final call.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="text-xs text-white/60 leading-relaxed mt-0.5 max-w-md">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-white/40">Applies the invoice-processing policy: nothing is ever paid automatically.</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-forest flex items-center justify-center">
              <FileCheck2 className="w-4 h-4 text-accent" />
            </div>
            <p className="font-extrabold text-base tracking-tight text-ink">
              Invoice<span className="text-brand">Ops</span>
            </p>
          </div>

          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            className="mb-6"
            options={[
              { value: 'signin', label: 'Sign in' },
              { value: 'register', label: 'Create reviewer account' },
            ]}
          />

          <h2 className="text-2xl font-bold tracking-tight text-ink">
            {mode === 'signin' ? 'Welcome back' : 'New reviewer account'}
          </h2>
          <p className="text-sm text-zinc-500 mt-1 mb-6">
            {mode === 'signin'
              ? 'Sign in to review invoices and manage the queue.'
              : 'Self-registration always creates a reviewer — approvers are provisioned by an operator.'}
          </p>

          {error && (
            <Alert tone="error" className="mb-4" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <Field label="Full name" required>
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Reviewer"
                  autoComplete="name"
                />
              </Field>
            )}
            <Field label="Email" required>
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Password" required>
              <div className="relative">
                <TextInput
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <Button type="submit" fullWidth size="lg" loading={busy}>
              {mode === 'signin' ? 'Sign in' : 'Create account & sign in'}
            </Button>
          </form>

          <div className="mt-7 pt-6 border-t border-zinc-100">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
              Try with the seeded accounts
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => fillSeed('reviewer')}
                className="text-left rounded-xl border border-zinc-200 bg-zinc-50/70 hover:border-brand/40 hover:bg-mint px-3.5 py-2.5 transition-colors"
              >
                <span className="block text-xs font-bold text-zinc-800">Reviewer</span>
                <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">reviewer@invoiceops.dev</span>
              </button>
              <button
                onClick={() => fillSeed('approver')}
                className="text-left rounded-xl border border-zinc-200 bg-zinc-50/70 hover:border-brand/40 hover:bg-mint px-3.5 py-2.5 transition-colors"
              >
                <span className="block text-xs font-bold text-zinc-800">Approver</span>
                <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">approver@invoiceops.dev</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 mt-2 leading-relaxed">
              Passwords: ReviewerPass2026 / ApproverPass2026. The one-click fill keeps demo sign-in fast; change
              these on the backend before real use.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
