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

// The PDF is a single raster of the rendered document. A full-page PNG at 2x
// weighed ~4MB; JPEG at these qualities is a fraction of that with no visible
// loss on this layout, and the ladder steps down only if a document (e.g.
// with a heavy logo) still lands above the cap.
const MAX_PDF_BYTES = 1_000_000;
const JPEG_QUALITIES = [0.85, 0.7, 0.55];

const PAGE_MARGIN = 30;
// Rows shorter than this fraction of a page are never used as a break point,
// so a page can't end up nearly empty just because a row boundary was close.
const MIN_PAGE_FILL = 0.5;

// Picks where each page ends (in canvas px). Breaks land on the top of a
// [data-pdf-break] element whenever one fits, so lines of the detalle aren't
// sliced through the middle; otherwise the page is cut at its full height.
function pageBreaks(totalHeight, pageHeight, candidates) {
  const breaks = [];
  let start = 0;
  while (totalHeight - start > pageHeight) {
    const limit = start + pageHeight;
    const fit = candidates.filter((c) => c > start + pageHeight * MIN_PAGE_FILL && c <= limit);
    const end = fit.length ? Math.max(...fit) : limit;
    breaks.push(end);
    start = end;
  }
  return breaks;
}

function buildPdf(canvas, quality, breakCandidates = []) {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
  const w = pdf.internal.pageSize.getWidth() - PAGE_MARGIN * 2;
  const pxPerPt = canvas.width / w;
  const pageHeightPt = (pdf.internal.pageSize.getHeight?.() ?? 792) - PAGE_MARGIN * 2;
  const breaks = pageBreaks(canvas.height, pageHeightPt * pxPerPt, breakCandidates);

  if (!breaks.length) {
    const h = w * (canvas.height / canvas.width);
    pdf.addImage(canvas.toDataURL('image/jpeg', quality), 'JPEG', PAGE_MARGIN, PAGE_MARGIN, w, h, undefined, 'FAST');
    return pdf;
  }

  const edges = [0, ...breaks, canvas.height];
  for (let i = 0; i < edges.length - 1; i++) {
    const sliceHeight = Math.round(edges[i + 1] - edges[i]);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, Math.round(edges[i]), canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    if (i > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', quality), 'JPEG', PAGE_MARGIN, PAGE_MARGIN, w, sliceHeight / pxPerPt, undefined, 'FAST');
  }
  return pdf;
}

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
      const root = docRef.current;
      const canvas = await html2canvas(root, { scale: 2, backgroundColor: '#ffffff' });
      const scale = canvas.width / root.offsetWidth;
      const rootTop = root.getBoundingClientRect().top;
      const breakCandidates = [...root.querySelectorAll('[data-pdf-break]')]
        .map((el) => (el.getBoundingClientRect().top - rootTop) * scale);
      let pdf;
      for (const quality of JPEG_QUALITIES) {
        pdf = buildPdf(canvas, quality, breakCandidates);
        if (pdf.output('blob').size <= MAX_PDF_BYTES) break;
      }
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
        className="relative mx-auto flex min-h-[725px] max-w-[560px] flex-col rounded-2xl border border-border bg-paper p-8 shadow-sm"
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
            <div className="flex-1 border-r border-border p-2.5 text-[11.5px] leading-relaxed">
              {quotation.detalle.map((d, i) => (
                <div key={i} data-pdf-break className="mb-1.5 flex gap-1.5 whitespace-pre-line break-words">
                  <span>•</span><span className="min-w-0 flex-1">{d}</span>
                </div>
              ))}
            </div>
            <div className="flex w-[110px] items-end justify-end p-2.5 text-xs font-medium">{fmtMoney(quotation.monto, quotation.moneda)}</div>
          </div>
        </div>
        <div data-pdf-break className="mt-3 flex justify-end">
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
