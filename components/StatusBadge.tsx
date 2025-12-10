const colors: Record<string, string> = {
  Strong: 'bg-green-100 text-green-800',
  Good: 'bg-blue-100 text-blue-800',
  Average: 'bg-amber-100 text-amber-800',
  Rejected: 'bg-red-100 text-red-800',
};

export default function StatusBadge({ value }: { value: string }) {
  const color = colors[value] || 'bg-slate-100 text-ink';
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{value}</span>;
}

