import { Textarea } from '../ui/input.jsx';
import { Button } from '../ui/button.jsx';
import { TrashIcon } from '../ui/icons.jsx';

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
        <div key={i} className="mb-1.5 flex items-start gap-2">
          <Textarea
            value={line}
            rows={2}
            className="min-h-[38px] resize-none [field-sizing:content]"
            placeholder="Ej. Edición de 6 videos para redes sociales. Puedes explicar el servicio en varias líneas."
            onChange={(e) => updateLine(i, e.target.value)}
          />
          <Button type="button" variant="danger" size="small" className="px-2" aria-label={`Eliminar línea ${i + 1}`} onClick={() => removeLine(i)}><TrashIcon /></Button>
        </div>
      ))}
      <Button type="button" size="small" onClick={addLine}>+ Agregar línea</Button>
    </div>
  );
}
