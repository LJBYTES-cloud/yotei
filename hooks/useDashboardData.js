import { useCallback, useEffect, useRef, useState } from 'react';
import { getSubjectsForUser } from '../db/SubjectService';
import { getTasksForUser } from '../db/TaskService';
import { getStudyBlocksForUser, markExpiredStudyBlocks } from '../db/StudyBlockService';
import { getCoachHistory } from '../db/CoachService';
import { getDailyStudyMinutes } from '../db/StudyLoadService';
import { getJournalFeedForUser } from '../db/JournalService';
import { getWeeklyStudyMinutes } from '../db/ProgressService';
import { getMaterialsForUser } from '../db/MaterialService';

/** @param {string} userId @param {string} date */
export function useDashboardData(userId, date) {
  const [subjects, setSubjects] = useState(/** @type {import('../db/SubjectService').Subject[]} */ ([]));
  const [tasks, setTasks] = useState(/** @type {import('../db/TaskService').Task[]} */ ([]));
  const [blocks, setBlocks] = useState(/** @type {import('../db/StudyBlockService').StudyBlock[]} */ ([]));
  const [minutes, setMinutes] = useState(0);
  const [coach, setCoach] = useState(/** @type {import('../db/CoachService').CoachHistory} */ ({ completedToday: false, completedYesterday: false, bestHour: null }));
  const [journal, setJournal] = useState(/** @type {import('../db/JournalService').JournalFeedItem[]} */ ([]));
  const [weekly, setWeekly] = useState(/** @type {import('../db/ProgressService').StudyProgressDay[]} */ ([]));
  const [materials, setMaterials] = useState(/** @type {import('../db/MaterialService').Material[]} */ ([]));
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestId.current += 1; }; }, []);

  const refresh = useCallback(async (background = false) => {
    const id = ++requestId.current;
    if (!background) setRefreshing(true);
    try {
      await markExpiredStudyBlocks(userId);
      const [nextSubjects, nextTasks, nextBlocks, nextMinutes, nextJournal, nextWeekly, nextMaterials, nextCoach] = await Promise.all([
        getSubjectsForUser(userId), getTasksForUser(userId),
        getStudyBlocksForUser(userId, { date, includeUnresolvedMissed: true }), getDailyStudyMinutes(userId, date), getJournalFeedForUser(userId), getWeeklyStudyMinutes(userId, date),
        getMaterialsForUser(userId),
        getCoachHistory(userId, date),
      ]);
      if (!mounted.current || id !== requestId.current) return;
      setSubjects(nextSubjects); setTasks(nextTasks); setBlocks(nextBlocks); setMinutes(nextMinutes); setJournal(nextJournal); setWeekly(nextWeekly);
      setMaterials(nextMaterials);
      setCoach(nextCoach);
      setReady(true); setError('');
    } catch {
      if (mounted.current && id === requestId.current) setError('Could not refresh study data. Try again.');
    } finally {
      if (mounted.current && id === requestId.current) setRefreshing(false);
    }
  }, [userId, date]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { subjects, tasks, blocks, minutes, coach, journal, weekly, materials, ready, refreshing, error, refresh };
}
