
export function Footer() {
  const Year = 2026;
  return (
    <footer className="p-6 bg-gray-800 text-white">
      <p>© {Year === new Date().getFullYear() ? Year : `${Year} - ${new Date().getFullYear()}`}  -  Billi, Der Rechnungsprofi</p>
    </footer>
  );
}