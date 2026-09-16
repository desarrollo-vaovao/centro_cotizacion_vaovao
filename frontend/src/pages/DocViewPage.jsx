import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useQuotation } from '../api/quotations.js';
import { useClients } from '../api/clients.js';
import { useLogos } from '../api/settings.js';
import { Button } from '../components/ui/button.jsx';
import { fmtMoney, fmtDate } from '../lib/utils.js';

const AGENCY_INFO = { phone: '2509 2809', web: 'vaovao.co', email: 'info@vaovao.co', address: 'Edificio Narama, 15 Avenida 16-14, Zona 13, Ciudad de Guatemala, Oficina 329' };

// html2canvas doesn't support `object-fit: contain` (stretches the image to
// fill its box in the exported canvas even though it renders correctly on
// screen), so we compute contained dimensions ourselves and size the <img>
// with explicit width/height instead of relying on object-fit.
function useContainedSize(src, maxW, maxH) {
  const [size, setSize] = useState(null);

  useEffect(() => {
    if (!src) {
      setSize(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      setSize({ width: img.naturalWidth * ratio, height: img.naturalHeight * ratio });
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src, maxW, maxH]);

  return size;
}

export function DocViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: quotation } = useQuotation(id);
  const { data: clients = [] } = useClients();
  const { data: logos } = useLogos();
  const docRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const agenciaSize = useContainedSize(logos?.logoAgencia, 130, 50);
  const velarcSize = useContainedSize(logos?.logoVelarc, 100, 30);

  if (!quotation) return null;

  const client = clients.find((c) => c.id === quotation.clientId);
  const clientLabel = client ? client.name : (quotation.clienteNombreLibre || '—');
  const validezFecha = new Date(new Date(quotation.fecha + 'T00:00:00').getTime() + quotation.validezDias * 86400000).toISOString().slice(0, 10);

  async function onDownloadPdf() {
    setGenerating(true);
    try {
      const canvas = await html2canvas(docRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageW = pdf.internal.pageSize.getWidth();
      const ratio = canvas.height / canvas.width;
      const w = pageW - 60;
      pdf.addImage(img, 'PNG', 30, 30, w, w * ratio);
      pdf.save(`${quotation.correlativoGeneral.replace(/\s+/g, '_')}.pdf`);
    } catch {
      window.print();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex gap-2 print:hidden">
        <Button onClick={() => navigate(-1)}>← Volver</Button>
        <Button variant="primary" onClick={onDownloadPdf} disabled={generating}>
          {generating ? 'Generando…' : 'Descargar PDF'}
        </Button>
      </div>
      <div
        ref={docRef}
        className="relative mx-auto flex max-w-[560px] flex-col rounded-2xl border border-border bg-paper p-8 shadow-sm"
        style={{ aspectRatio: '8.5 / 11' }}
      >
        <div className="absolute inset-x-0 top-0 h-[5px] bg-accent" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {logos?.logoAgencia
              ? (
                <div className="flex h-[50px] w-[130px] items-center justify-start">
                  <img
                    src={logos.logoAgencia}
                    alt="Logo agencia"
                    style={agenciaSize ? { width: agenciaSize.width, height: agenciaSize.height } : { maxWidth: 130, maxHeight: 50 }}
                  />
                </div>
              )
              : <div className="flex h-[50px] w-[130px] items-center justify-center rounded-lg border border-dashed border-border-strong text-[10.5px] text-text-secondary">Logo agencia</div>}
            <div className="mt-2 text-[9.5px] leading-relaxed text-text-secondary">
              Tel. {AGENCY_INFO.phone}<br />{AGENCY_INFO.web} · {AGENCY_INFO.email}<br />{AGENCY_INFO.address}
            </div>
          </div>
          <table className="w-[230px] rounded-lg border border-border text-[11px]">
            <tbody>
              <tr className="border-b border-border"><td className="bg-[#faf8f4] p-1.5 text-text-secondary">Fecha</td><td className="p-1.5 text-right">{fmtDate(quotation.fecha)}</td></tr>
              <tr className="border-b border-border"><td className="bg-[#faf8f4] p-1.5 text-text-secondary">Validez</td><td className="p-1.5 text-right">{fmtDate(validezFecha)}</td></tr>
              <tr className="border-b border-border"><td className="bg-[#faf8f4] p-1.5 text-text-secondary">Propuesta #</td><td className="p-1.5 text-right font-semibold text-accent-ink">{quotation.correlativoGeneral}</td></tr>
              <tr><td className="bg-[#faf8f4] p-1.5 text-text-secondary">Ref. cliente</td><td className="p-1.5 text-right text-[#a9a49a]">{quotation.correlativoCliente || '—'}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mb-4 grid grid-cols-[1fr_1.6fr] overflow-hidden rounded-lg border border-border">
          <div><div className="bg-ink px-2.5 py-1.5 text-[10.5px] font-medium text-white">Cliente</div><div className="p-2.5 text-xs font-semibold">{clientLabel}</div></div>
          <div className="border-l border-border"><div className="bg-ink px-2.5 py-1.5 text-[10.5px] font-medium text-white">Descripción de proyecto</div><div className="p-2.5 text-[11.5px] leading-relaxed">{quotation.descripcion || quotation.proyecto}</div></div>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border">
          <div className="flex bg-ink text-[10.5px] font-medium text-white"><div className="flex-1 px-2.5 py-1.5">Detalle</div><div className="w-[110px] border-l border-white/25 px-2.5 py-1.5">Costo</div></div>
          <div className="flex flex-1">
            <div className="flex-1 border-r border-border p-2.5 text-[11.5px] leading-loose">
              {quotation.detalle.map((d, i) => <div key={i}>• {d}</div>)}
            </div>
            <div className="flex w-[110px] items-end justify-end p-2.5 text-xs font-medium">{fmtMoney(quotation.monto, quotation.moneda)}</div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <div className="flex overflow-hidden rounded-lg border border-border">
            <div className="bg-[#faf8f4] px-3.5 py-1.5 text-[11.5px] font-medium">Total más impuestos</div>
            <div className="bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink">{fmtMoney(quotation.monto + quotation.impuestos, quotation.moneda)}</div>
          </div>
        </div>
        <div className="mt-6 text-center">
          {logos?.logoVelarc
            ? (
              <div className="mx-auto mb-1.5 flex h-[30px] w-[100px] items-center justify-center">
                <img
                  src={logos.logoVelarc}
                  alt="Logo VELARC"
                  style={velarcSize ? { width: velarcSize.width, height: velarcSize.height } : { maxWidth: 100, maxHeight: 30 }}
                />
              </div>
            )
            : <div className="mx-auto mb-1.5 flex h-[30px] w-[100px] items-center justify-center rounded-lg border border-dashed border-border-strong text-[10.5px] text-text-secondary">Logo VELARC</div>}
          <div className="text-[9.5px] text-[#a9a49a]">Guatemala, Ciudad · 502 2509 2809 · info@grupovelarc.com</div>
        </div>
      </div>
    </div>
  );
}
