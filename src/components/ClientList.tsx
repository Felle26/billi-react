import { useState, useEffect } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '../db'; 
import { users } from '../db/schema'; 
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHeaderCell, 
  TableBody, 
  TableCell, 
  TableCellLayout,
  Button,
  Spinner
} from '@fluentui/react-components';
import { Delete20Regular } from '@fluentui/react-icons';

export function ClientList({ refreshTrigger }: { refreshTrigger: number }) {
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Daten aus der SQLite-Datenbank laden
  async function loadClients() {
    setIsLoading(true);
    try {
      const result = await db.select().from(users);
      setClients(result);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Kunden aus der Datenbank löschen
  async function handleDelete(id: number, name: string) {
    const confirmed = window.confirm(`Möchtest du den Kunden "${name}" wirklich löschen?`);
    if (!confirmed) return;

    try {
      await db.delete(users).where(eq(users.id, id));
      await loadClients();
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      alert("Fehler beim Löschen des Kunden.");
    }
  }

  // Wird aufgerufen, wenn die Komponente lädt oder refreshTrigger sich ändert (nach dem Speichern)
  useEffect(() => {
    loadClients();
  }, [refreshTrigger]);

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Spinner label="Lade Datenbank..." /></div>;
  }

  if (clients.length === 0) {
    return <p className="text-gray-500 p-4">Noch keine Kunden in der Datenbank vorhanden.</p>;
  }

  return (
    // Die Tabelle passt sich automatisch dem verfügbaren Platz an
    <Table aria-label="Kunden Datenbank Tabelle">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>ID</TableHeaderCell>
          <TableHeaderCell>Name / Firma</TableHeaderCell>
          <TableHeaderCell>Adresse</TableHeaderCell>
          <TableHeaderCell>Kontakt</TableHeaderCell>
          <TableHeaderCell style={{ width: '80px' }}>Aktionen</TableHeaderCell>
        </TableRow>
      </TableHeader>

      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            
            <TableCell>{client.id}</TableCell>
            
            <TableCell>
              {/* TableCellLayout ist super, um Icon und Text zu mischen oder Text fett zu machen */}
              <TableCellLayout appearance="primary" className="font-semibold">
                {client.name}
              </TableCellLayout>
            </TableCell>
            
            <TableCell>
              {client.street} {client.number}, <br/> {client.zip} {client.city}
            </TableCell>
            
            <TableCell>
              <div className="flex flex-col">
                <span className="text-blue-600">{client.phone}</span>
                <span className="text-sm text-gray-500">{client.email || '-'}</span>
              </div>
            </TableCell>
            
            <TableCell>
              <Button 
                appearance="subtle" 
                icon={<Delete20Regular className="text-red-500" />} 
                onClick={() => handleDelete(client.id, client.name)}
                title="Löschen"
              />
            </TableCell>

          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}