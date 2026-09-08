import { useState, useEffect } from 'react';
import { db } from '../db';
import { users } from '../db/schema';

import { Button } from '@fluentui/react-components';

// NEU: Nimmt den Trigger aus der App.tsx entgegen
export function ClientList({ refreshTrigger }: { refreshTrigger: number }) {
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadClients() {
    setIsLoading(true);
    try {
      const result = await db.select().from(users);
      console.log("Datenbank-Ergebnis:", result); // NEU: Damit sehen wir in F12, was wirklich ankommt!
      setClients(result);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // GEÄNDERT: react führt loadClients() jetzt jedes Mal aus, wenn sich refreshTrigger ändert
  useEffect(() => {
    loadClients();
  }, [refreshTrigger]);

  return (
    <div className="p-6 m-4 max-w-2xl bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Meine Kunden</h2>
        
        {/* Ein manueller Reload-Button, falls du nebenbei neue Kunden anlegst */}
        <Button
          onClick={loadClients}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
        >
          🔄 Aktualisieren
        </Button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Lade Kunden...</p>
      ) : clients.length === 0 ? (
        <p className="text-gray-500">Noch keine Kunden in der Datenbank.</p>
      ) : (
        <div className="space-y-6 space-x-6" >
          {clients.map((client) => (
            <Button
              key={client.id} 
              appearance="primary"
              className="p-4 border rounded hover:bg-gray-50 transition-colors flex justify-between items-center"
            >
              <div>
                <h3 className="font-semibold bg-center text-lg">{client.name}</h3>
                <p className="text-gray-600 text-sm">
                  {client.street} {client.number}, {client.zip} {client.city}
                </p>
              </div>
              <div className="text-right text-sm">
                <span className="block text-blue-600 font-medium">{client.phone}</span>
                <span className="text-gray-500">ID: {" " + client.id}</span>
              </div>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}