import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export function TrendChart({ data }) {
  const chartData = {
    labels: data.map((d) => d.period),
    datasets: [
      { label: 'Aprobado', data: data.map((d) => d.aprobado), backgroundColor: '#1f8a4c' },
      { label: 'En proceso', data: data.map((d) => d.enProceso), backgroundColor: '#3d55c9' },
      { label: 'Denegado', data: data.map((d) => d.denegado), backgroundColor: '#c0392b' }
    ]
  };
  // Grouped (not stacked) bars — each estatus gets its own bar per period so
  // they can be compared side by side instead of eyeballing stacked segments.
  const options = {
    responsive: true,
    scales: { x: { stacked: false }, y: { stacked: false } },
    plugins: { legend: { position: 'bottom' } }
  };
  return <Bar data={chartData} options={options} />;
}
