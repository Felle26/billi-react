import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Spinner } from '@fluentui/react-components';
import {
  Add20Regular,
  Eye20Regular,
  ArrowDownload20Regular,
  Dismiss20Regular,
  Document20Regular,
  CheckmarkCircle20Regular,
  Clock20Regular,
  Filter20Regular,
} from '@fluentui/react-icons';
import { db } from '../db';
import { invoices as invoicesTable, users as usersTable, invoiceItems, products } from '../db/schema';
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
  customerName: string;
  description: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  lineItems?: LineItem[];
};

const initialSampleInvoices: Invoice[] = [
  {
    id: 1,
    number: 'RE-2026-0042',
    customerId: 1,
    customerName: 'Nordlicht Studio',
    description: 'Website-Relaunch',
    amount: 2450,
    dueDate: '2026-09-12',
    status: 'Offen',
    lineItems: [
      { id: 101, description: 'Website-Relaunch Design & Dev', quantity: '1', amount: '2450' }
    ]
  },
  {
    id: 2,
    number: 'RE-2026-0041',
    customerId: 2,
    customerName: 'Weber & Partner',
    description: 'Beratungsleistung August',
    amount: 1200,
    dueDate: '2026-09-03',
    status: 'Bezahlt',
    lineItems: [
      { id: 102, description: 'Beratung 12 Std.', quantity: '12', amount: '100' }
    ]
  },
  {
    id: 3,
    number: 'RE-2026-0040',
    customerId: 3,
    customerName: 'Morgenrot GmbH',
    description: 'Markenworkshop',
    amount: 850,
    dueDate: '2026-09-18',
    status: 'Entwurf',
    lineItems: [
      { id: 103, description: 'Markenworkshop Halbtags', quantity: '1', amount: '850' }
    ]
  },
];

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
const dateFormatter = new Intl.DateTimeFormat('de-DE');

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setFilter] = useState<(typeof invoiceFilters)[number]>('Alle');
  const [selectedYear, setSelectedYear] = useState('Alle');
  const [selectedMonth, setSelectedMonth] = useState('Alle');
  const [currentHour, setCurrentHour] = useState(12);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

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
            const customerName = usr?.company_name || `${usr?.first_name || ''} ${usr?.last_name || ''}`.trim() || 'Unbekannter Kunde';

            const items = await db
              .select({
                item: invoiceItems,
                product: products,
              })
              .from(invoiceItems)
              .leftJoin(products, eq(invoiceItems.product_id, products.id))
              .where(eq(invoiceItems.invoice_id, inv.id));

            let total = 0;
            const lineItemsList: LineItem[] = items.map((it) => {
              const qty = it.item.quantity ?? 1;
              const price = it.item.price_at_time ?? it.product?.price ?? 0;
              total += qty * price;
              return {
                id: it.item.id,
                description: it.product?.name || 'Leistung',
                quantity: String(qty),
                amount: String(price),
              };
            });

            const description = lineItemsList.map((i) => i.description).join(', ') || 'Rechnung';
            const dueDate = inv.created_at ? new Date(inv.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

            return {
              id: inv.id,
              number: `RE-${inv.id.toString().padStart(4, '0')}`,
              customerId: inv.user_id,
              customerName,
              description,
              amount: total,
              dueDate,
              status: 'Offen' as InvoiceStatus,
              lineItems: lineItemsList.length > 0 ? lineItemsList : undefined,
            };
          })
        );
        setInvoices(formatted);
      } else {
        setInvoices(initialSampleInvoices);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Rechnungen aus der DB:', err);
      setInvoices(initialSampleInvoices);
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

  const changeInvoiceStatus = (invoiceId: number, newStatus: InvoiceStatus) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: newStatus } : inv))
    );
  };

  const openInvoices = invoices.filter((inv) => inv.status === 'Offen');
  const paidInvoices = invoices.filter((inv) => inv.status === 'Bezahlt');

  const visibleInvoices = invoices.filter((inv) => {
    const dispStatus = calculateInvoiceStatus(inv);
    const matchesStatus = statusFilter === 'Alle' || dispStatus === statusFilter;
    const matchesYear = selectedYear === 'Alle' || inv.dueDate.startsWith(selectedYear);
    const matchesMonth = selectedMonth === 'Alle' || inv.dueDate.slice(5, 7) === selectedMonth;
    return matchesStatus && matchesYear && matchesMonth;
  });

  const invoiceYears = Array.from(new Set(invoices.map((inv) => inv.dueDate.slice(0, 4))))
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
        <Button
          appearance="primary"
          icon={<Add20Regular />}
          onClick={() => navigate('/invoice')}
          size="large"
        >
          Neue Rechnung
        </Button>
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
                  <th className="py-3 px-3">Fällig</th>
                  <th className="py-3 px-3 text-right">Betrag</th>
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
                      className="hover:bg-blue-50/50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
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
                      <td className="py-3 px-3 text-gray-800 dark:text-gray-200">{inv.customerName}</td>
                      <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {inv.description}
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                        {euro.format(inv.amount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <select
                          value={dispStatus}
                          onChange={(e) => {
                            e.stopPropagation();
                            changeInvoiceStatus(inv.id, e.target.value as InvoiceStatus);
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
                    <span className="text-xs text-gray-500 block">Kunde</span>
                    <strong className="text-gray-900 dark:text-white">{selectedInvoice.customerName}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Fällig am</span>
                    <strong className="text-gray-900 dark:text-white">{formatDate(selectedInvoice.dueDate)}</strong>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Leistungen</h4>
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    {(selectedInvoice.lineItems || [
                      { id: 1, description: selectedInvoice.description, quantity: '1', amount: String(selectedInvoice.amount) }
                    ]).map((item) => (
                      <li key={item.id} className="py-2 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{item.description}</p>
                          <p className="text-xs text-gray-500">
                            {item.quantity} × {euro.format(Number(item.amount))}
                          </p>
                        </div>
                        <strong className="text-gray-900 dark:text-white">
                          {euro.format(Number(item.quantity) * Number(item.amount))}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-900">
                  <span className="font-bold text-gray-800 dark:text-gray-200">Gesamtbetrag</span>
                  <strong className="text-xl font-extrabold text-blue-700 dark:text-blue-300">
                    {euro.format(selectedInvoice.amount)}
                  </strong>
                </div>
              </DialogContent>

              <DialogActions className="border-t pt-3 mt-4 flex justify-between">
                <Button
                  appearance="secondary"
                  icon={<ArrowDownload20Regular />}
                  onClick={() => window.print()}
                >
                  Drucken / PDF
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
