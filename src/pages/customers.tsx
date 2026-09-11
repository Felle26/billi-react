import { useState } from 'react';
import { CustomerForm } from '../components/customerForm';
import { ClientList } from '../components/ClientList';
import { 
  Button, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent 
} from '@fluentui/react-components';
import { PersonAdd20Regular } from '@fluentui/react-icons';

export default function Customers() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // HIER NEU: Speichert das Kundenobjekt, wenn bearbeitet wird (sonst null)
  const [clientToEdit, setClientToEdit] = useState<any>(null);

  const openNewClientModal = () => {
    setClientToEdit(null); // Setzt es auf "Neu anlegen"
    setIsDialogOpen(true);
  };

  return (
    <div className="flex flex-col items-center h-[calc(100vh-140px)]"> 
      <div className="w-full max-w-5xl h-full flex flex-col gap-4">
        
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
           <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Kunden Datenbank</h2>
           <Button appearance="primary" icon={<PersonAdd20Regular />} onClick={openNewClientModal}>
             Neuen Kunden anlegen
           </Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(_, data) => setIsDialogOpen(data.open)}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>{clientToEdit ? 'Kunde bearbeiten' : 'Kunde anlegen'}</DialogTitle>
              <DialogContent className="pt-4">
                <CustomerForm 
                  clientToEdit={clientToEdit}
                  onClientAdded={() => setRefreshTrigger(prev => prev + 1)} 
                  onCancel={() => setIsDialogOpen(false)} 
                />
              </DialogContent>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <div className="grow overflow-y-auto no-scrollbar bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <ClientList 
            refreshTrigger={refreshTrigger} 
            onEditClient={(client) => {
              setClientToEdit(client); // Übergibt die Kundendaten an den State
              setIsDialogOpen(true);   // Öffnet das Modal
            }}
          />
        </div>

      </div>
    </div>
  );
}