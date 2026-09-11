import { useState, useEffect } from 'react';
import { Field, Input, Button, Combobox, Option, ComboboxProps } from '@fluentui/react-components';
import { Save20Regular, Dismiss20Regular } from '@fluentui/react-icons';
import { message } from '@tauri-apps/plugin-dialog';
import { db } from '../db';
import { objects, users } from '../db/schema';
import { eq } from 'drizzle-orm';

interface ObjectFormProps {
  onObjectSaved?: () => void;
  onObjectAdded?: () => void;
  onCancel: () => void;
  objectToEdit?: any;
}

export function ObjectForm({ onObjectSaved, onObjectAdded, onCancel, objectToEdit }: ObjectFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [userId, setUserId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Deutschland');

  const [customers, setCustomers] = useState<any[]>([]);

  // Lade alle Kunden aus SQLite
  useEffect(() => {
    async function fetchCustomers() {
      const result = await db.select().from(users);
      setCustomers(result);
    }
    fetchCustomers();
  }, []);

  // Fülle die Felder, falls wir bearbeiten, oder setze zurück
  useEffect(() => {
    if (objectToEdit) {
      setName(objectToEdit.name || '');
      setDescription(objectToEdit.description || '');
      setUserId(objectToEdit.user_id?.toString() || '');
      setStreet(objectToEdit.street || '');
      setNumber(objectToEdit.number || '');
      setZip(objectToEdit.zip || '');
      setCity(objectToEdit.city || '');
      setCountry(objectToEdit.country || 'Deutschland');
    } else {
      setName('');
      setDescription('');
      setUserId('');
      setCustomerQuery('');
      setStreet('');
      setNumber('');
      setZip('');
      setCity('');
      setCountry('Deutschland');
    }
  }, [objectToEdit]);

  // Setze den angezeigten Kundennamen, sobald Kunden oder userId geladen sind
  useEffect(() => {
    if (userId && customers.length > 0) {
      const selected = customers.find(c => c.id.toString() === userId);
      if (selected) {
        const fullName = `${selected.first_name || ''} ${selected.last_name || ''}`.trim();
        setCustomerQuery(selected.company_name || fullName || 'Unbekannter Kunde');
      }
    } else if (!userId) {
      setCustomerQuery('');
    }
  }, [userId, customers]);

  // 1. Wenn der Nutzer tippt (Suche/Filterung)
  const handleCustomerSearch: ComboboxProps['onChange'] = (e) => {
    setCustomerQuery(e.target.value);
  };

  // 2. Wenn der Nutzer auswählt (Übernahme der ID & Adresse)
  const handleCustomerSelect: ComboboxProps['onOptionSelect'] = (_e, data) => {
    const selectedId = data.optionValue;

    if (selectedId) {
      setUserId(selectedId);
      setCustomerQuery(data.optionText || '');

      // Autofill für die Adresse (nur bei neuen Objekten)
      if (!objectToEdit) {
        const selectedCustomer = customers.find(c => c.id.toString() === selectedId);
        if (selectedCustomer) {
          setStreet(selectedCustomer.street || '');
          setNumber(selectedCustomer.number || '');
          setZip(selectedCustomer.zip || '');
          setCity(selectedCustomer.city || '');
          setCountry(selectedCustomer.country || 'Deutschland');
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!userId) {
      await message("Bitte wähle einen Kunden aus, dem dieses Objekt gehört!", { title: 'Hinweis', kind: 'warning' });
      return;
    }

    try {
      const objectData = {
        name,
        description,
        user_id: parseInt(userId),
        street,
        number,
        zip,
        city,
        country,
        updated_at: new Date()
      };

      if (objectToEdit) {
        await db.update(objects)
                .set(objectData)
                .where(eq(objects.id, objectToEdit.id));
      } else {
        await db.insert(objects).values({
            ...objectData,
            created_at: new Date()
        });
      }

      if (onObjectSaved) {
        onObjectSaved();
      } else if (onObjectAdded) {
        onObjectAdded();
      }
      onCancel();
    } catch (error) {
      console.error("Fehler beim Speichern des Objekts:", error);
      await message("Objekt konnte nicht gespeichert werden.", { title: 'Fehler', kind: 'error' });
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.toLowerCase();
    const company = (customer.company_name || '').toLowerCase();
    const cityText = (customer.city || '').toLowerCase();
    const query = customerQuery.toLowerCase();
    return fullName.includes(query) || company.includes(query) || cityText.includes(query);
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="md:col-span-2">
          <Field label="Zugehöriger Kunde" required>
            <Combobox 
              placeholder="Kunde suchen oder auswählen..."
              value={customerQuery} 
              selectedOptions={userId ? [userId] : []}
              onChange={handleCustomerSearch}
              onOptionSelect={handleCustomerSelect}
            >
              {filteredCustomers.map(customer => {
                const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
                const finalName = customer.company_name || fullName || 'Unbekannter Kunde';

                return (
                  <Option key={customer.id} value={customer.id.toString()} text={`${finalName} (${customer.city || 'Unbekannt'})`}>
                    {finalName} ({customer.city || 'Unbekannt'})
                  </Option>
                );
              })}
            </Combobox>
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label="Objekt-Name (z.B. Bürokomplex Nord)" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label="Beschreibung / Notizen (optional)">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        <Field label="Straße" required>
          <Input value={street} onChange={(e) => setStreet(e.target.value)} required />
        </Field>
        
        <Field label="Hausnummer" required>
          <Input value={number} onChange={(e) => setNumber(e.target.value)} required />
        </Field>

        <Field label="PLZ" required>
          <Input value={zip} onChange={(e) => setZip(e.target.value)} required />
        </Field>
        
        <Field label="Ort" required>
          <Input value={city} onChange={(e) => setCity(e.target.value)} required />
        </Field>

      </div>

      <div className="flex justify-end gap-3 mt-2">
        <Button type="button" appearance="subtle" icon={<Dismiss20Regular />} onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" appearance="primary" icon={<Save20Regular />}>
          {objectToEdit ? 'Änderungen speichern' : 'Objekt anlegen'}
        </Button>
      </div>
    </form>
  );
}