import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ['#E8823C', '#4453c9', '#1f8a4c', '#c0392b', '#0f9aa8', '#a83e91', '#6f4bc9', '#d6549e'];

export function DoughnutChart({ data }) {
  const chartData = {
    labels: data.map(([name]) => name),
    datasets: [{ data: data.map(([, monto]) => monto), backgroundColor: data.map((_, i) => COLORS[i % COLORS.length]) }]
  };
  return <Doughnut data={chartData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />;
}
