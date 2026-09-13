import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { db } from '../db';
import { objects, planned_routes, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Spinner } from '@fluentui/react-components';
import { Building20Regular, Map20Regular, SubtractCircle20Regular, Add20Regular, Edit20Regular, Delete20Regular } from '@fluentui/react-icons';
import { RouteForm } from '../components/RouteForm';
import './../App.css'

function DraggableObjectCard({ object, onClickUnassign }: { object: any; onClickUnassign?: (objectId: number) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `object-${object.id}`,
    data: { type: 'object', objectId: object.id, routeId: object.planned_route_Id ?? null },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={[
        'p-3 scroll-animation bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400 transition-colors',
        isDragging ? 'opacity-30 border-dashed border-blue-400' : '',
        'no-scrollbar',
      ].join(' ')}
    >
      <div className="font-semibold text-sm flex items-center gap-2">
        <Building20Regular className="text-gray-400" /> {object.name}
      </div>
      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">{object.customerName}</div>
      <div className="text-xs text-gray-500 mt-1">{object.city}</div>
      {object.planned_route_Id !== null && object.planned_route_Id !== undefined && onClickUnassign && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClickUnassign(object.id);
          }}
          className="mt-2 text-[10px] uppercase tracking-wide text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-300"
        >
          Nicht zugewiesen
        </button>
      )}
    </div>
  );
}

