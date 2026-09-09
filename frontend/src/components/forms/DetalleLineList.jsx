import { Input } from '../ui/input.jsx';
import { Button } from '../ui/button.jsx';

export function DetalleLineList({ value, onChange }) {
  function updateLine(i, text) {
    const next = value.slice();
    next[i] = text;
    onChange(next);
  }
  function removeLine(i) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function addLine() {
    onChange([...value, '']);
  }

  return (
    <div>
      {value.map((line, i) => (
        <div key={i} className="mb-1.5 flex gap-2">
          <Input
            value={line}
            placeholder="Ej. Edición de 6 videos para redes sociales"
            onChange={(e) => updateLine(i, e.target.value)}
          />
          <Button type="button" variant="danger" size="small" onClick={() => removeLine(i)}>×</Button>
        </div>
      ))}
      <Button type="button" size="small" onClick={addLine}>+ Agregar línea</Button>
    </div>
  );
}
