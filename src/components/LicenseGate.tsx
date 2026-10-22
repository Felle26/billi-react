import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button, Input, Spinner } from '@fluentui/react-components';

export interface LicenseStatus {
  kind: 'trial' | 'perpetual' | 'subscription';
  product: string;
  expiresAt: string | null;
  daysLeft: number | null;
  offline: boolean;
}

const RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

type TrialOffer = 'available' | 'running' | 'used' | 'unknown';

type StartupState =
  | { state: 'active'; status: LicenseStatus }
  | { state: 'dialog'; message: string | null; trial: TrialOffer }
  | { state: 'trialExpired'; message: string }
  | { state: 'offlineExpired'; message: string };

type Screen =
  | { name: 'checking' }
  | { name: 'active'; status: LicenseStatus }
  | { name: 'dialog'; message: string | null; trial: TrialOffer; step: 'choice' | 'key'; cancelTo?: LicenseStatus }
  | { name: 'trialExpired'; message: string }
  | { name: 'offlineExpired'; message: string };

interface LicenseContextValue {
  status: LicenseStatus;
  openShop: () => void;
  enterKey: () => void;
  deactivate: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function useLicenseStatus() {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicenseStatus muss innerhalb des LicenseGate verwendet werden.');
  }
  return context;
}

export function licenseTypeLabel(kind: LicenseStatus['kind']) {
  if (kind === 'trial') return 'Testversion';
  return kind === 'perpetual' ? 'Dauerlizenz' : 'Abonnement';
}

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return typeof error === 'string' ? error : 'Ein unerwarteter Fehler ist aufgetreten.';
}

function openPage(page: 'shop' | 'account') {
  void invoke('license_open_page', { page }).catch((error) => console.error(error));
}

function fromStartup(result: StartupState): Screen {
  switch (result.state) {
    case 'active':
      return { name: 'active', status: result.status };
    case 'dialog':
      return { name: 'dialog', message: result.message, trial: result.trial, step: 'choice' };
    case 'trialExpired':
      return { name: 'trialExpired', message: result.message };
    case 'offlineExpired':
      return { name: 'offlineExpired', message: result.message };
  }
}

