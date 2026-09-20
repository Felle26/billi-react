import { useState, useEffect, Fragment } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { useLocation } from 'react-router-dom';
import { 
  Button, 
  Field, 
  Input, 
  Select,
  Switch,
  Combobox, 
  Option, 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHeaderCell, 
  TableCell,
  TableCellLayout,
  Spinner 
} from '@fluentui/react-components';
import { Delete20Regular, DocumentPdf24Regular, Drag20Regular, Add20Regular, Subtract20Regular } from '@fluentui/react-icons';
import { db } from '../db';
import { users, objects, products, customerProducts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { Command } from '@tauri-apps/plugin-shell';

type Product = typeof products.$inferSelect;
const productUnits = ['lfm / m', 'm²', 'm³', 'Stk.'] as const;

// Freie Position ohne hinterlegtes Produkt, immer für jeden Kunden verfügbar
const BLANK_PRODUCT: Product = {
  id: 0,
  name: 'Blanko-Position',
  description: 'Freie Position ohne hinterlegtes Produkt',
  price: 0,
  price_tag: '€',
  product_unit: 'Stk.',
  product_count: 1,
};

function getClientName(client: typeof users.$inferSelect) {
  const fullName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
  return client.company_name || fullName || 'Unbekannter Kunde';
}

function ProductCardContent({ product, customPrice, customQuantity }: { product: Product; customPrice?: number; customQuantity?: number }) {
  const displayedPrice = Number(customPrice ?? product.price ?? 0);
  const displayedQuantity = Number(customQuantity ?? product.product_count ?? 0);

  return (
    <div className="flex items-start gap-2">
      <Drag20Regular className="mt-0.5 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{product.name}</div>
        <div className="mt-1 text-xs text-blue-600 dark:text-blue-300">
          {displayedPrice.toFixed(2)} {product.price_tag} / {product.product_unit || 'Stk.'}
        </div>
        <div className="mt-0.5 text-[10px] text-gray-500">
          Menge: {displayedQuantity.toFixed(2)} {product.product_unit || 'Stk.'}
        </div>
      </div>
    </div>
  );
}

function DraggableProduct({ product, customPrice, customQuantity }: { product: Product; customPrice?: number; customQuantity?: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `invoice-product-${product.id}` });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`relative cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-blue-400 active:cursor-grabbing dark:border-gray-700 dark:bg-gray-800 ${isDragging ? 'opacity-30' : ''}`}
    >
      <ProductCardContent product={product} customPrice={customPrice} customQuantity={customQuantity} />
    </div>
  );
}

function InvoiceItemsDropZone({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'invoice-items' });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-32 rounded-lg border-2 border-dashed p-2 transition-colors ${isOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-transparent'}`}
    >
      {children}
    </div>
  );
}

