import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, Spinner } from '@fluentui/react-components';
import { deactivatePostgres, initDatabaseBackend } from '../db';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function DatabaseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const connect = useCallback(async () => {
    setState('loading');
    try {
      await initDatabaseBackend();
      setState('ready');
    } catch (e) {
      setError(messageOf(e));
      setState('error');
    }
  }, []);

  useEffect(() => {
    void connect();
  }, [connect]);

  async function useLocalDatabase() {
    try {
      await deactivatePostgres();
      await connect();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  if (state === 'ready') return <>{children}</>;

  if (state === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Datenbank wird verbunden…" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">PostgreSQL-Datenbank nicht erreichbar</h1>
      <p role="alert" className="max-w-xl text-sm text-red-600">{error}</p>
      <p className="max-w-xl text-sm">
        Es wird bewusst nicht automatisch auf die lokale Datenbank gewechselt, damit keine
        Daten auseinanderlaufen.
      </p>
      <div className="flex gap-2">
        <Button appearance="primary" onClick={() => void connect()}>Erneut versuchen</Button>
        <Button appearance="secondary" onClick={() => void useLocalDatabase()}>
          Lokale Datenbank verwenden
        </Button>
      </div>
    </div>
  );
}
