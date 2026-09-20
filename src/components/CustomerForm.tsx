import { useState, useEffect } from 'react';
import { Field, Input, Button } from '@fluentui/react-components';
import { Save20Regular, Dismiss20Regular } from '@fluentui/react-icons';
import { message } from '@tauri-apps/plugin-dialog';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

interface CustomerFormProps {
  onClientAdded: () => void;
  onCancel: () => void;
  clientToEdit?: any;
}

export function CustomerForm({ onClientAdded, onCancel, clientToEdit }: CustomerFormProps) {
  const [company, setCompany] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [customer_id, setCustomerId] = useState('');

  useEffect(() => {
    if (clientToEdit) {
      setCompany(clientToEdit.company_name || '');
      setFirstName(clientToEdit.first_name || '');
      setLastName(clientToEdit.last_name || '');
      setEmail(clientToEdit.email || '');
      setStreet(clientToEdit.street || '');
      setCity(clientToEdit.city || '');
      setHouseNumber(clientToEdit.number || '');
      setPostalCode(clientToEdit.zip || '');
      setPhone(clientToEdit.phone || '');
      setCustomerId(clientToEdit.company_id || '');
    }
  }, [clientToEdit]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      const customerData = {
        company_name: company || "",
        first_name: firstName,
        last_name: lastName,
        street: street || "Unbekannt",
        number: houseNumber || "1", 
        zip: postalCode || "00000", 
        city: city || "Unbekannt",
        phone: phone || "Keine Angabe", 
        email: email,
        company_id: customer_id || "",
        updated_at: new Date()
      };

      if (clientToEdit) {
        // UPDATE: Aktualisiert den bestehenden Datensatz in SQLite
        await db.update(users)
                .set(customerData)
                .where(eq(users.id, clientToEdit.id));
      } else {
        // INSERT: Legt einen neuen Kunden an
        await db.insert(users).values(customerData);
      }

      setCompany(''); setFirstName(''); setLastName(''); setEmail(''); setStreet(''); setCity(''); setHouseNumber(''); setPostalCode(''); setPhone(''); setCustomerId('');
      onClientAdded();
      onCancel(); 
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      await message("Kunde konnte nicht gespeichert werden.", { title: 'Fehler', kind: 'error' });
    }
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="md:col-span-2">
          <Field label="Firmenname (optional)">
            <Input 
              value={company} 
              onChange={(e) => setCompany(e.target.value)} 
              placeholder="Firma" 
            />
          </Field>
        </div>
        
        <div className="md:col-span-2">
          <Field label="Kundennummer (optional)">
            <Input 
              value={customer_id} 
              onChange={(e) => setCustomerId(e.target.value)} 
              placeholder="Kundennummer" 
            />
          </Field>
        </div>

        <Field label="Vorname">
          <Input 
            value={firstName} 
            onChange={(e) => setFirstName(e.target.value)} 
            placeholder="Vorname"  
          />
        </Field>

        <Field label="Nachname">
          <Input 
            value={lastName} 
            onChange={(e) => setLastName(e.target.value)} 
            placeholder="Nachname" 
          />
        </Field>

        <Field label="E-Mail Adresse" required>
          <Input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="mail@beispiel.de" 
            required
          />
        </Field>
        
        <Field label="Telefonnummer">
          <Input
            type="tel" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            placeholder="Telefonnummer" 
          />
        </Field>

        <Field label="Straße" required>
          <Input 
            value={street} 
            onChange={(e) => setStreet(e.target.value)} 
            placeholder="Straße" 
            required
          />
        </Field>
        
        <Field label="Hausnummer" required>
          <Input 
            value={houseNumber} 
            onChange={(e) => setHouseNumber(e.target.value)} 
            placeholder="Hausnummer" 
            required
          />
        </Field>

        <Field label="PLZ" required>
          <Input 
            value={postalCode} 
            onChange={(e) => setPostalCode(e.target.value)} 
            placeholder="01705" 
            required
          />
        </Field>

        <Field label="Ort" required>
          <Input 
            value={city} 
            onChange={(e) => setCity(e.target.value)} 
            placeholder="Ort" 
            required
          />
        </Field>

      </div>

      <div className="flex justify-between mt-2">
        <Button 
          type="button" 
          appearance="secondary"
          icon={<Dismiss20Regular />}
          onClick={onCancel}
        >
          Abbrechen
        </Button>
        <Button type="submit" appearance="primary" icon={<Save20Regular />}>
          {clientToEdit ? 'Änderungen speichern' : 'Kunden anlegen'}
        </Button>
      </div>
      
    </form>
  );
}