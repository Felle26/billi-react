import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Spinner } from '@fluentui/react-components';
import {
  Add20Regular,
  Delete20Regular,
  Eye20Regular,
  Open20Regular,
  Dismiss20Regular,
  Document20Regular,
  CheckmarkCircle20Regular,
  Clock20Regular,
  Filter20Regular,
} from '@fluentui/react-icons';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import { Command } from '@tauri-apps/plugin-shell';
import { db } from '../db';
import { invoices as invoicesTable, users as usersTable, invoiceItems } from '../db/schema';
import { eq } from 'drizzle-orm';

type InvoiceStatus = 'Offen' | 'Bezahlt' | 'Entwurf';
type DisplayInvoiceStatus = InvoiceStatus | 'Überfällig';

type LineItem = {
  id: number;
  description: string;
  quantity: string;
  amount: string;
};

type Invoice = {
  id: number;
  number: string;
  customerId: number;
  customerNumber: string;
  customerName: string;
  description: string;
  netAmount: number;
  amount: number;
  vatAmount: number;
  grossAmount: number;
  cashDiscountEnabled: boolean;
  cashDiscountPercent: number;
  discountedAmount: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  invoicePath: string;
  lineItems?: LineItem[];
};

const invoiceFilters = ['Alle', 'Offen', 'Überfällig', 'Bezahlt', 'Entwurf'] as const;

