import { Button } from "@fluentui/react-components";
import { Command } from '@tauri-apps/plugin-shell';

async function testSidecar() {
  try {
    const command = Command.sidecar('bin/zugferd', [
      JSON.stringify({ invoiceId: "RE-HM-2026-001", total: 350.50 })
    ]);
    
    const output = await command.execute();
    
    // 1. Die rohen Daten ausgeben, bevor wir blind parsen
    console.log("Exit Code:", output.code);
    console.log("Roher Output (stdout):", output.stdout);
    console.log("Hintergrund-Fehler (stderr):", output.stderr);
    
    // 2. Nur parsen, wenn der Output nicht leer ist
    if (output.stdout.trim() !== "") {
      console.log("Geparste Antwort:", JSON.parse(output.stdout));
    } else {
      console.warn("Das Sidecar hat keinen JSON-Output geliefert. Schau in die stderr-Ausgabe oben.");
    }
  } catch (error) {
    console.error("Kritischer Fehler beim Starten des Sidecars:", error);
  }
}

export default function Invoice() {
  return (
    <Button
  appearance="subtle"
  size="small"
  aria-label="Von Route lösen"
  onPointerDown={(e) => {
    e.preventDefault();
    e.stopPropagation();
  }}
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    testSidecar();
  }}
  className="text-[10px] uppercase tracking-wide"
>
  Entfernen
</Button>
  );
}