export default function InvoicePage() {
  const location = useLocation();
  const invoiceContext = location.state as { objectId?: number; userId?: number } | null;
  // Stammdaten aus der DB
  const [clientList, setClientList] = useState<any[]>([]);
  const [objectList, setObjectList] = useState<any[]>([]);
  const [productList, setProductList] = useState<any[]>([]);
  const [customerPricing, setCustomerPricing] = useState<Record<number, { custom_price: number; custom_quantity: number }>>({});

  // Formulardaten für die Rechnung
  const [selectedUserId, setSelectedUserId] = useState<string>(invoiceContext?.userId?.toString() || '');
  const [selectedObjectId, setSelectedObjectId] = useState<string>(invoiceContext?.objectId?.toString() || '');
  const [invoiceId, setInvoiceId] = useState('RE-2026-001');
  const [isCashDiscountEnabled, setIsCashDiscountEnabled] = useState(false);
  const [cashDiscountPercent] = useState(2);
  const [cashDiscountDays] = useState(10);
  
  // Rechnungspositionen
  const [items, setItems] = useState<Array<{
    productId: string;
    name: string;
    info: string;
    originalQuantity: number;
    originalPrice: number;
    originalUnit: string;
    quantity: number;
    price: number;
    unit: string;
    expanded: boolean;
  }>>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  // Grunddaten beim Start laden (Kunden & Produkte)
  useEffect(() => {
    async function loadBaseData() {
      try {
        const clients = await db.select().from(users);
        const prods = await db.select().from(products);
        setClientList(clients);
        setProductList(prods);
      } catch (error) {
        console.error("Fehler beim Laden der Basisdaten:", error);
      }
    }
    loadBaseData();
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setObjectList([]);
      setCustomerPricing({});
      setSelectedObjectId('');
      return;
    }

    async function loadObjects() {
      try {
        const [objs, customerAssignments] = await Promise.all([
          db.select().from(objects).where(eq(objects.user_id, Number(selectedUserId))),
          db.select().from(customerProducts).where(eq(customerProducts.user_id, Number(selectedUserId)))
        ]);

        const priceMap: Record<number, { custom_price: number; custom_quantity: number }> = {};
        customerAssignments.forEach((assignment) => {
          priceMap[assignment.product_id] = {
            custom_price: Number(assignment.custom_price ?? 0),
            custom_quantity: Number(assignment.custom_quantity ?? 1),
          };
        });

        setObjectList(objs);
        setCustomerPricing(priceMap);

        if (invoiceContext?.objectId && objs.some((obj) => obj.id === invoiceContext.objectId)) {
          setSelectedObjectId(invoiceContext.objectId.toString());
        }
      } catch (error) {
        console.error('Fehler beim Laden der Objekte bzw. Kundenpreise:', error);
        setObjectList([]);
        setCustomerPricing({});
      }
    }

    void loadObjects();
  }, [selectedUserId, invoiceContext?.objectId]);

  useEffect(() => {
    if (!selectedUserId || Object.keys(customerPricing).length === 0) return;

    setItems((prev) => prev.map((item) => {
      const productId = Number(item.productId);
      const customAssignment = customerPricing[productId];
      if (!customAssignment) return item;

      const newOriginalQuantity = Number(customAssignment.custom_quantity || item.originalQuantity || 1);
      const newOriginalPrice = Number(customAssignment.custom_price || item.originalPrice || 0);

      return {
        ...item,
        originalQuantity: newOriginalQuantity,
        originalPrice: newOriginalPrice,
        originalUnit: item.originalUnit || item.unit || 'Stk.',
        // Nur nachziehen, solange der Nutzer die Werte noch nicht manuell verändert hat
        quantity: item.quantity === item.originalQuantity ? newOriginalQuantity : item.quantity,
        price: item.price === item.originalPrice ? newOriginalPrice : item.price,
        unit: item.unit === item.originalUnit ? item.originalUnit : item.unit,
      };
    }));
  }, [selectedUserId, customerPricing]);

  // Wenn Kunde gewählt wird, passende Objekte laden
  async function handleClientSelect(userId: string) {
    setSelectedUserId(userId);
    setSelectedObjectId('');
    setObjectList([]);
  }

  // Alle wählbaren Produkte inkl. der immer verfügbaren Blanko-Position
  const allProducts = [BLANK_PRODUCT, ...productList];

  // 3. Position zur Rechnung hinzufügen
  const handleAddProduct = (productId: string) => {
    const prod = allProducts.find(p => p.id.toString() === productId);
    if (!prod) return;

    const customAssignment = customerPricing[Number(prod.id)];
    const originalQuantity = Number(customAssignment?.custom_quantity || 1);
    const originalPrice = Number(customAssignment?.custom_price ?? prod.price);

    setItems(prev => [
      ...prev,
      {
        productId: prod.id.toString(),
        name: prod.name,
        info: '',
        originalQuantity,
        originalPrice,
        originalUnit: prod.product_unit || 'Stk.',
        quantity: originalQuantity,
        price: originalPrice,
        unit: prod.product_unit || 'Stk.',
        expanded: false,
      }
    ]);
  };

  // Bezeichnung, Information, Menge oder Preis einer Position ändern
  const handleItemChange = (index: number, field: 'name' | 'info' | 'quantity' | 'price' | 'unit', value: string) => {
    const parsedValue = field === 'quantity' || field === 'price' ? Number(value) : value;
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: parsedValue } : item)));
  };

  const handleToggleExpanded = (index: number) => {
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, expanded: !item.expanded } : item)));
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleProductDrop = ({ active, over }: DragEndEvent) => {
    setActiveProductId(null);
    if (!over || over.id !== 'invoice-items') return;
    const productId = Number(String(active.id).replace('invoice-product-', ''));
    if (Number.isFinite(productId)) handleAddProduct(productId.toString());
  };

  const handleProductDragStart = ({ active }: DragStartEvent) => {
    setActiveProductId(String(active.id).replace('invoice-product-', ''));
  };

  const draggedProduct = activeProductId ? allProducts.find(p => p.id.toString() === activeProductId) : undefined;

  // Summen berechnen
  const netTotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const vatTotal = netTotal * 0.19; // 19% MwSt.
  const grossTotal = netTotal + vatTotal;
  const cashDiscountAmount = isCashDiscountEnabled ? grossTotal * (cashDiscountPercent / 100) : 0;
  const payableTotal = grossTotal - cashDiscountAmount;

  // 4. Rechnung generieren (Tauri Sidecar aufrufen)
  async function handleGenerateInvoice() {
    if (!selectedUserId || !selectedObjectId) {
      alert("Bitte wähle einen Kunden und ein Objekt aus.");
      return;
    }
    if (items.length === 0) {
      alert("Bitte füge mindestens eine Rechnungsposition hinzu.");
      return;
    }

    setIsLoading(true);
    setStatusMessage('Generiere ZUGFeRD PDF/A-3...');

    try {
      const client = clientList.find(c => c.id.toString() === selectedUserId);
      const obj = objectList.find(o => o.id.toString() === selectedObjectId);

      if (!client || !obj) {
        throw new Error('Kunde oder Objekt konnte nicht geladen werden.');
      }

      const payload = {
        invoiceId: invoiceId,
        netTotal: netTotal,
        isCashDiscountEnabled,
        grossTotal: payableTotal,
        grossTotalBeforeCashDiscount: grossTotal,
        cashDiscount: isCashDiscountEnabled ? {
          percent: cashDiscountPercent,
          days: cashDiscountDays,
          amount: cashDiscountAmount,
        } : null,
        client: client,
        object: obj,
        items: items.map((item) => ({
          name: item.name,
          description: item.info || item.name,
          quantity: item.quantity,
          price: item.price,
          unit: item.unit,
        }))
      };

      // Aufruf unseres kompilierten Node.js-Sidecars über Tauri Shell Plugin
      const command = Command.sidecar('bin/zugferd', [
        JSON.stringify(payload)
      ]);
      
      const output = await command.execute();
      const stdout = String(output.stdout || '').trim();
      let response: { status?: string; message?: string; document_path?: string } | null = null;
      if (stdout) {
        try {
          response = JSON.parse(stdout);
        } catch {
          throw new Error(`Sidecar lieferte keine gültige Antwort: ${stdout}`);
        }
      }

      if (output.code === 0 && response?.status === 'success') {
        setStatusMessage(`Erfolgreich gespeichert unter: ${response.document_path || 'unbekanntem Pfad'}`);
      } else {
        setStatusMessage(`Fehler: ${response?.message || output.stderr || `Sidecar beendet mit Code ${output.code ?? 'unbekannt'}`}`);
      }
    } catch (error) {
      console.error("Fehler beim Ausführen des Sidecars:", error);
      setStatusMessage(`Fehler beim Generieren: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <DndContext onDragStart={handleProductDragStart} onDragEnd={handleProductDrop}>
      <div className="flex h-[calc(100vh-140px)] flex-col items-center">
        <div className="flex h-full min-h-0 w-full max-w-full flex-col gap-4 pb-2">

        {/* HEADER */}
        <div className="flex items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 shrink-0">
           <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Neue Rechnung erstellen</h2>
           <Input 
             value={invoiceId} 
             autoComplete="off"
             onChange={(e) => setInvoiceId(e.target.value)} 
             placeholder="Rechnungsnummer" 
             className="w-44"
           />
        </div>

        {/* AUSWAHL: KUNDE & OBJEKT */}
        <div className="grid grid-cols-1 gap-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 shrink-0 md:grid-cols-3">
          <div className="flex flex-col gap-4">
            <Field label="Kunde auswählen" required>
              <Combobox 
                placeholder="Kunde wählen..."
                value={clientList.find(client => client.id.toString() === selectedUserId) ? getClientName(clientList.find(client => client.id.toString() === selectedUserId)) : ''}
                onOptionSelect={(_e, data) => handleClientSelect(data.optionValue || '')}
              >
                {clientList.map(client => (
                  <Option key={client.id} value={client.id.toString()} text={getClientName(client)}>
                    {getClientName(client)}
                  </Option>
                ))}
              </Combobox>
            </Field>

            <Field label="Objekt auswählen" required>
              <Combobox 
                placeholder="Objekt wählen..."
                disabled={!selectedUserId}
                value={objectList.find(obj => obj.id.toString() === selectedObjectId) ? `${objectList.find(obj => obj.id.toString() === selectedObjectId)?.name} (${objectList.find(obj => obj.id.toString() === selectedObjectId)?.street}, ${objectList.find(obj => obj.id.toString() === selectedObjectId)?.city})` : ''}
                onOptionSelect={(_e, data) => setSelectedObjectId(data.optionValue || '')}
              >
                {objectList.map(obj => (
                  <Option
                    key={obj.id}
                    value={obj.id.toString()}
                    text={`${obj.name} (${obj.street}, ${obj.city})`}
                  >
                    {obj.name} ({obj.street}, {obj.city})
                  </Option>
                ))}
              </Combobox>
            </Field>
          </div>

          <div className="flex flex-col gap-2 justify-center rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <span>Nettobetrag: <strong>{netTotal.toFixed(2)} €</strong></span>
            <span>19% MwSt.: <strong>{vatTotal.toFixed(2)} €</strong></span>
            <span>Gesamtbetrag: <strong>{grossTotal.toFixed(2)} €</strong></span>
            <Switch
              checked={isCashDiscountEnabled}
              label={`Skonto aktivieren (${cashDiscountPercent} % / ${cashDiscountDays} Tage)`}
              onChange={(_event, data) => setIsCashDiscountEnabled(data.checked)}
            />
            {isCashDiscountEnabled && (
              <>
                <span className="text-emerald-700 dark:text-emerald-300">
                  Skonto: <strong>-{cashDiscountAmount.toFixed(2)} €</strong>
                </span>
                <span className="text-base font-bold text-blue-600">Zahlbetrag: {payableTotal.toFixed(2)} €</span>
              </>
            )}
          </div>

          <div className="flex flex-col justify-center gap-1">
            <Button 
              appearance="primary" 
              size="large"
              icon={<DocumentPdf24Regular />}
              onClick={handleGenerateInvoice}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? <Spinner size="tiny" label="Generiere..." /> : 'Rechnung erstellen'}
            </Button>
            {statusMessage && <span className="text-xs text-gray-500">{statusMessage}</span>}
          </div>
        </div>

        {/* POSITIONEN HINZUFÜGEN */}
        <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[460px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 shrink-0">Produkte</h3>
              <p className="text-xs text-gray-500 shrink-0">Produkt auf die Rechnung ziehen</p>
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto no-scrollbar pr-1">
                {allProducts.map(product => {
                    const customPricing = customerPricing[product.id];
                    return (
                      <DraggableProduct
                        key={product.id}
                        product={product}
                        customPrice={customPricing?.custom_price}
                        customQuantity={customPricing?.custom_quantity}
                      />
                    );
                  })}
              </div>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-col gap-4">
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Rechnungspositionen</h3>
                <Combobox 
                  placeholder="+ Produkt/Leistung hinzufügen..."
                  onOptionSelect={(_e, data) => data.optionValue && handleAddProduct(data.optionValue)}
                  className="w-full sm:w-72"
                >
                  {allProducts.map(prod => {
                    const customPricing = customerPricing[prod.id];
                    const displayPrice = Number(customPricing?.custom_price ?? prod.price ?? 0);
                    return (
                      <Option
                        key={prod.id}
                        value={prod.id.toString()}
                        text={`${prod.name} (${displayPrice.toFixed(2)} ${prod.price_tag})`}
                      >
                        {prod.name} ({displayPrice.toFixed(2)} {prod.price_tag})
                      </Option>
                    );
                  })}
                </Combobox>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
                <InvoiceItemsDropZone>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell className="text-xs font-medium">Bezeichnung</TableHeaderCell>
                        <TableHeaderCell style={{ width: '80px' }} className="text-xs font-medium">Menge</TableHeaderCell>
                        <TableHeaderCell style={{ width: '88px' }} className="text-xs font-medium">Einh.</TableHeaderCell>
                        <TableHeaderCell style={{ width: '150px' }} className="text-xs font-medium">Einzelpreis</TableHeaderCell>
                        <TableHeaderCell style={{ width: '120px' }} className="text-xs font-medium">Gesamt</TableHeaderCell>
                        <TableHeaderCell style={{ width: '42px' }}></TableHeaderCell>
                        <TableHeaderCell style={{ width: '42px' }}></TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-400 py-6">
                            Noch keine Positionen hinzugefügt. Wähle oben ein Produkt aus.
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item, index) => {
                          const isBlank = item.productId === BLANK_PRODUCT.id.toString();
                          return (
                          <Fragment key={index}>
                          <TableRow>
                            <TableCell className="py-2 pr-3 align-top">
                              {isBlank ? (
                                <Input
                                  value={item.name}
                                  autoComplete="off"
                                  placeholder="Bezeichnung"
                                  onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                  className="w-full text-sm"
                                />
                              ) : (
                                <TableCellLayout className="text-sm text-gray-700 dark:text-gray-200">{item.name}</TableCellLayout>
                              )}
                            </TableCell>
                            <TableCell className="py-2 pr-2 align-top">
                              <Input 
                                type="number" 
                                value={String(item.quantity)} 
                                autoComplete="off"
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                className="w-16 text-sm"
                              />
                              <div className="mt-0.5 text-[9px] text-gray-400">Original: {item.originalQuantity}</div>
                            </TableCell>
                            <TableCell className="py-2 pr-2 align-top">
                              <Select
                                value={item.unit}
                                onChange={(_e, data) => handleItemChange(index, 'unit', String(data.value || 'Stk.'))}
                                className="w-[86px] text-sm"
                              >
                                {productUnits.map((unit) => (
                                  <option key={unit} value={unit}>{unit}</option>
                                ))}
                              </Select>
                              <div className="mt-0.5 text-[9px] text-gray-400">Original: {item.originalUnit}</div>
                            </TableCell>
                            <TableCell className="py-2 pr-2 align-top">
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <Input 
                                  type="number" 
                                  value={String(item.price)} 
                                  autoComplete="off"
                                  onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                  className="w-[108px] text-sm"
                                />
                                <span className="text-sm">€</span>
                              </div>
                              <div className="mt-0.5 text-[9px] text-gray-400">Original: {item.originalPrice.toFixed(2)} €</div>
                            </TableCell>
                            <TableCell className="py-2 pr-2 align-top font-semibold text-sm">
                              {(item.quantity * item.price).toFixed(2)} €
                            </TableCell>
                            <TableCell>
                              <Button 
                                appearance="subtle" 
                                icon={item.expanded ? <Subtract20Regular /> : <Add20Regular />}
                                title="Information"
                                onClick={() => handleToggleExpanded(index)}
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                appearance="subtle" 
                                icon={<Delete20Regular className="text-red-500" />} 
                                onClick={() => handleRemoveItem(index)}
                              />
                            </TableCell>
                          </TableRow>
                          {item.expanded && (
                            <TableRow>
                              <TableCell colSpan={7}>
                                <div className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                                  <Field label="Information" className="min-w-50 flex-1">
                                    <Input
                                      value={item.info}
                                      autoComplete="off"
                                      placeholder="Zusatzinfo..."
                                      onChange={(e) => handleItemChange(index, 'info', e.target.value)}
                                      className="text-sm"
                                    />
                                  </Field>
                                  <Field label="Menge" className="min-w-[90px]">
                                    <Input 
                                      type="number" 
                                      value={String(item.quantity)} 
                                      autoComplete="off"
                                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                      className="w-20 text-sm"
                                    />
                                  </Field>
                                  <Field label="Preis" className="min-w-[120px]">
                                    <div className="flex items-center gap-1 whitespace-nowrap">
                                      <Input 
                                        type="number" 
                                        value={String(item.price)} 
                                        autoComplete="off"
                                        onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                        className="w-24 text-sm"
                                      />
                                      <span className="text-sm">€</span>
                                    </div>
                                  </Field>
                                  <Field label="Einheit" className="min-w-[110px]">
                                    <Select
                                      value={item.unit}
                                      onChange={(_e, data) => handleItemChange(index, 'unit', String(data.value || 'Stk.'))}
                                      className="w-24 text-sm"
                                    >
                                      {productUnits.map((unit) => (
                                        <option key={unit} value={unit}>{unit}</option>
                                      ))}
                                    </Select>
                                  </Field>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          </Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </InvoiceItemsDropZone>
              </div>
            </div>
          </div>
        </div>

        </div>
      </div>
      <DragOverlay>
        {draggedProduct ? (
          <div className="cursor-grabbing rounded-lg border border-blue-400 bg-white p-3 shadow-xl ring-2 ring-blue-400 dark:bg-gray-800">
            <ProductCardContent
              product={draggedProduct}
              customPrice={customerPricing[draggedProduct.id]?.custom_price}
              customQuantity={customerPricing[draggedProduct.id]?.custom_quantity}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}