const monthOptions = [
  { value: '01', label: 'Januar' },
  { value: '02', label: 'Februar' },
  { value: '03', label: 'März' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Dezember' },
];

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function greetingForHour(hour: number) {
  if (hour < 5) return 'Zeit zum Schlafen';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 14) return 'Mahlzeit';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function calculateInvoiceStatus(invoice: Invoice): DisplayInvoiceStatus {
  const today = new Date().toISOString().split('T')[0];
  if (invoice.status === 'Offen' && invoice.dueDate <= today) {
    return 'Überfällig';
  }
  return invoice.status;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  try {
    return dateFormatter.format(new Date(`${dateStr}T00:00:00`));
  } catch {
    return dateStr;
  }
}

function getCustomerName(client: typeof usersTable.$inferSelect | null, fallbackId: number) {
  const fullName = `${client?.first_name || ''} ${client?.last_name || ''}`.trim();
  const companyName = client?.company_name?.trim() || '';
  const postalCode = client?.zip?.trim() || '';

  if (companyName && companyName !== postalCode) return companyName;
  return fullName || (companyName && !/^\d{5}$/.test(companyName) ? companyName : '') || `Kunde ${fallbackId}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setFilter] = useState<(typeof invoiceFilters)[number]>('Alle');
  const [selectedYear, setSelectedYear] = useState('Alle');
  const [selectedMonth, setSelectedMonth] = useState('Alle');
  const [currentHour, setCurrentHour] = useState(12);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingInvoices, setIsDeletingInvoices] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      const dbInvoices = await db
        .select({
          invoice: invoicesTable,
          user: usersTable,
        })
        .from(invoicesTable)
        .leftJoin(usersTable, eq(invoicesTable.user_id, usersTable.id));

      if (dbInvoices && dbInvoices.length > 0) {
        const formatted: Invoice[] = await Promise.all(
          dbInvoices.map(async (row) => {
            const inv = row.invoice;
            const usr = row.user;
            const customerNumber = usr?.company_id || String(usr?.id || inv.user_id);
            const customerName = getCustomerName(usr, inv.user_id);

            const items = await db
              .select()
              .from(invoiceItems)
              .where(eq(invoiceItems.invoice_id, inv.id));

            let lineItemsGrossTotal = 0;
            const lineItemsList: LineItem[] = items.map((item) => {
              const qty = item.quantity ?? 1;
              const price = item.price_at_time ?? 0;
              lineItemsGrossTotal += qty * price;
              return {
                id: item.id,
                description: item.product_name || 'Leistung',
                quantity: String(qty),
                amount: String(price),
              };
            });

            const description = lineItemsList.map((i) => i.description).join(', ') || 'Rechnung';
            const netTotal = Number(inv.total || 0) || lineItemsGrossTotal / 1.19;
            const grossAmount = Number(inv.gross_total || 0) || lineItemsGrossTotal;
            const vatAmount = Number(inv.vat_total || 0) || grossAmount - netTotal;
            const cashDiscountEnabled = Number(inv.cash_discount_enabled ?? 0) === 1;
            const cashDiscountPercent = Number(inv.cash_discount_percent ?? 0);
            const discountedAmount = Number(inv.payable_total || 0) || (
              cashDiscountEnabled
                ? grossAmount * (1 - cashDiscountPercent / 100)
                : grossAmount
            );
            const createdAt = inv.created_at ? new Date(inv.created_at) : new Date();
            const issueDate = inv.issue_date || `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;
            const legacyDueDate = new Date(`${issueDate}T00:00:00`);
            legacyDueDate.setDate(legacyDueDate.getDate() + 14);
            const dueDate = inv.due_date || `${legacyDueDate.getFullYear()}-${String(legacyDueDate.getMonth() + 1).padStart(2, '0')}-${String(legacyDueDate.getDate()).padStart(2, '0')}`;

            return {
              id: inv.id,
              number: inv.invoice_number || `RE-${inv.id.toString().padStart(4, '0')}`,
              customerId: inv.user_id,
              customerNumber,
              customerName,
              description,
              netAmount: netTotal,
              amount: grossAmount,
              issueDate,
              vatAmount,
              grossAmount,
              invoicePath: inv.invoice_path || '',
              cashDiscountEnabled,
              cashDiscountPercent,
              discountedAmount,
              dueDate,
              status: (inv.status || 'Offen') as InvoiceStatus,
              lineItems: lineItemsList.length > 0 ? lineItemsList : undefined,
            };
          })
        );
        setInvoices(formatted);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Rechnungen aus der DB:', err);
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setCurrentHour(new Date().getHours());
    loadDashboardData();
    const timer = window.setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const changeInvoiceStatus = async (invoiceId: number, newStatus: InvoiceStatus) => {
    try {
      await db.update(invoicesTable).set({ status: newStatus }).where(eq(invoicesTable.id, invoiceId));
      setInvoices((prev) => prev.map((invoice) => (
        invoice.id === invoiceId ? { ...invoice, status: newStatus } : invoice
      )));
      setSelectedInvoice((invoice) => (
        invoice?.id === invoiceId ? { ...invoice, status: newStatus } : invoice
      ));
    } catch (error) {
      console.error('Fehler beim Speichern des Rechnungsstatus:', error);
    }
  };

  async function handleDeleteAllInvoices() {
    setIsDeletingInvoices(true);
    setDeleteError('');
    try {
      await db.delete(invoiceItems);
      await db.delete(invoicesTable);
      setInvoices([]);
      setSelectedInvoice(null);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Fehler beim Löschen der Rechnungen:', error);
      setDeleteError('Die Rechnungen konnten nicht gelöscht werden. Bitte versuche es erneut.');
    } finally {
      setIsDeletingInvoices(false);
    }
  }

  async function openInvoicePdf(invoicePath: string) {
    if (!invoicePath) {
      alert('Für diese Rechnung ist keine PDF-Datei hinterlegt.');
      return;
    }

    try {
      const normalizedPath = invoicePath
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/^\\\\\?\\/, '')
        .replace(/\\/g, '/');
      try {
        const windowsOpen = await Command.create('cmd', ['/c', 'start', '', normalizedPath]).execute();
        if (windowsOpen.code !== 0) throw new Error(`Windows start beendet mit Code ${windowsOpen.code}`);
      } catch (windowsError) {
        console.warn('Öffnen über Windows-Dateizuordnung fehlgeschlagen, versuche Tauri:', windowsError);
        try {
          await openPath(normalizedPath);
        } catch (pathError) {
          console.warn('Öffnen über den Dateipfad fehlgeschlagen, versuche den Browser:', pathError);
          const fileUrl = normalizedPath.startsWith('//')
            ? `file:${normalizedPath}`
            : `file:///${normalizedPath}`;
          await openUrl(encodeURI(fileUrl));
        }
      }
    } catch (error) {
      console.error('PDF konnte nicht geöffnet werden:', error);
      alert(`Die PDF-Datei konnte nicht geöffnet werden: ${invoicePath}`);
    }
  }

  const openInvoices = invoices.filter((inv) => inv.status === 'Offen');
  const paidInvoices = invoices.filter((inv) => inv.status === 'Bezahlt');

  const visibleInvoices = invoices
    .filter((inv) => {
      const dispStatus = calculateInvoiceStatus(inv);
      const matchesStatus = statusFilter === 'Alle' || dispStatus === statusFilter;
      const matchesYear = selectedYear === 'Alle' || inv.issueDate.startsWith(selectedYear);
      const matchesMonth = selectedMonth === 'Alle' || inv.issueDate.slice(5, 7) === selectedMonth;
      return matchesStatus && matchesYear && matchesMonth;
    })
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.id - a.id);

  const invoiceYears = Array.from(new Set(invoices.map((inv) => inv.issueDate.slice(0, 4))))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  const openTotal = openInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidTotal = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6 overflow-y-auto no-scrollbar p-2">
      {/* Page Header */}
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-xs uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400 mb-1">
            ÜBERSICHT
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {greetingForHour(currentHour)}, Willkommen zurück.
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Deine Finanzen und offenen Rechnungen auf einen Blick.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            appearance="secondary"
            icon={<Delete20Regular />}
            onClick={() => {
              setDeleteError('');
              setIsDeleteDialogOpen(true);
            }}
            disabled={isLoading || invoices.length === 0}
          >
            Alle Rechnungen löschen
          </Button>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={() => navigate('/invoice')}
            size="large"
          >
            Neue Rechnung
          </Button>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              Offene Rechnungen
            </span>
            <span className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Clock20Regular />
            </span>
          </div>
          <div className="mt-4">
            <strong className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {euro.format(openTotal)}
            </strong>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
              {openInvoices.length} Zahlung{openInvoices.length === 1 ? '' : 'en'} ausstehend
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-blue-200 dark:border-blue-900 bg-linear-to-br from-blue-50/40 to-white dark:from-blue-950/20 dark:to-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Bereits bezahlt
            </span>
            <span className="p-2 rounded-lg bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400">
              <CheckmarkCircle20Regular />
            </span>
          </div>
          <div className="mt-4">
            <strong className="text-3xl font-extrabold text-blue-900 dark:text-blue-100">
              {euro.format(paidTotal)}
            </strong>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
              {paidInvoices.length} Rechnung{paidInvoices.length === 1 ? '' : 'en'} beglichen
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              Rechnungen gesamt
            </span>
            <span className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <Document20Regular />
            </span>
          </div>
          <div className="mt-4">
            <strong className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {invoices.length}
            </strong>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Inklusive Entwürfe</p>
          </div>
        </div>
      </div>

      {/* Main Content: Invoice Table & Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-6 grow">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Rechnungsübersicht</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Aktuelle Rechnungen und Zahlungsstatus filtern
            </p>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {invoiceFilters.map((st) => {
              const active = statusFilter === st;
              return (
                <button
                  key={st}
                  onClick={() => setFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Filter Group */}
        <div className="flex flex-wrap items-center gap-4 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 font-semibold">
            <Filter20Regular /> Filter:
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-500 dark:text-gray-400">Jahr:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Alle">Alle Jahre</option>
              {invoiceYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-gray-500 dark:text-gray-400">Monat:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Alle">Alle Monate</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Spinner label="Lade Rechnungen..." />
          </div>
        ) : visibleInvoices.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm italic">
            Für diesen Filter gibt es noch keine Rechnungen.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3 px-3">Nummer</th>
                  <th className="py-3 px-3">Kunde</th>
                  <th className="py-3 px-3">Leistung</th>
                  <th className="py-3 px-3">Rechnungsdatum</th>
                  <th className="py-3 px-3">Fällig</th>
                  <th className="py-3 px-3 text-right">Netto</th>
                  <th className="py-3 px-3 text-right">MwSt. (19%)</th>
                  <th className="py-3 px-3 text-right">Brutto</th>
                  <th className="py-3 px-3 text-center">Skonto</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visibleInvoices.map((inv) => {
                  const dispStatus = calculateInvoiceStatus(inv);

                  let statusBadgeStyle = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
                  if (dispStatus === 'Bezahlt') {
                    statusBadgeStyle = 'bg-green-100 text-green-800 dark:bg-green-950/80 dark:text-green-300';
                  } else if (dispStatus === 'Offen') {
                    statusBadgeStyle = 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300';
                  } else if (dispStatus === 'Überfällig') {
                    statusBadgeStyle = 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 font-bold';
                  } else if (dispStatus === 'Entwurf') {
                    statusBadgeStyle = 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300';
                  }

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className="scroll-animation hover:bg-blue-50/50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{inv.number}</span>
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<Eye20Regular />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                          }}
                          title="Rechnung ansehen"
                          aria-label={`Rechnung ${inv.number} ansehen`}
                        />
                      </td>
                      <td className="py-3 px-3 text-gray-800 dark:text-gray-200">
                        <span className="block text-xs text-gray-500 dark:text-gray-400">Kundennummer: {inv.customerNumber}</span>
                        <span className="block font-medium">{inv.customerName}</span>
                      </td>
                      <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {inv.description}
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300">
                        {euro.format(inv.netAmount)}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300">
                        {euro.format(inv.vatAmount)}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-900 dark:text-white">
                        {inv.cashDiscountEnabled ? (
                          <div className="space-y-1">
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                              Brutto ohne Skonto: {euro.format(inv.grossAmount)}
                            </span>
                            <strong className="block">
                              Zahlbetrag mit Skonto: {euro.format(inv.discountedAmount)}
                            </strong>
                          </div>
                        ) : (
                          <strong>{euro.format(inv.grossAmount)}</strong>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {inv.cashDiscountEnabled ? (
                          <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-300" title="Skonto angewählt">
                            <CheckmarkCircle20Regular aria-hidden="true" />
                            {inv.cashDiscountPercent}%
                          </span>
                        ) : '–'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <select
                          value={dispStatus}
                          onChange={(e) => {
                            e.stopPropagation();
                            void changeInvoiceStatus(inv.id, e.target.value as InvoiceStatus);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full border-none cursor-pointer focus:outline-none ${statusBadgeStyle}`}
                        >
                          <option value="Offen">Offen</option>
                          <option value="Überfällig" disabled>
                            Überfällig
                          </option>
                          <option value="Bezahlt">Bezahlt</option>
                          <option value="Entwurf">Entwurf</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isDeleteDialogOpen && (
        <Dialog
          open={isDeleteDialogOpen}
          onOpenChange={(_, data) => {
            if (!data.open && !isDeletingInvoices) setIsDeleteDialogOpen(false);
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Alle Rechnungen löschen?</DialogTitle>
              <DialogContent className="space-y-2">
                <p>
                  {invoices.length} gespeicherte Rechnungen und ihre Positionen werden dauerhaft aus der Datenbank gelöscht.
                </p>
                <p>Exportierte PDF/ZUGFeRD-Dateien und der Rechnungsnummern-Zähler bleiben unverändert.</p>
                {deleteError && <p role="alert" className="text-sm text-red-600">{deleteError}</p>}
              </DialogContent>
              <DialogActions>
                <Button
                  appearance="secondary"
                  disabled={isDeletingInvoices}
                  onClick={() => setIsDeleteDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button
                  appearance="secondary"
                  icon={<Delete20Regular />}
                  disabled={isDeletingInvoices}
                  onClick={() => void handleDeleteAllInvoices()}
                  className="text-red-700 dark:text-red-300"
                >
                  {isDeletingInvoices ? 'Lösche...' : 'Endgültig löschen'}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}

      {/* Detail / Print Modal */}
      {selectedInvoice && (
        <Dialog
          open={!!selectedInvoice}
          onOpenChange={(_, data) => {
            if (!data.open) setSelectedInvoice(null);
          }}
        >
          <DialogSurface className="max-w-xl w-full">
            <DialogBody>
              <DialogTitle className="flex justify-between items-center border-b pb-3">
                <div>
                  <p className="text-xs uppercase font-bold text-blue-600">RECHNUNGSDETAILS</p>
                  <span className="text-xl font-bold">{selectedInvoice.number}</span>
                </div>
                <Button
                  appearance="subtle"
                  icon={<Dismiss20Regular />}
                  onClick={() => setSelectedInvoice(null)}
                  aria-label="Detailansicht schließen"
                />
              </DialogTitle>
              <DialogContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div>
                    <span className="text-xs text-gray-500 block">Kundennummer</span>
                    <strong className="text-gray-900 dark:text-white">{selectedInvoice.customerNumber}</strong>
                    <span className="mt-1 block text-xs text-gray-500">Kunde / Firma</span>
                    <strong className="block text-gray-900 dark:text-white">{selectedInvoice.customerName}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Rechnungsdatum</span>
                    <strong className="text-gray-900 dark:text-white">{formatDate(selectedInvoice.issueDate)}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Fällig am</span>
                    <strong className="text-gray-900 dark:text-white">{formatDate(selectedInvoice.dueDate)}</strong>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Rechnungspositionen</h4>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Leistung</th>
                          <th className="px-3 py-2 text-right font-semibold">Menge</th>
                          <th className="px-3 py-2 text-right font-semibold">Einzelpreis</th>
                          <th className="px-3 py-2 text-right font-semibold">Gesamt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(selectedInvoice.lineItems || [
                      { id: 1, description: selectedInvoice.description, quantity: '1', amount: String(selectedInvoice.amount) }
                    ]).map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{item.description}</td>
                        <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{euro.format(Number(item.amount))}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">
                          {euro.format(Number(item.quantity) * Number(item.amount))}
                        </td>
                      </tr>
                    ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600 dark:text-gray-300">Netto</span>
                    <span>{euro.format(selectedInvoice.netAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600 dark:text-gray-300">MwSt. (19%)</span>
                    <span>{euro.format(selectedInvoice.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-gray-200 pt-2 dark:border-gray-700">
                    <strong className="text-gray-900 dark:text-white">Brutto</strong>
                    <strong className="text-gray-900 dark:text-white">{euro.format(selectedInvoice.grossAmount)}</strong>
                  </div>
                  {selectedInvoice.cashDiscountEnabled && (
                    <>
                      <div className="flex justify-between gap-4 text-green-700 dark:text-green-300">
                        <span>Skonto ({selectedInvoice.cashDiscountPercent}%)</span>
                        <span>−{euro.format(selectedInvoice.grossAmount - selectedInvoice.discountedAmount)}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-gray-200 pt-2 font-bold dark:border-gray-700">
                        <span>Zahlbetrag mit Skonto</span>
                        <span>{euro.format(selectedInvoice.discountedAmount)}</span>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>

              <DialogActions className="border-t pt-3 mt-4 flex justify-between">
                <Button
                  appearance="secondary"
                  icon={<Open20Regular />}
                  onClick={() => void openInvoicePdf(selectedInvoice.invoicePath)}
                  disabled={!selectedInvoice.invoicePath}
                >
                  PDF öffnen
                </Button>
                <Button appearance="primary" onClick={() => setSelectedInvoice(null)}>
                  Schließen
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}
