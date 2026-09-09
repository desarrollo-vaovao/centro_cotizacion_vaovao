import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const COLORS = ['#E8823C', '#4453c9', '#1f8a4c', '#c0392b', '#0f9aa8', '#a83e91', '#6f4bc9', '#d6549e'];

export function HorizontalBarChart({ data }) {
  const chartData = {
    labels: data.map(([name]) => name),
    datasets: [{ data: data.map(([, monto]) => monto), backgroundColor: data.map((_, i) => COLORS[i % COLORS.length]) }]
  };
  const options = { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } };
  return <Bar data={chartData} options={options} />;
}
