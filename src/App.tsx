import { Routes, Route } from 'react-router-dom';
import Customers from './pages/customers';
import CustomerObjects from './pages/customer_objects';
import Invoice from './pages/invoice';
import Dashboard from './pages/dashboard';
import Settings from './pages/settings';

export default function App() {
  return (
    <Routes>
      <Route path="/customers" element={<Customers />} />
      <Route path="/customer_objects" element={<CustomerObjects />} />
      <Route path="/invoice" element={<Invoice />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/settings" element={<Settings />} />

      <Route path="/" element={<Dashboard />} />
    </Routes>
  );
}