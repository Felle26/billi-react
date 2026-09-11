import { useState, useEffect } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { objects, users } from '../db/schema';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { 
  Button, Spinner, Input 
} from '@fluentui/react-components';
import { Delete20Regular, Search20Regular, Edit20Regular, Building20Regular } from '@fluentui/react-icons';

interface ObjectListProps {
  refreshTrigger: number;
  onEditObject: (obj: any) => void;
}

export function ObjectList({ refreshTrigger, onEditObject }: ObjectListProps) {
  const [objectData, setObjectData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  async function loadObjects() {
    setIsLoading(true);
    try {
      // Wir laden gezielt die neuen Felder aus der users-Tabelle mit
      const result = await db
        .select({
          object: objects,
          companyName: users.company_name,
          firstName: users.first_name,
          lastName: users.last_name,
        })
        .from(objects)
        .leftJoin(users, eq(objects.user_id, users.id));
      
      const formattedData = result.map(row => {
        // Den vollen Namen aus Vor- und Nachname zusammensetzen[cite: 3]
        const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim();
        
        // ENTWEDER Firmenname ODER den vollen Namen nutzen
        const finalName = row.companyName || fullName || 'Unbekannter Kunde';

        return {
          ...row.object,
          customerName: finalName
        };
      });

      setObjectData(formattedData);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    const confirmed = await ask(`Möchtest du das Objekt "${name}" wirklich löschen?`, { title: 'Objekt löschen', kind: 'warning' });
    if (!confirmed) return;

    try {
      await db.delete(objects).where(eq(objects.id, id));
      await loadObjects();
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      await message("Fehler beim Löschen.", { title: 'Fehler', kind: 'error' });
    }
  }

  useEffect(() => {
    loadObjects();
  }, [refreshTrigger]);

  // Sicherer Filter gegen Abstürze bei leeren Feldern
  const filteredObjects = objectData.filter(obj => 
    (obj.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (obj.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (obj.customerName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      
      {/* TOOLBAR */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Objekte ({filteredObjects.length})
        </h2>
        
        <Input 
          contentBefore={<Search20Regular />} 
          placeholder="Objekt, Ort oder Kunde suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-72" 
        />
      </div>

      {/* CARD GRID */}
      <div className={(!isLoading && filteredObjects.length === 0) ? "hidden" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
        {filteredObjects.length > 0 ? (
          filteredObjects.map((obj) => (
            <div 
              key={obj.id} 
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow relative group"
            >
              {/* Header der Card: Name & Kunde */}
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Building20Regular className="text-gray-400" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1" title={obj.name}>
                      {obj.name}
                    </h3>
                  </div>
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1">
                    {obj.customerName}
                  </span>
                </div>
              </div>

              <hr className="border-gray-100 dark:border-gray-800 my-1" />

              {/* Body der Card: Adresse & Notizen */}
              <div className="text-sm text-gray-600 dark:text-gray-400 flex flex-col gap-1 grow">
                <p>{obj.street} {obj.number}</p>
                <p>{obj.zip} {obj.city}</p>
                
                {obj.description && (
                  <p className="mt-3 text-xs italic text-gray-500 dark:text-gray-500 line-clamp-2" title={obj.description}>
                    "{obj.description}"
                  </p>
                )}
              </div>

              {/* Aktionen (Buttons) - Unten rechts ausgerichtet */}
              <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-gray-50 dark:border-gray-800/50">
                <Button 
                  appearance="subtle" 
                  icon={<Edit20Regular className="text-blue-500" />} 
                  onClick={() => onEditObject(obj)}
                  title="Bearbeiten"
                />
                <Button 
                  appearance="subtle" 
                  icon={<Delete20Regular className="text-red-500" />} 
                  onClick={() => handleDelete(obj.id, obj.name)}
                  title="Löschen"
                />
              </div>
            </div>
          ))
        ) : (
           // Dummy-Card als Fallback für FluentUI/React Stabilität (versteckt durch 'hidden' im parent)
           <div>Dummy</div>
        )}
      </div>

      {/* MELDUNGEN */}
      {isLoading && (
        <div className="p-8 flex justify-center"><Spinner label="Lade Objekte..." /></div>
      )}
      
      {!isLoading && objectData.length === 0 && (
        <div className="p-12 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          Noch keine Objekte vorhanden. Klicke oben auf "Neues Objekt anlegen".
        </div>
      )}
      
      {!isLoading && objectData.length > 0 && filteredObjects.length === 0 && (
        <div className="p-12 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          Keine Objekte für "{searchTerm}" gefunden.
        </div>
      )}

    </div>
  );
}