'use client'

interface TaskStat {
  num: number
  total: number
  correct: number
}

export default function TaskHeatmap({ stats }: { stats: TaskStat[] }) {
  return (
    <div>
      <div className="grid grid-cols-5 sm:grid-cols-[repeat(13,1fr)] gap-1.5">
        {stats.map(({ num, total, correct }) => {
          const pct = total > 0 ? correct / total : -1
          const bg =
            pct < 0
              ? 'bg-gray-100 text-gray-400'
              : pct < 0.5
              ? 'bg-red-400 text-white'
              : pct < 0.8
              ? 'bg-yellow-400 text-white'
              : 'bg-green-500 text-white'
          const label = pct < 0 ? '—' : `${Math.round(pct * 100)}%`
          return (
            <div
              key={num}
              className={`${bg} rounded-lg flex flex-col items-center justify-center aspect-square text-center`}
              title={`Задание №${num}: ${correct}/${total}`}
            >
              <span className="text-[10px] font-bold leading-none">{num}</span>
              <span className="text-[9px] leading-none mt-0.5 opacity-80">{label}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" />Не решалось</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" />&lt;50%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" />50–79%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" />≥80%</span>
      </div>
    </div>
  )
}

// Build heatmap data from attempts + task map
export function buildHeatmapData(
  attempts: { task_id: string; is_correct: boolean }[],
  taskNumMap: Record<string, number>
): TaskStat[] {
  const acc: Record<number, { total: number; correct: number }> = {}
  for (let i = 1; i <= 25; i++) acc[i] = { total: 0, correct: 0 }

  attempts.forEach((a) => {
    const num = taskNumMap[a.task_id]
    if (num && acc[num]) {
      acc[num].total++
      if (a.is_correct) acc[num].correct++
    }
  })

  return Object.entries(acc).map(([num, s]) => ({ num: +num, ...s }))
}
