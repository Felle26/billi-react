import { useState } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';

export default function RoutePlanner() {
  
  // Diese Funktion feuert später, sobald du eine Objekt-Kachel loslässt
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    // active.id = Die ID des Objekts, das du gezogen hast
    // over.id = Die ID der Tour (Dropzone), über der du es losgelassen hast
    if (over && active.id !== over.id) {
      console.log(`Objekt ${active.id} wurde in Tour ${over.id} verschoben!`);
      // Hier kommt später unser Drizzle-Datenbank-Update hin
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Tourenplanung (Drag & Drop)</h2>
      </div>

      {/* DndContext überwacht alle Drag & Drop Aktionen innerhalb dieses Bereichs */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grow grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
          
          {/* LINKE SPALTE: Der Pool (Alle Objekte ohne Tour) */}
          <div className="lg:col-span-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col h-full">
            <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              Nicht zugewiesene Objekte
            </h3>
            
            <div className="grow overflow-y-auto space-y-3 pr-2 no-scrollbar">
              {/* Hier rendern wir im nächsten Schritt die ziehbaren Kacheln */}
              <div className="p-4 bg-white dark:bg-gray-800 border border-dashed border-gray-400 rounded-lg text-center text-gray-500">
                Platzhalter: Objekt Pool
              </div>
            </div>
          </div>

          {/* RECHTE SPALTE: Die Touren (Dropzones) */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col h-full">
            <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4">
              Geplante Touren
            </h3>
            
            {/* Hier kommt ein Grid für deine verschiedenen Touren-Boxen hin */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2 no-scrollbar">
              
              <div className="min-h-50 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
                <h4 className="font-semibold mb-3">Platzhalter: Tour A</h4>
              </div>
              
              <div className="min-h-50 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
                <h4 className="font-semibold mb-3">Platzhalter: Tour B</h4>
              </div>

            </div>
          </div>

        </div>
      </DndContext>
    </div>
  );
}