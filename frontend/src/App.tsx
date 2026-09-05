import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { apiListInvoices } from './lib/api';
import type { InvoiceListItem, QueueStats } from './lib/types';
import { Sidebar } from './components/layout/Sidebar';
import type { NavId } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Upload } from './pages/Upload';
import { Inbox } from './pages/Inbox';
import { Processing } from './pages/Processing';
import { ReportView } from './pages/ReportView';
import { MasterData } from './pages/MasterData';
import { Settings } from './pages/Settings';

export type Route =
  | { name: 'dashboard' }
  | { name: 'upload' }
  | { name: 'inbox' }
  | { name: 'masterdata' }
  | { name: 'settings' }
  | { name: 'processing'; invoiceId: string; jobId: string }
  | { name: 'report'; reportRunId: string };

type NavPage = Exclude<Route['name'], 'processing' | 'report'>;

const SNAPSHOT_INTERVAL_MS = 30_000;

export default function App() {
  return <Root />;
}

function Root() {
  const { user, booting } = useAuth();
  const [route, setRoute] = useState<Route>({ name: 'dashboard' });
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useCallback((name: NavPage) => {
    setRoute({ name } as Route);
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, []);
  const navigateTo = useCallback((next: Route) => {
    setRoute(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen bg-forest flex items-center justify-center">
        <p className="text-white/70 text-sm animate-pulse">Restoring your session…</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <AppShell
      route={route}
      onNavigate={navigate}
      onNavigateTo={navigateTo}
      mobileOpen={mobileOpen}
      onMobileOpenChange={setMobileOpen}
    />
  );
}

function AppShell({
  route,
  onNavigate,
  onNavigateTo,
  mobileOpen,
  onMobileOpenChange,
}: {
  route: Route;
  onNavigate: (name: NavPage) => void;
  onNavigateTo: (next: Route) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const { user, signOut } = useAuth();

  // Lightweight queue snapshot for the shell + dashboard (re-fetched on nav
  // into dashboard/inbox and refreshed periodically).
  const [snapshot, setSnapshot] = useState<{ items: InvoiceListItem[]; stats: QueueStats }>({
    items: [],
    stats: { attention: 0, processing: 0, total: 0 },
  });
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const snapshotTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      const page = await apiListInvoices({ page: 1, size: 100 });
      const items = page.items as InvoiceListItem[];
      const attention = items.filter((item) =>
        ['AWAITING_REVIEW', 'BLOCKED', 'EXTRACTION_FAILED'].includes(item.status),
      ).length;
      const processing = items.filter((item) =>
        ['RECEIVED', 'EXTRACTING', 'AI_ANALYZED', 'VALIDATING', 'CLASSIFIED', 'FAILED'].includes(item.status),
      ).length;
      setSnapshot({ items, stats: { attention, processing, total: page.total } });
    } catch {
      // Non-fatal: shell counters stay at zero when the backend is down.
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  useEffect(() => {
    if (route.name === 'dashboard' || route.name === 'inbox') {
      loadSnapshot();
    }
    if (!snapshotTimer.current) {
      snapshotTimer.current = setInterval(loadSnapshot, SNAPSHOT_INTERVAL_MS);
    }
    return () => {
      if (snapshotTimer.current) {
        clearInterval(snapshotTimer.current);
        snapshotTimer.current = null;
      }
    };
  }, [route.name, loadSnapshot]);

  const openInvoice = (invoice: InvoiceListItem) => {
    if (invoice.run?.id) {
      onNavigateTo({ name: 'report', reportRunId: invoice.run.id });
    } else if (invoice.job) {
      onNavigateTo({ name: 'processing', invoiceId: invoice.id, jobId: invoice.job.id });
    } else {
      onNavigate('inbox');
    }
  };

  const navId: NavId | null =
    route.name === 'dashboard'
      ? 'dashboard'
      : route.name === 'upload'
        ? 'upload'
        : route.name === 'inbox'
          ? 'inbox'
          : route.name === 'masterdata'
            ? 'masterdata'
            : route.name === 'settings'
              ? 'settings'
              : null;

  const contextTitle =
    route.name === 'processing'
      ? 'Processing'
      : route.name === 'report'
        ? 'Validation report'
        : undefined;

  return (
    <div className="min-h-screen bg-zinc-50/70 text-zinc-900 flex selection:bg-brand/15 selection:text-brand-deep">
      <Sidebar
        current={navId}
        onNavigate={onNavigate}
        queueStats={snapshot.stats}
        onSignOut={signOut}
      />
      <MobileNav
        isOpen={mobileOpen}
        onClose={() => onMobileOpenChange(false)}
        current={navId}
        onNavigate={onNavigate}
        queueStats={snapshot.stats}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          current={navId}
          contextTitle={contextTitle}
          onNavigate={onNavigate}
          queueAttention={snapshot.stats.attention}
          onOpenMobileMenu={() => onMobileOpenChange(true)}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-8 lg:px-12 py-10 max-w-[90rem] w-full mx-auto">
          {route.name === 'dashboard' && (
            <Dashboard
              items={snapshot.items}
              queueStats={snapshot.stats}
              loading={snapshotLoading}
              onOpenInvoice={openInvoice}
              onUpload={() => onNavigate('upload')}
              onGoInbox={() => onNavigate('inbox')}
            />
          )}

          {route.name === 'upload' && (
            <Upload
              onStarted={(invoiceId, jobId) =>
                onNavigateTo({ name: 'processing', invoiceId, jobId })
              }
              onViewInbox={() => onNavigate('inbox')}
            />
          )}

          {route.name === 'processing' && (
            <Processing
              invoiceId={route.invoiceId}
              initialJobId={route.jobId}
              onDone={(reportRunId) => onNavigateTo({ name: 'report', reportRunId })}
              onBack={() => onNavigate('inbox')}
            />
          )}

          {route.name === 'report' && (
            <ReportView
              reportRunId={route.reportRunId}
              onBack={() => onNavigate('inbox')}
              onGoInvoices={() => onNavigate('inbox')}
            />
          )}

          {route.name === 'inbox' && (
            <Inbox onOpenInvoice={openInvoice} onUpload={() => onNavigate('upload')} />
          )}

          {route.name === 'masterdata' && <MasterData />}

          {route.name === 'settings' && <Settings />}
        </main>

        {/* Current user chip is only visual sugar; role chips live in nav/settings. */}
        <span className="sr-only">Signed in as {user?.name}</span>
      </div>
    </div>
  );
}
