/**
 * Return one note in priority order. Date-only deadlines expire after the local
 * date ends; completed tasks never trigger the overdue rule.
 * @param {{tasks: {id: number, title: string, postpone_count: number, deadline?: string | null, status?: string, subject_name?: string}[], scheduledMinutes: number,
 * history?: {completedToday: boolean, completedYesterday: boolean, bestHour: number | null}, bestHourLabel?: string, now?: number}} input
 * @returns {{rule: 'overdue' | 'procrastination' | 'burnout' | 'streak' | 'best-time', message: string} | null}
 */
export function selectCoachMessage({ tasks, scheduledMinutes, history, bestHourLabel, now = Date.now() }) {
  const date = new Date(now);
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const overdue = tasks.filter(task => task.status !== 'done' && task.status !== 'completed' && task.deadline &&
    (/^\d{4}-\d{2}-\d{2}$/.test(task.deadline) ? task.deadline < today : Date.parse(task.deadline) < now))
    .sort((a, b) => Date.parse(a.deadline ?? '') - Date.parse(b.deadline ?? '') || a.id - b.id)[0];
  if (overdue) return { rule: 'overdue', message: `You have an overdue task in ${overdue.subject_name || 'this subject'}. Let's reschedule it to avoid burnout.` };
  // Most-postponed first, with a stable ID tie-break. Never mutate task order.
  const postponed = tasks.reduce((selected, task) => task.postpone_count >= 2 &&
    (!selected || task.postpone_count > selected.postpone_count ||
      (task.postpone_count === selected.postpone_count && task.id < selected.id)) ? task : selected,
  /** @type {{id: number, title: string, postpone_count: number} | null} */ (null));
  if (postponed) return { rule: 'procrastination', message: `I noticed you've been postponing ${postponed.title}. Try a 5-minute micro-action to break the friction.` };
  if (scheduledMinutes > 240) return { rule: 'burnout', message: 'Heavy day ahead! Remember to take breaks.' };
  if (history?.completedToday && history.completedYesterday) {
    return { rule: 'streak', message: "You're on a 2-day streak! Keep the momentum going." };
  }
  if (history?.bestHour !== null && history?.bestHour !== undefined && bestHourLabel) {
    return { rule: 'best-time', message: `You've logged the most study time around ${bestHourLabel}. Consider planning your next session then.` };
  }
  return null;
}