export function LicenseGate({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>({ name: 'checking' });

  const check = useCallback(async () => {
    setScreen({ name: 'checking' });
    try {
      setScreen(fromStartup(await invoke<StartupState>('license_startup')));
    } catch (error) {
      setScreen({ name: 'dialog', message: errorMessage(error), trial: 'unknown', step: 'choice' });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const isActive = screen.name === 'active';
  useEffect(() => {
    if (!isActive) return;
    // Stille Neuprüfung: die App bleibt gemountet, solange die Lizenz gültig ist.
    const timer = window.setInterval(() => {
      invoke<StartupState>('license_startup')
        .then((result) => setScreen(fromStartup(result)))
        .catch((error) => console.error('Lizenz-Neuprüfung fehlgeschlagen:', error));
    }, RECHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isActive]);

  if (screen.name === 'active') {
    const status = screen.status;
    return (
      <LicenseContext.Provider
        value={{
          status,
          openShop: () => openPage('shop'),
          enterKey: () =>
            setScreen({ name: 'dialog', message: null, trial: 'used', step: 'key', cancelTo: status }),
          deactivate: async () => {
            await invoke('license_deactivate');
            await check();
          },
        }}
      >
        {children}
      </LicenseContext.Provider>
    );
  }

  if (screen.name === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Lizenz wird geprüft…" />
      </div>
    );
  }

  if (screen.name === 'offlineExpired') {
    return (
      <CenteredCard title="Lizenz nicht bestätigt">
        <p className="text-sm">{screen.message}</p>
        <Button appearance="primary" onClick={() => void check()}>
          Erneut versuchen
        </Button>
      </CenteredCard>
    );
  }

  if (screen.name === 'trialExpired') {
    return (
      <CenteredCard title="Testzeitraum abgelaufen">
        <p className="text-sm">{screen.message}</p>
        <Button appearance="primary" onClick={() => openPage('shop')}>
          Lizenz kaufen
        </Button>
        <Button
          appearance="secondary"
          onClick={() => setScreen({ name: 'dialog', message: null, trial: 'used', step: 'key' })}
        >
          Key eingeben
        </Button>
      </CenteredCard>
    );
  }

  return (
    <ActivationDialog
      message={screen.message}
      trial={screen.trial}
      initialStep={screen.step}
      onCancel={screen.cancelTo ? () => setScreen({ name: 'active', status: screen.cancelTo! }) : undefined}
      onRetry={() => void check()}
      onResult={(next) => setScreen(next)}
    />
  );
}

function CenteredCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-background)] px-4 py-10 text-[var(--app-foreground)]">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

interface ActivationDialogProps {
  message: string | null;
  trial: TrialOffer;
  initialStep: 'choice' | 'key';
  onCancel?: () => void;
  onRetry: () => void;
  onResult: (screen: Screen) => void;
}

function ActivationDialog({ message, trial, initialStep, onCancel, onRetry, onResult }: ActivationDialogProps) {
  const [step, setStep] = useState<'choice' | 'key'>(initialStep);
  const [key, setKey] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const startTrial = () =>
    run(async () => {
      onResult(fromStartup(await invoke<StartupState>('license_start_trial')));
    });

  const requestCode = () =>
    run(async () => {
      await invoke('license_request_code', { key: key.trim(), email: email.trim() });
      setCodeRequested(true);
      setNotice(
        'Wenn Schlüssel und E-Mail-Adresse zusammenpassen, haben wir dir einen 6-stelligen Code geschickt.',
      );
    });

  const activate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!codeRequested) {
      void requestCode();
      return;
    }
    void run(async () => {
      const status = await invoke<LicenseStatus>('license_activate', {
        key: key.trim(),
        email: email.trim(),
        code: code.trim(),
      });
      onResult({ name: 'active', status });
    });
  };

  const shownMessage = error ?? message;
  const trialLabel = trial === 'running' ? 'Testversion fortsetzen' : '14 Tage kostenlos testen';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-background)] px-4 py-10 text-[var(--app-foreground)]">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Billi aktivieren</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Teste Billi kostenlos oder aktiviere deinen Lizenzschlüssel.
          </p>
        </div>

        {shownMessage && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            {shownMessage}
          </p>
        )}
        {notice && !error && (
          <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
            {notice}
          </p>
        )}

        {step === 'choice' ? (
          <div className="flex flex-col gap-3">
            {(trial === 'available' || trial === 'running') && (
              <Button appearance="primary" disabled={busy} onClick={() => void startTrial()}>
                {busy ? 'Bitte warten…' : trialLabel}
              </Button>
            )}
            {trial === 'used' && (
              <p className="text-center text-sm text-gray-600 dark:text-gray-300">
                Der Testzeitraum wurde auf diesem Gerät bereits genutzt.
              </p>
            )}
            {trial === 'unknown' && (
              <Button appearance="secondary" disabled={busy} onClick={onRetry}>
                Verbindung erneut prüfen
              </Button>
            )}
            <Button appearance={trial === 'available' || trial === 'running' ? 'secondary' : 'primary'} onClick={() => setStep('key')}>
              Lizenzschlüssel eingeben
            </Button>
            <Button appearance="secondary" onClick={() => openPage('shop')}>
              Lizenz kaufen
            </Button>
          </div>
        ) : (
          <form onSubmit={activate} className="flex flex-col gap-3">
            <label className="block space-y-1 text-sm font-medium">
              Lizenzschlüssel
              <Input
                className="w-full"
                value={key}
                onChange={(_, data) => setKey(data.value)}
                autoComplete="off"
                required
                disabled={codeRequested}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              E-Mail-Adresse des Käufers
              <Input
                className="w-full"
                type="email"
                value={email}
                onChange={(_, data) => setEmail(data.value)}
                autoComplete="email"
                required
                disabled={codeRequested}
              />
            </label>
            {codeRequested && (
              <label className="block space-y-1 text-sm font-medium">
                Aktivierungscode (6 Ziffern)
                <Input
                  className="w-full"
                  value={code}
                  onChange={(_, data) => setCode(data.value)}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                />
              </label>
            )}
            <Button
              appearance="primary"
              type="submit"
              disabled={busy || !key.trim() || !email.trim() || (codeRequested && code.trim().length < 6)}
            >
              {busy ? 'Bitte warten…' : codeRequested ? 'Aktivieren' : 'Code anfordern'}
            </Button>
            {codeRequested && (
              <Button appearance="subtle" disabled={busy} onClick={() => void requestCode()}>
                Code erneut senden
              </Button>
            )}
            <Button
              appearance="subtle"
              onClick={() => {
                setStep('choice');
                setCodeRequested(false);
                setCode('');
                setError(null);
                setNotice(null);
              }}
            >
              Zurück
            </Button>
          </form>
        )}

        {onCancel && (
          <Button appearance="subtle" className="w-full" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
      </div>
    </main>
  );
}
