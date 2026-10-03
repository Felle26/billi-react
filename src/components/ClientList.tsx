import { useState, useEffect } from 'react';
import { desc, eq } from 'drizzle-orm';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { db } from '../db'; 
import { users, invoices, invoiceItems, products } from '../db/schema';
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
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  Dropdown,
  Option,
} from '@fluentui/react-components';
import { Delete20Regular, Search20Regular, Edit20Regular, History20Regular, ChevronRight20Regular } from '@fluentui/react-icons';

interface ClientListProps { 
  refreshTrigger: number;
  onEditClient: (client: any) => void;
}

export function ClientList({ refreshTrigger, onEditClient }: ClientListProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceClient, setInvoiceClient] = useState<any | null>(null);
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [invoiceYear, setInvoiceYear] = useState(String(new Date().getFullYear()));

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

  async function handleShowInvoices(client: any) {
    setInvoiceClient(client);
    setClientInvoices([]);
    setInvoiceYear(String(new Date().getFullYear()));
    setIsLoadingInvoices(true);
    try {
      const result = await db
        .select({
          id: invoiceItems.id,
          productId: invoiceItems.product_id,
          productName: invoiceItems.product_name,
          catalogProductName: products.name,
          invoiceNumber: invoices.invoice_number,
          createdAt: invoices.created_at,
          quantity: invoiceItems.quantity,
        })
        .from(invoiceItems)
        .innerJoin(invoices, eq(invoiceItems.invoice_id, invoices.id))
        .leftJoin(products, eq(invoiceItems.product_id, products.id))
        .where(eq(invoices.user_id, client.id))
        .orderBy(desc(invoices.created_at), desc(invoices.id), invoiceItems.id);
      setClientInvoices(result);
    } catch (error) {
      console.error('Fehler beim Laden der Kundenrechnungen:', error);
    } finally {
      setIsLoadingInvoices(false);
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
  const availableInvoiceYears = Array.from(new Set([
    new Date().getFullYear(),
    ...clientInvoices
      .filter((invoice) => invoice.createdAt)
      .map((invoice) => new Date(invoice.createdAt).getFullYear()),
  ])).sort((left, right) => right - left);
  const filteredClientInvoices = invoiceYear === 'all'
    ? clientInvoices
    : clientInvoices.filter((invoice) => invoice.createdAt && new Date(invoice.createdAt).getFullYear() === Number(invoiceYear));
  const groupedInvoiceProducts = Array.from(filteredClientInvoices.reduce<Map<string, { key: string; productName: string; totalQuantity: number; invoices: any[] }>>((groups, invoice) => {
    const productName = invoice.productName || invoice.catalogProductName || 'Unbekanntes Produkt';
    const key = invoice.productId === null
      ? `custom:${productName.toLocaleLowerCase()}`
      : `product:${invoice.productId}`;
    const group: { key: string; productName: string; totalQuantity: number; invoices: any[] } = groups.get(key) ?? {
      key,
      productName,
      totalQuantity: 0,
      invoices: [],
    };
    group.totalQuantity += Number(invoice.quantity ?? 0);
    group.invoices.push(invoice);
    groups.set(key, group);
    return groups;
  }, new Map()).values())
    .sort((left, right) => left.productName.localeCompare(right.productName, 'de'));

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
              <TableHeaderCell style={{ width: '150px' }}>Aktionen</TableHeaderCell>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => {
                const fullName = `${client.first_name} ${client.last_name}`.trim();
                return (
                <TableRow key={client.company_id} className="scroll-animation">
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
                    <div className="flex items-center gap-1">
                      <Button
                        appearance="subtle"
                        icon={<History20Regular />}
                        onClick={() => void handleShowInvoices(client)}
                        title="Rechnungen anzeigen"
                        aria-label={`Rechnungen von ${client.company_name || fullName} anzeigen`}
                      />
                      <Button
                        appearance="subtle"
                        icon={<Edit20Regular className="text-blue-500" />}
                        onClick={() => onEditClient(client)}
                        title="Bearbeiten"
                        aria-label={`${client.company_name || fullName} bearbeiten`}
                      />
                      <Button
                        appearance="subtle"
                        icon={<Delete20Regular className="text-red-500" />}
                        onClick={() => handleDelete(client.id, fullName)}
                        title="Löschen"
                        aria-label={`${client.company_name || fullName} löschen`}
                      />
                    </div>
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

      <Dialog open={invoiceClient !== null} onOpenChange={(_, data) => {
        if (!data.open) setInvoiceClient(null);
      }}>
        <DialogSurface className="max-w-2xl">
          <DialogBody>
            <DialogTitle>
              Rechnungspositionen: {invoiceClient?.company_name || `${invoiceClient?.first_name || ''} ${invoiceClient?.last_name || ''}`.trim()}
            </DialogTitle>
            <DialogContent className="pt-4">
              {isLoadingInvoices ? (
                <div className="flex justify-center p-6"><Spinner label="Lade Rechnungen..." /></div>
              ) : (
                <div>
                  <div className="mb-3 flex items-center justify-end gap-2">
                    <Dropdown
                      aria-label="Jahr auswählen"
                      className="min-w-32"
                      value={invoiceYear === 'all' ? 'Alle Jahre' : invoiceYear}
                      selectedOptions={[invoiceYear]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) setInvoiceYear(data.optionValue);
                      }}
                    >
                      <Option value="all">Alle Jahre</Option>
                      {availableInvoiceYears.map((year) => <Option key={year} value={String(year)} text={String(year)}>{year}</Option>)}
                    </Dropdown>
                  </div>
                  {clientInvoices.length === 0 ? (
                    <p className="py-6 text-center text-gray-500">Für diesen Kunden sind keine gespeicherten Produktpositionen vorhanden.</p>
                  ) : groupedInvoiceProducts.length === 0 ? (
                    <p className="py-6 text-center text-gray-500">Keine Produktpositionen für {invoiceYear} vorhanden.</p>
                  ) : (
                    <div className="max-h-[60vh] divide-y divide-gray-200 overflow-y-auto dark:divide-gray-700">
                      {groupedInvoiceProducts.map((product) => (
                        <details key={product.key} className="group">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3">
                            <span className="flex min-w-0 items-center gap-2">
                              <ChevronRight20Regular className="shrink-0 transition-transform group-open:rotate-90" />
                              <span className="truncate font-medium">{product.productName}</span>
                            </span>
                            <span className="shrink-0 text-xs text-gray-500">
                              {product.invoices.length} {product.invoices.length === 1 ? 'Rechnung' : 'Rechnungen'}
                              {' · '}Gesamtmenge {product.totalQuantity.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                            </span>
                          </summary>
                          <div className="mb-3 ml-7 overflow-x-auto rounded border border-gray-100 dark:border-gray-700">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                  <th className="px-3 py-2 font-medium">Rechnung</th>
                                  <th className="px-3 py-2 font-medium">Datum</th>
                                  <th className="px-3 py-2 text-right font-medium">Menge</th>
                                </tr>
                              </thead>
                              <tbody>
                                {product.invoices.map((invoice) => (
                                  <tr key={invoice.id} className="border-t border-gray-100 dark:border-gray-700">
                                    <td className="px-3 py-2">{invoice.invoiceNumber || 'Rechnung'}</td>
                                    <td className="whitespace-nowrap px-3 py-2">
                                      {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('de-DE') : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right">{Number(invoice.quantity ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 2 })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>

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