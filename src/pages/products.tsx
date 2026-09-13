import { useEffect, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, Select, Spinner } from '@fluentui/react-components';
import { Add20Regular, Delete20Regular, Edit20Regular, Money20Regular, People20Regular, Save20Regular } from '@fluentui/react-icons';
import { db } from '../db';
import { customerProducts, products, users } from '../db/schema';
import { eq } from 'drizzle-orm';

type Product = typeof products.$inferSelect;
type Customer = typeof users.$inferSelect;
type Assignment = typeof customerProducts.$inferSelect & { product: Product };
const productUnits = ['lfm / m', 'm²', 'm³', 'Stk.'] as const;

function formatPrice(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function getCustomerName(customer: Customer) {
  const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  return customer.company_name || fullName || 'Unbekannter Kunde';
}

function DraggableProduct({ product, assigned, onEdit, onDelete }: { product: Product; assigned: boolean; onEdit?: () => void; onDelete?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `product-${product.id}` });
  return (
      <div ref={setNodeRef} {...listeners} {...attributes} className={`cursor-grab rounded-lg border bg-white p-3 shadow-sm hover:border-blue-400 active:cursor-grabbing dark:bg-gray-700 ${isDragging ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0"><div className="truncate text-sm font-semibold">{product.name}</div><div className="mt-1 text-xs text-gray-500">{product.description || 'Keine Beschreibung'}</div></div>
        <div className="shrink-0 text-right text-sm font-semibold text-blue-700 dark:text-blue-300"><div>{Number(product.price).toFixed(2)} {product.price_tag} / {product.product_unit || 'lfm / m'}</div><div className="text-xs font-normal text-gray-500">Menge: {Number(product.product_count || 0).toFixed(2)} {product.product_unit || 'lfm / m'}</div></div>
      </div>
      <div className="mt-2 flex justify-end gap-1">
        <Button size="small" appearance="subtle" icon={<Edit20Regular />} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onEdit?.(); window.dispatchEvent(new CustomEvent('billi:edit-product', { detail: product })); }} aria-label="Produkt bearbeiten" title="Produkt bearbeiten" />
        <Button size="small" appearance="subtle" icon={<Delete20Regular className="text-red-500" />} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDelete?.(); window.dispatchEvent(new CustomEvent('billi:delete-product', { detail: product })); }} aria-label="Produkt löschen" title="Produkt löschen" />
      </div>
      {assigned && <div className="mt-2 text-[10px] uppercase tracking-wide text-gray-400">Zugeordnet, weiter verwendbar</div>}
    </div>
  );
}

function DraggableAssignment({ assignment, onPriceChange, onQuantityChange, onUnassign }: { assignment: Assignment; onPriceChange: (id: number, value: string) => void; onQuantityChange?: (id: number, value: string) => void; onUnassign: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `assignment-${assignment.id}` });
  const [priceDraft, setPriceDraft] = useState(formatPrice(Number(assignment.custom_price)));
  const [quantityDraft, setQuantityDraft] = useState(formatPrice(Number(assignment.custom_quantity)));

  useEffect(() => {
    setPriceDraft(formatPrice(Number(assignment.custom_price)));
    setQuantityDraft(formatPrice(Number(assignment.custom_quantity)));
  }, [assignment.custom_price, assignment.custom_quantity]);

  const commitPrice = () => {
    const value = formatPrice(Number(priceDraft));
    setPriceDraft(value);
    onPriceChange(assignment.id, value);
  };

  const commitQuantity = () => {
    const value = formatPrice(Number(quantityDraft));
    setQuantityDraft(value);
    onQuantityChange?.(assignment.id, value);
    window.dispatchEvent(new CustomEvent('billi:update-quantity', { detail: { id: assignment.id, value } }));
  };

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-700 ${isDragging ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{assignment.product.name}</span>
        <Button appearance="subtle" size="small" icon={<Delete20Regular className="text-red-500" />} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onUnassign(assignment.id); }} aria-label="Produkt entfernen" title="Produkt entfernen" />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Money20Regular className="text-gray-400" />
        <Input type="number" min="0" step="0.01" size="small" value={priceDraft} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => setPriceDraft(event.target.value)} onBlur={commitPrice} aria-label={`Preis für ${assignment.product.name}`} />
        <span className="text-xs text-gray-500">{assignment.product.price_tag} / {assignment.product.product_unit || 'lfm / m'} · Menge: {Number(assignment.product.product_count || 0).toFixed(2)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Input type="number" min="0" step="0.01" size="small" value={quantityDraft} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => setQuantityDraft(event.target.value)} onBlur={commitQuantity} aria-label={`Menge für ${assignment.product.name}`} />
        <span className="text-xs text-gray-500">{assignment.product.product_unit || 'lfm / m'}</span>
      </div>
    </div>
  );
}

function CustomerDropZone({ customer, assignments, collapsed, onToggle, onPriceChange, onQuantityChange, onUnassign }: { customer: Customer; assignments: Assignment[]; collapsed: boolean; onToggle: () => void; onPriceChange: (id: number, value: string) => void; onQuantityChange?: (id: number, value: string) => void; onUnassign: (id: number) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: `customer-${customer.id}` });
  return (
      <section ref={setNodeRef} className={`flex min-h-52 flex-col rounded-xl border-2 bg-gray-50 p-4 transition dark:bg-gray-800 ${isOver ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}>
  <button type="button" onClick={onToggle} className="mb-3 flex w-full items-center gap-2 border-b border-gray-200 pb-2 text-left dark:border-gray-700"><People20Regular className="text-blue-600" /><div className="min-w-0"><h3 className="truncate font-semibold">{getCustomerName(customer)}</h3><p className="text-xs text-gray-500">{assignments.length} Produkt{assignments.length === 1 ? '' : 'e'} {collapsed ? '(anzeigen)' : '(ausblenden)'}</p></div></button>
  {!collapsed && <div className="grow space-y-2">{assignments.length === 0 ? <p className="py-4 text-center text-xs italic text-gray-400">Produkte hierher ziehen</p> : assignments.map((assignment) => <DraggableAssignment key={assignment.id} assignment={assignment} onPriceChange={onPriceChange} onQuantityChange={onQuantityChange} onUnassign={onUnassign} />)}</div>}
    </section>
  );
}

export default function ProductsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productList, setProductList] = useState<Product[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [collapsedCustomers, setCollapsedCustomers] = useState<Set<number>>(new Set());
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', priceTag: 'EUR', productUnit: 'lfm / m', productCount: '1.00' });

  async function loadData() {
    setIsLoading(true);
    try {
      const [loadedCustomers, loadedProducts, loadedAssignments] = await Promise.all([db.select().from(users), db.select().from(products), db.select().from(customerProducts)]);
      setCustomers(loadedCustomers);
      setProductList(loadedProducts);
      setAssignments(loadedAssignments.map((assignment) => ({ ...assignment, product: loadedProducts.find((product) => product.id === assignment.product_id)! })).filter((assignment) => assignment.product));
    } catch (error) { console.error('Fehler beim Laden der Produkte:', error); } finally { setIsLoading(false); }
  }

  useEffect(() => { loadData(); }, []);

  const createProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = Number(formatPrice(Number(newProduct.price)));
    const productCount = Number(formatPrice(Number(newProduct.productCount)));
    if (!newProduct.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(productCount) || productCount < 0) return;
    if (productToEdit) {
      await db.update(products).set({ name: newProduct.name.trim(), description: newProduct.description.trim(), price, price_tag: newProduct.priceTag.trim() || 'EUR', product_unit: newProduct.productUnit, product_count: productCount }).where(eq(products.id, productToEdit.id));
    } else {
      await db.insert(products).values({ name: newProduct.name.trim(), description: newProduct.description.trim(), price, price_tag: newProduct.priceTag.trim() || 'EUR', product_unit: newProduct.productUnit, product_count: productCount });
    }
    setNewProduct({ name: '', description: '', price: '', priceTag: 'EUR', productUnit: 'lfm / m', productCount: '1.00' });
    setProductToEdit(null);
    setIsProductDialogOpen(false);
    await loadData();
  };

  const editProduct = (product: Product) => {
    setProductToEdit(product);
    setNewProduct({ name: product.name, description: product.description || '', price: formatPrice(Number(product.price)), priceTag: product.price_tag, productUnit: product.product_unit || 'lfm / m', productCount: formatPrice(Number(product.product_count || 0)) });
    setIsProductDialogOpen(true);
  };

  useEffect(() => {
    const handleEdit = (event: Event) => editProduct((event as CustomEvent<Product>).detail);
    const handleDelete = (event: Event) => setProductToDelete((event as CustomEvent<Product>).detail);
    window.addEventListener('billi:edit-product', handleEdit);
    window.addEventListener('billi:delete-product', handleDelete);
    return () => {
      window.removeEventListener('billi:edit-product', handleEdit);
      window.removeEventListener('billi:delete-product', handleDelete);
    };
  }, []);

  const deleteProduct = async () => {
    if (!productToDelete) return;
    await db.delete(customerProducts).where(eq(customerProducts.product_id, productToDelete.id));
    await db.delete(products).where(eq(products.id, productToDelete.id));
    setProductToDelete(null);
    await loadData();
  };

  const assignProduct = async (productId: number, customerId: number) => {
      if (assignments.some((assignment) => assignment.product_id === productId && assignment.user_id === customerId)) return;
      const product = productList.find((item) => item.id === productId);
      if (!product) return;
      await db.insert(customerProducts).values({ user_id: customerId, product_id: productId, custom_price: product.price, custom_quantity: product.product_count || 0, sort_order: assignments.filter((item) => item.user_id === customerId).length });
      await loadData();
    };

  const moveAssignment = async (assignment: Assignment, customerId: number) => {
      if (assignment.user_id === customerId || assignments.some((item) => item.user_id === customerId && item.product_id === assignment.product_id)) return;
      await db.update(customerProducts).set({ user_id: customerId }).where(eq(customerProducts.id, assignment.id));
      await loadData();
    };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
      setActiveProduct(null);
      if (!over) return;
      const customerId = Number(String(over.id).replace('customer-', ''));
      if (!Number.isFinite(customerId)) return;
      const activeId = String(active.id);
      if (activeId.startsWith('assignment-')) {
        const assignment = assignments.find((item) => item.id === Number(activeId.replace('assignment-', '')));
        if (assignment) await moveAssignment(assignment, customerId);
        return;
      }
      const productId = Number(activeId.replace('product-', ''));
      if (Number.isFinite(productId)) await assignProduct(productId, customerId);
    };

  const updatePrice = async (assignmentId: number, value: string) => {
      const price = Number(formatPrice(Number(value)));
      if (!Number.isFinite(price) || price < 0) return;
      setAssignments((current) => current.map((assignment) => assignment.id === assignmentId ? { ...assignment, custom_price: price } : assignment));
      await db.update(customerProducts).set({ custom_price: price }).where(eq(customerProducts.id, assignmentId));
    };

  const updateQuantity = async (assignmentId: number, value: string) => {
      const quantity = Number(formatPrice(Number(value)));
      if (!Number.isFinite(quantity) || quantity < 0) return;
      setAssignments((current) => current.map((assignment) => assignment.id === assignmentId ? { ...assignment, custom_quantity: quantity } : assignment));
      await db.update(customerProducts).set({ custom_quantity: quantity }).where(eq(customerProducts.id, assignmentId));
    };

  useEffect(() => {
    const handleQuantityUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ id: number; value: string }>).detail;
      void updateQuantity(detail.id, detail.value);
    };
    window.addEventListener('billi:update-quantity', handleQuantityUpdate);
    return () => window.removeEventListener('billi:update-quantity', handleQuantityUpdate);
  }, [assignments]);

  const deleteAssignment = async (assignmentId: number) => {
      await db.delete(customerProducts).where(eq(customerProducts.id, assignmentId));
      setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
      setAssignmentToDelete(null);
    };

  const unassign = async (assignmentId: number) => {
      if (assignmentToDelete?.id === assignmentId) {
        await deleteAssignment(assignmentId);
        return;
      }
      const assignment = assignments.find((item) => item.id === assignmentId);
      if (assignment) setAssignmentToDelete(assignment);
    };

  return <div className="flex h-[calc(100vh-140px)] flex-col gap-4">
      <Dialog open={productToDelete !== null} onOpenChange={(_, data) => { if (!data.open) setProductToDelete(null); }}><DialogSurface><DialogBody><DialogTitle>Grundprodukt löschen?</DialogTitle><DialogContent>Möchtest du „{productToDelete?.name}“ wirklich löschen? Die Zuordnungen zu Kunden werden ebenfalls entfernt.</DialogContent><DialogActions><Button appearance="secondary" onClick={() => setProductToDelete(null)}>Abbrechen</Button><Button appearance="primary" className="bg-red-600 text-white hover:bg-red-700" onClick={deleteProduct}>Löschen</Button></DialogActions></DialogBody></DialogSurface></Dialog>
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><People20Regular /> Kundenprodukte</h2><p className="text-sm text-gray-500">Eigene Preise pro Kunde festlegen</p></div><Button appearance="primary" icon={<Add20Regular />} onClick={() => setIsProductDialogOpen(true)}>Produkt anlegen</Button></div>
      <Dialog open={isProductDialogOpen} onOpenChange={(_, data) => setIsProductDialogOpen(data.open)}><DialogSurface><DialogBody><DialogTitle>{productToEdit ? 'Produkt bearbeiten' : 'Neues Produkt anlegen'}</DialogTitle><DialogContent><form id="new-product-form" className="mt-4 flex flex-col gap-4" onSubmit={createProduct}><Field label="Name" required><Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required /></Field><Field label="Beschreibung"><Input value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} /></Field><div className="grid grid-cols-1 gap-3 sm:grid-cols-4"><Field label="Preis" required><Input type="number" min="0" step="0.01" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} onBlur={() => setNewProduct((current) => ({ ...current, price: formatPrice(Number(current.price)) }))} required /></Field><Field label="Menge" required><Input type="number" min="0" step="0.01" value={newProduct.productCount} onChange={(e) => setNewProduct({ ...newProduct, productCount: e.target.value })} onBlur={() => setNewProduct((current) => ({ ...current, productCount: formatPrice(Number(current.productCount)) }))} required /></Field><Field label="Währung"><Input value={newProduct.priceTag} onChange={(e) => setNewProduct({ ...newProduct, priceTag: e.target.value })} /></Field><Field label="Einheit" required><Select value={newProduct.productUnit} onChange={(e) => setNewProduct({ ...newProduct, productUnit: e.target.value })}>{productUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</Select></Field></div></form></DialogContent><DialogActions><Button appearance="secondary" onClick={() => setIsProductDialogOpen(false)}>Abbrechen</Button><Button appearance="primary" type="submit" form="new-product-form" icon={<Save20Regular />}>{productToEdit ? 'Speichern' : 'Anlegen'}</Button></DialogActions></DialogBody></DialogSurface></Dialog>
      <Dialog open={assignmentToDelete !== null} onOpenChange={(_, data) => { if (!data.open) setAssignmentToDelete(null); }}><DialogSurface><DialogBody><DialogTitle>Produkt-Zuordnung löschen?</DialogTitle><DialogContent>Möchtest du „{assignmentToDelete?.product.name}“ wirklich von diesem Kunden entfernen?</DialogContent><DialogActions><Button appearance="secondary" onClick={() => setAssignmentToDelete(null)}>Abbrechen</Button><Button appearance="primary" className="bg-red-600 text-white hover:bg-red-700" onClick={() => assignmentToDelete && unassign(assignmentToDelete.id)}>Löschen</Button></DialogActions></DialogBody></DialogSurface></Dialog>
      {isLoading ? <div className="flex grow items-center justify-center"><Spinner label="Lade Kunden und Produkte..." /></div> : <DndContext onDragStart={({ active }) => { const id = String(active.id); const assignment = id.startsWith('assignment-') ? assignments.find((item) => item.id === Number(id.replace('assignment-', ''))) : null; const productId = assignment?.product_id ?? Number(id.replace('product-', '')); setActiveProduct(productList.find((product) => product.id === productId) || null); }} onDragEnd={handleDragEnd} onDragCancel={() => setActiveProduct(null)}><div className="grid min-h-0 grow grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,2fr)]"><aside className="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><h3 className="mb-3 border-b border-gray-200 pb-2 font-bold dark:border-gray-700">Produkte ({productList.length})</h3><div className="min-h-0 grow space-y-3 overflow-y-auto pr-1">{productList.length === 0 ? <p className="text-sm text-gray-500">Noch keine Produkte angelegt.</p> : productList.map((product) => <DraggableProduct key={product.id} product={product} assigned={assignments.some((assignment) => assignment.product_id === product.id)} />)}</div></aside><main className="min-h-0 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{customers.map((customer) => <CustomerDropZone key={customer.id} customer={customer} collapsed={collapsedCustomers.has(customer.id)} onToggle={() => setCollapsedCustomers((current) => { const next = new Set(current); if (next.has(customer.id)) next.delete(customer.id); else next.add(customer.id); return next; })} assignments={assignments.filter((assignment) => assignment.user_id === customer.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))} onPriceChange={updatePrice} onUnassign={unassign} />)}</div>{customers.length === 0 && <p className="py-8 text-center text-gray-500">Noch keine Kunden angelegt.</p>}</main></div><DragOverlay>{activeProduct && <div className="rounded-lg border-2 border-blue-500 bg-white p-3 shadow-xl dark:bg-gray-700"><span className="font-semibold">{activeProduct.name}</span></div>}</DragOverlay></DndContext>}
    </div>;
}