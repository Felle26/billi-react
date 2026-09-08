import { useState } from 'react';
import type { ComponentType } from 'react';
import { AddClientTest } from './components/AddClientTest';
import { ClientList } from './components/ClientList';

const ClientForm = AddClientTest as unknown as ComponentType<{
  onClientAdded: () => void;
}>;

const ClientListComponent = ClientList as unknown as ComponentType<{
  refreshTrigger: number;
}>;

export default function App() {
  // Eine einfache Zahl, die wir hochzählen, um ein Neuladen zu erzwingen
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        {/* Wir geben der Komponente eine Funktion mit, die aufgerufen wird, wenn gespeichert wurde */}
        <ClientForm onClientAdded={() => setRefreshTrigger(prev => prev + 1)} />
        
        {/* Wir geben der Liste den aktuellen Trigger-Wert mit */}
        <ClientListComponent refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}