import { useCallback, useEffect, useRef, useState } from 'react';
import { getSubjectsForUser } from '../db/SubjectService';
import { getTasksForUser } from '../db/TaskService';
import { getStudyBlocksForUser, markExpiredStudyBlocks } from '../db/StudyBlockService';
import { getDailyStudyMinutes } from '../db/StudyLoadService';
import { getDueReviews } from '../db/ReviewService';
import { getWeeklyStudyMinutes } from '../db/ProgressService';

/** @param {string} userId @param {string} date */
export function useDashboardData(userId, date) {
  const [subjects, setSubjects] = useState(/** @type {import('../db/SubjectService').Subject[]} */ ([]));
  const [tasks, setTasks] = useState(/** @type {import('../db/TaskService').Task[]} */ ([]));
  const [blocks, setBlocks] = useState(/** @type {import('../db/StudyBlockService').StudyBlock[]} */ ([]));
  const [minutes, setMinutes] = useState(0);
  const [reviews, setReviews] = useState(/** @type {import('../db/ReviewService').ReviewItem[]} */ ([]));
  const [weekly, setWeekly] = useState(/** @type {import('../db/ProgressService').StudyProgressDay[]} */ ([]));
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
      const [nextSubjects, nextTasks, nextBlocks, nextMinutes, nextReviews, nextWeekly] = await Promise.all([
        getSubjectsForUser(userId), getTasksForUser(userId),
        getStudyBlocksForUser(userId, { date, includeUnresolvedMissed: true }), getDailyStudyMinutes(userId, date), getDueReviews(userId), getWeeklyStudyMinutes(userId, date),
      ]);
      if (!mounted.current || id !== requestId.current) return;
      setSubjects(nextSubjects); setTasks(nextTasks); setBlocks(nextBlocks); setMinutes(nextMinutes); setReviews(nextReviews); setWeekly(nextWeekly);
      setReady(true); setError('');
    } catch {
      if (mounted.current && id === requestId.current) setError('Could not refresh study data. Try again.');
    } finally {
      if (mounted.current && id === requestId.current) setRefreshing(false);
    }
  }, [userId, date]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { subjects, tasks, blocks, minutes, reviews, weekly, ready, refreshing, error, refresh };
}
