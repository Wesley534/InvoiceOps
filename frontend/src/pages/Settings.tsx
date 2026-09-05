import React from 'react';
import { Activity, Database, LogOut, RefreshCw, Server, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiHealth, getApiBaseUrl } from '../lib/api';
import { useAsyncState } from '../lib/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { formatDateTime } from '../lib/format';

export const Settings: React.FC = () => {
  const { user, signOut } = useAuth();
  const { data: health, error, loading, run } = useAsyncState(() => apiHealth(), []);
  const baseUrl = getApiBaseUrl();

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Connection status for the validation backend, your account, and how this console behaves."
        actions={
          <Button variant="secondary" onClick={signOut}>
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        }
      />

      {/* Backend status */}
      <Card
        header={{
          icon: <Server className="w-4 h-4" />,
          title: 'Backend connection',
          subtitle: baseUrl,
          actions: (
            <Button size="xs" variant="secondary" onClick={run} loading={loading}>
              <RefreshCw className="w-3 h-3" />
              Re-check
            </Button>
          ),
        }}
      >
        {loading && !health ? (
          <Spinner label="Contacting the backend…" className="py-8" />
        ) : error ? (
          <Alert tone="error" title="Backend unreachable">
            {error.message}
            <p className="mt-1">
              Start the FastAPI backend (see the repo README) and set{' '}
              <code className="font-mono bg-zinc-100 rounded px-1 py-0.5">VITE_API_URL</code> in{' '}
              <code className="font-mono bg-zinc-100 rounded px-1 py-0.5">frontend/.env.local</code> if it is not at{' '}
              {baseUrl}. The backend also needs this frontend origin in its{' '}
              <code className="font-mono bg-zinc-100 rounded px-1 py-0.5">CORS_ORIGINS</code>.
            </p>
          </Alert>
        ) : health ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { label: 'API', value: health.status, tone: health.success ? 'mint' as const : 'signal' as const },
                { label: 'Database', value: health.database, tone: health.database === 'ok' ? 'mint' as const : 'signal' as const },
                { label: 'AI extraction', value: health.llm_enabled ? 'Enabled' : 'Deterministic only', tone: health.llm_enabled ? 'mint' as const : 'neutral' as const },
                { label: 'Master data', value: health.master_data_loaded ? 'Loaded' : 'Missing', tone: health.master_data_loaded ? 'mint' as const : 'amber' as const },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-zinc-50/80 border border-zinc-100 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{item.label}</p>
                  <Badge tone={item.tone} size="sm" className="mt-1.5">{item.value}</Badge>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-zinc-500">
              <div><p className="font-bold text-zinc-400 uppercase tracking-wider mb-0.5">App</p>{health.app}</div>
              <div><p className="font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Version</p>{health.version}</div>
              <div><p className="font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Environment</p>{health.environment}</div>
              <div><p className="font-bold text-zinc-400 uppercase tracking-wider mb-0.5">LLM</p>{health.llm_enabled ? 'Enabled' : 'Deterministic-only mode'}</div>
            </div>

            <div className="border-t border-zinc-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                <Database className="w-3 h-3" /> Master-data register rows
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(health.master_data_counts).length === 0 ? (
                  <span className="text-xs text-zinc-400">No registers reported — run the master-data import on the backend.</span>
                ) : (
                  Object.entries(health.master_data_counts).map(([name, count]) => (
                    <span key={name} className="inline-flex items-center gap-1.5 text-xs bg-mint border border-brand/15 rounded-lg px-2.5 py-1.5">
                      <span className="font-bold text-brand-deep tabular-nums">{count}</span>
                      <span className="text-zinc-500 capitalize">{name.replaceAll('_', ' ')}</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Account */}
      <Card
        header={{ icon: <UserIcon className="w-4 h-4" />, title: 'Signed-in account', subtitle: 'Your role decides what you can do' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Name</p>
            <p className="font-semibold text-zinc-900">{user?.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Email</p>
            <p className="font-semibold text-zinc-900">{user?.email}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Role</p>
            <Badge tone={user?.role === 'approver' ? 'forest' : 'neutral'}>{user?.role}</Badge>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Account created</p>
            <p className="font-medium text-zinc-700">{user ? formatDateTime(user.created_at) : '—'}</p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-zinc-100 flex items-start gap-2.5 text-xs text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-brand shrink-0 mt-px" />
          <p className="leading-relaxed">
            <strong className="text-zinc-700">Reviewers</strong> upload, inspect reports and correct extracted fields.
            <strong className="text-zinc-700"> Approvers</strong> additionally make the final approve / reject call and can
            override a BLOCK with a written reason. Roles are enforced server-side — the UI never grants them.
          </p>
        </div>
      </Card>

      {/* About */}
      <Card header={{ icon: <Activity className="w-4 h-4" />, title: 'About this console' }}>
        <div className="space-y-3 text-xs text-zinc-600 leading-relaxed">
          <p>
            This is the operator console for an AI-assisted vendor-invoice validation system. A single PDF in,
            one repeatable pipeline: intake → extraction → 11 deterministic checks → PASS · REVIEW · BLOCK
            classification → evidence report → a human decision.
          </p>
          <p>
            The decision path never touches a model — extraction may be AI-assisted, every rule and threshold is
            deterministic application logic, and the model can propose fields but never change a rule or a state.
          </p>
          <p className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
            Every meaningful action is appended to the audit log on the backend.
          </p>
        </div>
      </Card>
    </div>
  );
};
