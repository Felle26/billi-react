import { useState } from 'react';
import { ObjectForm } from '../components/ObjectForm';
import { ObjectList } from '../components/objectList';
import { 
  Button, 
  Dialog, 
  DialogSurface, 
  DialogBody, 
  DialogTitle, 
  DialogContent 
} from '@fluentui/react-components';
import { Building20Regular } from '@fluentui/react-icons'; // Passendes Gebäude-Icon

export default function CustomerObjects() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // States für das Modal (Dialog)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [objectToEdit, setObjectToEdit] = useState<any>(null);

  // Öffnet das Modal für ein komplett NEUES Objekt
  const openNewObjectModal = () => {
    setObjectToEdit(null); // Formular leeren
    setIsDialogOpen(true);
  };

  return (
    <div className="flex flex-col items-center h-[calc(100vh-140px)]"> 
      <div className="w-full max-w-5xl h-full flex flex-col gap-4">
        
        {/* TOOLBAR: Titel und Hinzufügen-Button */}
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
           <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Objekt Verwaltung</h2>
           
           <Button 
             appearance="primary" 
             icon={<Building20Regular />} 
             onClick={openNewObjectModal} // Öffnet das Modal
           >
             Neues Objekt anlegen
           </Button>
        </div>

        {/* DAS MODAL (Dialog) für das Formular */}
        <Dialog 
          open={isDialogOpen} 
          onOpenChange={(_event, data) => {
            setIsDialogOpen(data.open);
            if (!data.open) {
              setObjectToEdit(null);
            }
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>{objectToEdit ? 'Objekt bearbeiten' : 'Objekt anlegen'}</DialogTitle>
              <DialogContent className="pt-4">
                {isDialogOpen && (
                  <ObjectForm 
                    objectToEdit={objectToEdit}
                    onObjectSaved={() => {
                      setRefreshTrigger(prev => prev + 1);
                      setIsDialogOpen(false);
                      setObjectToEdit(null);
                    }}
                    onCancel={() => {
                      setIsDialogOpen(false);
                      setObjectToEdit(null);
                    }}
                  />
                )}
              </DialogContent>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        {/* LISTEN-ANSICHT (Dein schickes Card-Grid) */}
        <div className="grow overflow-y-auto no-scrollbar bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <ObjectList 
            refreshTrigger={refreshTrigger} 
            onEditObject={(obj) => {
              setObjectToEdit(obj);  // Übergibt die Objektdaten an den State
              setIsDialogOpen(true); // Öffnet das Modal zum Bearbeiten
            }}
          />
        </div>

      </div>
    </div>
  );
}