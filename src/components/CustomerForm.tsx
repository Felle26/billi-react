import { useState } from 'react';
import { Field, Input, Button } from '@fluentui/react-components';
import { Save20Regular, Dismiss20Regular } from '@fluentui/react-icons';

interface CustomerFormProps {
  onClientAdded: () => void;
  onCancel: () => void;
}

export function CustomerForm({ onClientAdded, onCancel }: CustomerFormProps) {
  // States für die Eingabefelder
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault(); // Verhindert, dass die Seite neu lädt
    
    // Hier kommt später dein Tauri/Rust-Code hin, um die Daten in der SQLite-Datenbank zu speichern!
    console.log("Neuer Kunde gespeichert:", { company, firstName, lastName, email, street, city, houseNumber, postalCode, phone, customer_id });
    
    // Felder nach dem Speichern leeren
    setCompany(''); setFirstName(''); setLastName(''); setEmail(''); setStreet(''); setCity(''); setHouseNumber(''); setPostalCode(''); setPhone(''); setCustomerId('');
    
    
    // Die Liste benachrichtigen, dass sie sich neu laden soll
    onClientAdded();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      
      {/* 2-Spalten-Grid für die Felder (auf Handys 1 Spalte, ab 'md' 2 Spalten) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Firma nimmt die volle Breite ein (col-span-2) */}
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

      {/* Speichern Button - rechtsbündig */}
      <div className="flex justify-between mt-2">
          <Button 
          type="button" 
          appearance="secondary"
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
          Kunden anlegen
        </Button>

      </div>
      
    </form>
  );
}