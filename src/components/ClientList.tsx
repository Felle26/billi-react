import { useState, useEffect } from 'react';
import { eq } from 'drizzle-orm';
import { ask, message } from '@tauri-apps/plugin-dialog';
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
  Spinner,
  Input,
} from '@fluentui/react-components';
import { Delete20Regular, Search20Regular, Edit20Regular } from '@fluentui/react-icons';

interface ClientListProps { 
  refreshTrigger: number;
  onEditClient: (client: any) => void;
}

export function ClientList({ refreshTrigger, onEditClient }: ClientListProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  async function handleDelete(id: number, name: string) {
    const confirmed = await ask(`Möchtest du den Kunden "${name}" wirklich löschen?`, { title: 'Kunde löschen', kind: 'warning' });
    if (!confirmed) return;

    try {
      await db.delete(users).where(eq(users.id, id));
      await loadClients();
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      await message("Fehler beim Löschen des Kunden.", { title: 'Fehler', kind: 'error' });
    }
  }

  useEffect(() => {
    loadClients();
  }, [refreshTrigger]);

  const filteredClients = clients.filter(client =>
    `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Kundenliste ({filteredClients.length})
        </h2>
        
        <Input 
          contentBefore={<Search20Regular />} 
          placeholder="Firma, Name oder Ort suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-72" 
        />
      </div>

      <div className={`text-gray-900 dark:text-gray-100 ${(!isLoading && filteredClients.length === 0) ? "hidden" : "block"}`}>
        <Table arial-label="Kunden Datenbank Tabelle">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Kundennummer</TableHeaderCell>
              <TableHeaderCell>Firma / Name</TableHeaderCell>
              <TableHeaderCell>Adresse</TableHeaderCell>
              <TableHeaderCell>Kontakt</TableHeaderCell>
              <TableHeaderCell style={{ width: '80px' }}>Aktionen</TableHeaderCell>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => {
                const fullName = `${client.first_name} ${client.last_name}`.trim();
                return (
                <TableRow key={client.company_id}>
                  <TableCell>{client.company_id}</TableCell>
                  <TableCell>
                    <TableCellLayout appearance="primary" className="font-semibold">
                      {client.company_name || fullName}
                    </TableCellLayout>
                    {client.company_name && (
                      <div className="text-sm text-gray-500">{fullName}</div>
                    )}
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
                      icon={<Edit20Regular className="text-blue-500" />} 
                      onClick={() => onEditClient(client)}
                      title="Bearbeiten"
                    />
                    <Button 
                      appearance="subtle" 
                      icon={<Delete20Regular className="text-red-500" />} 
                      onClick={() => handleDelete(client.id, fullName)}
                      title="Löschen"
                    />
                  </TableCell>
                </TableRow>
                );
              })
            ) : (
              // DER RETTER IN DER NOT: Eine Dummy-Reihe, damit Fluent UI beim Rendern nicht abstürzt
              <TableRow>
                <TableCell>0</TableCell>
                <TableCell>Dummy</TableCell>
                <TableCell>Dummy</TableCell>
                <TableCell>Dummy</TableCell>
                <TableCell>Dummy</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 3. MELDUNGEN: Werden elegant eingeblendet */}
      {isLoading && (
        <div className="p-4 flex justify-center"><Spinner label="Lade Datenbank..." /></div>
      )}
      
      {!isLoading && clients.length === 0 && (
        <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          Noch keine Kunden in der Datenbank vorhanden.
        </div>
      )}
      
      {!isLoading && clients.length > 0 && filteredClients.length === 0 && (
        <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          Keine Kunden für "{searchTerm}" gefunden.
        </div>
      )}
      
    </div>
  );
}