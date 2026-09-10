import { useState } from 'react';
import { CustomerForm } from '../components/customerForm';
import { ClientList } from '../components/ClientList';
import { 
  Button, 
  Dialog, 
  DialogSurface, 
  DialogBody, 
  DialogTitle, 
  DialogContent 
} from '@fluentui/react-components';
import { PersonAdd20Regular } from '@fluentui/react-icons';

export default function Customers() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Dieser State steuert, ob das Modal sichtbar ist oder nicht
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="flex flex-col items-center h-[calc(100vh-140px)]"> 
      {/* Container noch etwas breiter gemacht (max-w-5xl), damit die Tabelle/Datenbank gut wirkt */}
      <div className="w-full max-w-5xl h-full flex flex-col gap-4">
        
        {/* TOOLBAR: Titel und Hinzufügen-Button */}
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
           <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Kunden Datenbank</h2>
           
           <Button 
             appearance="primary" 
             icon={<PersonAdd20Regular />} 
             onClick={() => setIsDialogOpen(true)} // Öffnet das Modal
           >
             Neuen Kunden anlegen
           </Button>
        </div>

        {/* DAS MODAL (Dialog) */}
        {/* onOpenChange wird getriggert, wenn der Nutzer z.B. neben das Modal klickt oder ESC drückt */}
        <Dialog 
          open={isDialogOpen} 
          onOpenChange={(_event, data) => setIsDialogOpen(data.open)}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Kunde anlegen</DialogTitle>
              <DialogContent className="pt-4">
                {/* Unser Formular. Es bekommt die Funktion zum Schließen übergeben */}
                <CustomerForm 
                  onClientAdded={() => setRefreshTrigger(prev => prev + 1)} 
                  onCancel={() => setIsDialogOpen(false)} 
                />
              </DialogContent>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        {/* DATENBANK / LISTE (Nimmt jetzt den restlichen Platz ein) */}
        <div className="grow overflow-y-auto no-scrollbar bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <ClientList refreshTrigger={refreshTrigger} />
</div>

      </div>
    </div>
  );
}