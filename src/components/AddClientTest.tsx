import { useState } from 'react';
import { db } from '../db'; 
import { users } from '../db/schema'; 
import { Button } from '@fluentui/react-components';

// NEU: Wir definieren, dass die Komponente einen Prop erwartet
export function AddClientTest({ onClientAdded }: { onClientAdded: () => void }) {
  const [status, setStatus] = useState<string>('');

  async function handleAddClient() {
    setStatus('Speichere...');
    try {
      await db.insert(users).values({
        company_name: 'Glanz & Sauber Gebäudereinigung',
        first_name: '',
        last_name: '',
        street: 'Wilsdruffer Str.',
        number: '12a',
        zip: '01705',
        city: 'Freital',
        phone: '0152 12345678',
        email: 'kontakt@glanz-und-sauber.de',
      });

      setStatus('🎉 Kunde erfolgreich gespeichert!');
      
      // NEU: Wir rufen die Funktion aus der App.tsx auf!
      onClientAdded(); 
      
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      setStatus('❌ Fehler beim Speichern. (Siehe F12 Konsole)');
    }
  }

  return (
    <div className="p-6 m-4 max-w-sm bg-white border border-gray-200 rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Datenbank-Test</h2>
      
        <Button 
          onClick={handleAddClient}
          className="w-full px-4 py-2 mb-4 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
        >
          Test-Kunden anlegen
        </Button>
      
      {/* Zeigt die Erfolgs- oder Fehlermeldung an */}
      {status && (
        <div className={`p-3 rounded ${status.includes('🎉') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {status}
        </div>
      )}
    </div>
  );
}