function SortableObjectItem({ object, index, onUnassign, isActiveDrag }: { object: any; index: number; onUnassign: () => void; isActiveDrag?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: `object-${object.id}`,
    data: { type: 'object', objectId: object.id, routeId: object.planned_route_Id ?? null },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : 10,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isOver && (
        <div className="absolute left-0 right-0 -top-1 h-1 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.9)]" />
      )}

      <div
        {...attributes}
        {...listeners}
        className={[
          'p-2 scroll-animation bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm shadow-sm cursor-grab active:cursor-grabbing transition-all',
          isDragging ? 'opacity-50 scale-[0.98] ring-2 ring-blue-300 dark:ring-blue-500' : '',
          isOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30 shadow-md' : '',
          isActiveDrag ? 'ring-2 ring-blue-200 dark:ring-blue-600' : '',
        ].join(' ')}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{object.name}</div>
            <div className="text-xs text-gray-500">{object.city}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              appearance="subtle"
              icon={<SubtractCircle20Regular className="text-red-500 hover:text-red-700" />}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUnassign();
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              aria-label="Von Route lösen"
              title="Von Route lösen"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RouteDropZone({
  route,
  routeObjects,
  onUnassignObject,
  activeDragId,
  onRemoveRoute,
  onEditRoute,
}: {
  route: any;
  routeObjects: any[];
  onUnassignObject: (objectId: number) => void;
  activeDragId: number | null;
  onRemoveRoute: (routeId: number) => void;
  onEditRoute: (route: any) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `route-${route.id}`,
    data: { type: 'route', routeId: route.id },
  });

  const orderedRouteObjects = [...routeObjects].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  return (
    <div
      ref={setNodeRef}
      className={[
        'min-h-50 scroll-animation bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed p-4 flex flex-col transition-all duration-200 shadow-sm',
        isOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/25 ring-4 ring-blue-200 dark:ring-blue-800 shadow-[0_0_0_4px_rgba(96,165,250,0.18)] animate-pulse' : 'border-gray-300 dark:border-gray-600',
      ].join(' ')}
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b pb-2">
        <h4 className="font-semibold text-gray-800 dark:text-gray-200 truncate">
          {route.route_name}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="small"
            appearance="subtle"
            icon={<Edit20Regular />}
            onClick={() => onEditRoute(route)}
            aria-label="Route bearbeiten"
            title="Route bearbeiten"
          />
          <Button
            size="small"
            appearance="subtle"
            icon={<Delete20Regular className="text-red-600 hover:text-red-700" />}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveRoute(route.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            aria-label="Route entfernen"
            title="Route entfernen"
          />
        </div>
      </div>

      <div className="grow space-y-2 overflow-y-auto max-h-72 pr-1 no-scrollbar">
        {orderedRouteObjects.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center mt-2">Tour ist leer</p>
        ) : (
          <SortableContext items={orderedRouteObjects.map(obj => `object-${obj.id}`)} strategy={verticalListSortingStrategy}>
            {orderedRouteObjects.map((obj, index) => (
              <SortableObjectItem
                key={obj.id}
                object={obj}
                index={index}
                onUnassign={() => onUnassignObject(obj.id)}
                isActiveDrag={activeDragId === obj.id}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

export default function RoutePlanner() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [allObjects, setAllObjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<number | null>(null);
  const [isUnassignObjectConfirmOpen, setIsUnassignObjectConfirmOpen] = useState(false);
  const [objectToUnassign, setObjectToUnassign] = useState<any | null>(null);
  const [routeToEdit, setRouteToEdit] = useState<any>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const loadedRoutes = await db.select().from(planned_routes);
      setRoutes(loadedRoutes);

      const loadedObjects = await db
        .select({
          object: objects,
          companyName: users.company_name,
          firstName: users.first_name,
          lastName: users.last_name,
        })
        .from(objects)
        .leftJoin(users, eq(objects.user_id, users.id));

      const formattedObjects = loadedObjects.map(row => {
        const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim();
        const finalName = row.companyName || fullName || 'Unbekannter Kunde';
        return {
          ...row.object,
          customerName: finalName,
        };
      });

      setAllObjects(formattedObjects);
    } catch (error) {
      console.error('Fehler beim Laden der Tourenplanung:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openNewRouteModal = () => {
    setRouteToEdit(null);
    setIsDialogOpen(true);
  };

  const deleteRoute = async (routeId: number) => {
    const routeObjects = allObjects.filter(obj => obj.planned_route_Id === routeId);

    for (const obj of routeObjects) {
      await db
        .update(objects)
        .set({ planned_route_Id: null, sort_order: 0 })
        .where(eq(objects.id, obj.id));
    }

    await db
      .delete(planned_routes)
      .where(eq(planned_routes.id, routeId));

    setRoutes(prev => prev.filter(route => route.id !== routeId));
    setAllObjects(prev => prev.map(obj =>
      obj.planned_route_Id === routeId
        ? { ...obj, planned_route_Id: null, sort_order: 0 }
        : obj
    ));

    await loadData();
  };

  const confirmDeleteRoute = (routeId: number) => {
    setRouteToDelete(routeId);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (routeToDelete === null) {
      return;
    }

    await deleteRoute(routeToDelete);
    setIsDeleteConfirmOpen(false);
    setRouteToDelete(null);
  };

  const openEditRouteModal = (route: any) => {
    setRouteToEdit(route);
    setIsDialogOpen(true);
  };

  const confirmUnassignObject = (objectId: number) => {
    const targetObj = allObjects.find(obj => obj.id === objectId);
    setObjectToUnassign(targetObj || { id: objectId });
    setIsUnassignObjectConfirmOpen(true);
  };

  const handleUnassignObjectConfirmed = async () => {
    if (!objectToUnassign) {
      return;
    }

    await moveObjectToUnassigned(objectToUnassign.id);
    setIsUnassignObjectConfirmOpen(false);
    setObjectToUnassign(null);
  };

  const moveObjectToUnassigned = async (objectId: number) => {
    const sourceRouteId = allObjects.find(obj => obj.id === objectId)?.planned_route_Id;

    if (!Number.isFinite(objectId)) {
      return;
    }

    const routeObjects = sourceRouteId === undefined || sourceRouteId === null
      ? []
      : [...allObjects]
          .filter(obj => obj.planned_route_Id === sourceRouteId && obj.id !== objectId)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    await Promise.all([
      db
        .update(objects)
        .set({ planned_route_Id: null, sort_order: 0 })
        .where(eq(objects.id, objectId)),
      ...routeObjects.map((obj, index) =>
        db
          .update(objects)
          .set({ planned_route_Id: sourceRouteId, sort_order: index })
          .where(eq(objects.id, obj.id))
      ),
    ]);

    setAllObjects(prev => prev.map(obj =>
      obj.id === objectId
        ? { ...obj, planned_route_Id: null, sort_order: 0 }
        : obj
    ));

    await loadData();
  };

  const handleDragStart = (event: { active: any }) => {
    const objectId = Number(String(event.active.id).replace('object-', ''));
    if (Number.isFinite(objectId)) {
      setActiveDragId(objectId);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) {
      return;
    }

    const activeObjectId = Number(String(active.id).replace('object-', ''));
    const overId = String(over.id);
    const activeObject = allObjects.find(obj => obj.id === activeObjectId);

    if (!activeObject || !Number.isFinite(activeObjectId)) {
      return;
    }

    const sourceRouteId = activeObject.planned_route_Id ?? null;

    if (overId === 'unassigned-pool') {
      await moveObjectToUnassigned(activeObjectId);
      return;
    }

    let targetRouteId: number | null = sourceRouteId;
    let targetObjectId: number | null = null;

    if (overId.startsWith('route-')) {
      targetRouteId = Number(overId.replace('route-', ''));
    } else if (overId.startsWith('object-')) {
      targetObjectId = Number(overId.replace('object-', ''));
      const overObject = allObjects.find(obj => obj.id === targetObjectId);
      targetRouteId = overObject?.planned_route_Id ?? sourceRouteId;
    }

    if (!targetRouteId && targetRouteId !== null) {
      return;
    }

    const sourceObjects = allObjects
      .filter(obj => obj.planned_route_Id === sourceRouteId && obj.id !== activeObjectId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const targetObjects = allObjects
      .filter(obj => obj.planned_route_Id === targetRouteId && obj.id !== activeObjectId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const routeObjects = targetRouteId === null ? [] : targetObjects;
    const activeToMove = { ...activeObject, planned_route_Id: targetRouteId, sort_order: 0 };

    if (targetObjectId !== null) {
      const insertIndex = routeObjects.findIndex(obj => obj.id === targetObjectId);
      if (insertIndex >= 0) {
        routeObjects.splice(insertIndex, 0, activeToMove as any);
      } else {
        routeObjects.push(activeToMove as any);
      }
    } else if (targetRouteId !== null) {
      routeObjects.push(activeToMove as any);
    }

    const updates: Promise<any>[] = [];

    if (sourceRouteId !== null && sourceRouteId !== targetRouteId) {
      sourceObjects.forEach((obj, index) => {
        updates.push(
          db
            .update(objects)
            .set({ planned_route_Id: sourceRouteId, sort_order: index })
            .where(eq(objects.id, obj.id))
        );
      });
    }

    if (targetRouteId !== null) {
      routeObjects.forEach((obj, index) => {
        updates.push(
          db
            .update(objects)
            .set({ planned_route_Id: targetRouteId, sort_order: index })
            .where(eq(objects.id, obj.id))
        );
      });
    } else {
      updates.push(
        db
          .update(objects)
          .set({ planned_route_Id: null, sort_order: 0 })
          .where(eq(objects.id, activeObjectId))
      );
    }

    if (sourceRouteId !== null && sourceRouteId === targetRouteId) {
      const reordered = [...routeObjects].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      reordered.forEach((obj, index) => {
        updates.push(
          db
            .update(objects)
            .set({ planned_route_Id: targetRouteId, sort_order: index })
            .where(eq(objects.id, obj.id))
        );
      });
    }

    await Promise.all(updates);
    await loadData();
  };

  const unassignedObjects = allObjects.filter(obj => !obj.planned_route_Id);
  const activeDragObject = activeDragId ? allObjects.find(obj => obj.id === activeDragId) : null;

  const { isOver: isUnassignedOver, setNodeRef: setUnassignedRef } = useDroppable({
    id: 'unassigned-pool',
    data: { type: 'unassigned' },
  });

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Map20Regular /> Tourenplanung
        </h2>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="text-sm text-blue-500 hover:underline">🔄 Aktualisieren</button>
          <Button appearance="primary" icon={<Add20Regular />} onClick={openNewRouteModal}>
            Neue Route
          </Button>
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(_, data) => {
          setIsDialogOpen(data.open);
          if (!data.open) {
            setRouteToEdit(null);
          }
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{routeToEdit ? 'Route bearbeiten' : 'Neue Route anlegen'}</DialogTitle>
            <DialogContent className="pt-4">
              {isDialogOpen && (
                <RouteForm
                  routeToEdit={routeToEdit}
                  onRouteAdded={() => {
                    loadData();
                    setIsDialogOpen(false);
                    setRouteToEdit(null);
                  }}
                  onCancel={() => {
                    setIsDialogOpen(false);
                    setRouteToEdit(null);
                  }}
                />
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog
        open={isDeleteConfirmOpen}
        onOpenChange={(_, data) => {
          setIsDeleteConfirmOpen(data.open);
          if (!data.open) {
            setRouteToDelete(null);
          }
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Tour wirklich entfernen?</DialogTitle>
            <DialogContent>
              Die zugehörigen Objekte werden aus dieser Tour entfernt und die Tour selbst gelöscht.
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsDeleteConfirmOpen(false)}>
                Abbrechen
              </Button>
              <Button appearance="primary" onClick={handleDeleteConfirmed} className="bg-red-600 hover:bg-red-700 text-white">
                Entfernen
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog
        open={isUnassignObjectConfirmOpen}
        onOpenChange={(_, data) => {
          setIsUnassignObjectConfirmOpen(data.open);
          if (!data.open) {
            setObjectToUnassign(null);
          }
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Objekt von der Tour lösen?</DialogTitle>
            <DialogContent>
              Möchtest du {objectToUnassign?.name ? `"${objectToUnassign.name}"` : 'dieses Objekt'} wirklich von der Tour entfernen und wieder auf "Unzugewiesen" setzen?
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsUnassignObjectConfirmOpen(false)}>
                Abbrechen
              </Button>
              <Button appearance="primary" onClick={handleUnassignObjectConfirmed} className="bg-red-600 hover:bg-red-700 text-white">
                Lösen
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {isLoading ? (
        <div className="grow flex justify-center items-center">
          <Spinner label="Lade Touren und Objekte..." />
        </div>
      ) : (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragId(null)}>
          <div className="grow grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden min-h-0">
            <div
              ref={setUnassignedRef}
              className={[
                'lg:col-span-1 relative z-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col h-full min-h-0 transition-all duration-200',
                isUnassignedOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 animate-pulse' : '',
              ].join(' ')}
            >
              <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
                Unzugewiesen ({unassignedObjects.length})
              </h3>

              <div className="grow min-h-0 overflow-y-auto space-y-3 pr-2 no-scrollbar">
                {unassignedObjects.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center mt-4">Alle Objekte sind zugewiesen!</p>
                ) : (
                  unassignedObjects.map(obj => (
                    <DraggableObjectCard key={obj.id} object={obj} onClickUnassign={confirmUnassignObject} />
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-3 relative z-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col h-full min-h-0">
              <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 shrink-0">
                Geplante Touren ({routes.length})
              </h3>

              <div className="grow min-h-0 overflow-y-auto pr-2 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-2">
                  {routes.length === 0 ? (
                    <p className="text-gray-500 col-span-full">Noch keine Touren angelegt. Lege zuerst eine Tour an.</p>
                  ) : (
                    routes.map(route => {
                      const routeObjects = allObjects.filter(o => o.planned_route_Id === route.id);
                      const isEmptyRoute = routeObjects.length === 0;

                      return (
                        <div key={route.id} className={isEmptyRoute ? 'opacity-70' : ''}>
                          <RouteDropZone
                            route={route}
                            routeObjects={routeObjects}
                            onUnassignObject={confirmUnassignObject}
                            activeDragId={activeDragId}
                            onRemoveRoute={confirmDeleteRoute}
                            onEditRoute={openEditRouteModal}
                          />
                          {isEmptyRoute && (
                            <div className="mt-2 rounded border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              Nicht zugewiesen
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <DragOverlay zIndex={1000}>
            {activeDragObject ? (
              <div className="p-3 bg-white dark:bg-gray-700 border-2 border-blue-500 rounded-lg shadow-2xl cursor-grabbing scale-105 pointer-events-none">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Building20Regular className="text-blue-500" /> {activeDragObject.name}
                </div>
                {activeDragObject.customerName && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">{activeDragObject.customerName}</div>
                )}
                <div className="text-xs text-gray-500 mt-1">{activeDragObject.city}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}