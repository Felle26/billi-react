import { useState, useEffect } from 'react';
import { Field, Input, Button } from '@fluentui/react-components';
import { Save20Regular, Dismiss20Regular } from '@fluentui/react-icons';
import { db } from '../db';
import { planned_routes } from '../db/schema';
import { eq } from 'drizzle-orm';

interface RouteFormProps {
  onRouteAdded: () => void;
  onCancel: () => void;
  routeToEdit?: any;
}

export function RouteForm({ onRouteAdded, onCancel, routeToEdit }: RouteFormProps) {
  const [routeName, setRouteName] = useState('');

  // Füllt das Feld, falls wir eine bestehende Route bearbeiten
  useEffect(() => {
    if (routeToEdit) {
      setRouteName(routeToEdit.route_name || '');
    }
  }, [routeToEdit]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!routeName.trim()) {
      alert("Bitte gib einen Namen für die Route ein.");
      return;
    }

    try {
      const routeData = {
        route_name: routeName.trim()
      };

      if (routeToEdit) {
        // UPDATE: Bestehende Route anpassen
        await db.update(planned_routes)
                .set(routeData)
                .where(eq(planned_routes.id, routeToEdit.id));
      } else {
        // INSERT: Neue Route anlegen
        await db.insert(planned_routes).values(routeData);
      }

      onRouteAdded(); // Sagt der Liste, dass sie sich neu laden soll
      onCancel();     // Schließt das Modal
    } catch (error) {
      console.error("Fehler beim Speichern der Route:", error);
      alert("Route konnte nicht gespeichert werden.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      
      <Field label="Name der Route / Tour (z.B. Montags-Tour Nord)" required>
        <Input 
          value={routeName} 
          onChange={(e) => setRouteName(e.target.value)} 
          placeholder="Routen-Name eingeben..."
          required 
          autoFocus
        />
      </Field>

      <div className="flex justify-end gap-3 mt-2">
        <Button 
          type="button" 
          appearance="subtle" 
          icon={<Dismiss20Regular />} 
          onClick={onCancel}
        >
          Abbrechen
        </Button>
        <Button 
          type="submit" 
          appearance="primary" 
          icon={<Save20Regular />}
        >
          {routeToEdit ? 'Änderungen speichern' : 'Route anlegen'}
        </Button>
      </div>

    </form>
  );
}