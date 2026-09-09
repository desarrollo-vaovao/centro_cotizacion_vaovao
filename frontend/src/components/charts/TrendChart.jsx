import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export function TrendChart({ data }) {
  const chartData = {
    labels: data.map((d) => d.month),
    datasets: [
      { label: 'Aprobado', data: data.map((d) => d.aprobado), backgroundColor: '#1f8a4c' },
      { label: 'En proceso', data: data.map((d) => d.enProceso), backgroundColor: '#3d55c9' },
      { label: 'Denegado', data: data.map((d) => d.denegado), backgroundColor: '#c0392b' }
    ]
  };
  const options = {
    responsive: true,
    scales: { x: { stacked: true }, y: { stacked: true } },
    plugins: { legend: { position: 'bottom' } }
  };
  return <Bar data={chartData} options={options} />;
}
