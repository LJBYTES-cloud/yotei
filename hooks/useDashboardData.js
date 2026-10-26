import { useCallback, useEffect, useRef, useState } from 'react';
import { getSubjectsForUser } from '../db/SubjectService';
import { getTasksForUser } from '../db/TaskService';
import { getStudyBlocksForUser, markExpiredStudyBlocks } from '../db/StudyBlockService';
import { getDailyStudyMinutes } from '../db/StudyLoadService';
import { getReflectionsForUser } from '../db/ReflectionService';
import { getWeeklyStudyMinutes } from '../db/ProgressService';
import { getMaterialsForUser } from '../db/MaterialService';

/** @param {string} userId @param {string} date */
export function useDashboardData(userId, date) {
  const [subjects, setSubjects] = useState(/** @type {import('../db/SubjectService').Subject[]} */ ([]));
  const [tasks, setTasks] = useState(/** @type {import('../db/TaskService').Task[]} */ ([]));
  const [blocks, setBlocks] = useState(/** @type {import('../db/StudyBlockService').StudyBlock[]} */ ([]));
  const [minutes, setMinutes] = useState(0);
  const [reflections, setReflections] = useState(/** @type {import('../db/ReflectionService').ReflectionItem[]} */ ([]));
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
      const [nextSubjects, nextTasks, nextBlocks, nextMinutes, nextReflections, nextWeekly, nextMaterials] = await Promise.all([
        getSubjectsForUser(userId), getTasksForUser(userId),
        getStudyBlocksForUser(userId, { date, includeUnresolvedMissed: true }), getDailyStudyMinutes(userId, date), getReflectionsForUser(userId), getWeeklyStudyMinutes(userId, date),
        getMaterialsForUser(userId),
      ]);
      if (!mounted.current || id !== requestId.current) return;
      setSubjects(nextSubjects); setTasks(nextTasks); setBlocks(nextBlocks); setMinutes(nextMinutes); setReflections(nextReflections); setWeekly(nextWeekly);
      setMaterials(nextMaterials);
      setReady(true); setError('');
    } catch {
      if (mounted.current && id === requestId.current) setError('Could not refresh study data. Try again.');
    } finally {
      if (mounted.current && id === requestId.current) setRefreshing(false);
    }
  }, [userId, date]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { subjects, tasks, blocks, minutes, reflections, weekly, materials, ready, refreshing, error, refresh };
}
