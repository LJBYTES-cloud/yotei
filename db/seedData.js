import { getDatabase, requireUserId } from './database';
import { getLocalDateKey, getLocalDayRange } from './dateUtils';

// Combine distinct experiences, concrete assignments and next steps rather
// than repeating a generic journal sentence throughout the term.
const observations = [
  'Felt distracted by my phone; leaving it in another room helped me settle.',
  'Great flow state today. The first example was enough to get me moving.',
  'Struggled with the math concepts and slowed down to check each assumption.',
  'Reading aloud made the difficult passage easier to follow.',
  'I confused two definitions until I wrote a concrete counterexample.',
  'The diagram exposed a missing step that I had skipped in my notes.',
  'I spent too long polishing the opening instead of finishing a rough draft.',
  'Closing extra browser tabs made the second half much more focused.',
  'I could explain the main idea from memory, but the details still need work.',
  'A short walk cleared my head before the last exercise.',
  'Working through a simpler case helped me understand the harder question.',
  'I noticed that my examples did not actually support the conclusion.',
  'The session felt slow, but I corrected several mistakes from last week.',
  'I underestimated the reading and stopped at a useful checkpoint.',
  'Testing my answer without looking at the notes showed what I had missed.',
  'A noisy room interrupted my attention; headphones helped after the break.',
  'I found a connection to another class that made the material stick.',
  'The worked solution made sense only after I tried the problem myself.',
  'I was tired today, so I focused on one small section and finished it.',
  'My questions are more specific now, which will make the next tutorial useful.',
  'I caught a recurring error by comparing my first and final attempts.',
  'Starting with an outline kept me from rewriting the same paragraph.',
  'A classmate challenged my explanation and helped me find a weak spot.',
];
const nextActions = [
  'Next time, start with one question before opening the textbook.',
  'Bring the unresolved example to the next tutorial.',
  'Try a five-minute recall exercise before rereading.',
  'Keep the phone out of reach for the first twenty minutes.',
  'Write a checklist for the steps I keep forgetting.',
  'Leave more time for checking the final answer.',
  'Split the remaining work into two smaller sessions.',
  'Compare my explanation with the original source tomorrow.',
  'Begin with the hardest paragraph while my attention is fresh.',
  'Test the method with a new example.',
  'Stop at the planned time and leave a clear note about the next step.',
  'Prepare the materials before the session to avoid setup delays.',
  'Review mistakes first instead of repeating the easy questions.',
  'Take a proper break before moving to a different subject.',
  'Make a diagram rather than adding another page of notes.',
  'Save the final ten minutes for independent practice.',
  'Ask for feedback on the reasoning rather than only the answer.',
  'Check the rubric before revising the next draft.',
  'Use the library desk to avoid interruptions.',
];
const journalHeadings = ['Study Check-In', 'A Difficult Question', 'What Helped Today', 'Revision Plan', 'Notes After Class', 'Focus and Distractions', 'Questions for Tutorial', 'End-of-Day Notes', 'A Method to Try', 'Progress on the Draft', 'Planning the Next Session'];

/**
 * Replace one user's local study data with six calendar months and today.
 * Authentication and other users' records are never reset.
 * @param {string} userId
 */
export async function seedDemoData(userId) {
  requireUserId(userId);
  const now = new Date();
  const today = getLocalDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrowKey = getLocalDateKey(tomorrow);
  const yesterdayKey = getLocalDateKey(yesterday);
  const { start, end } = getLocalDayRange(today);
  const minute = 60_000;
  // Four hours of study plus three ten-minute breaks, all inside today.
  // Position the window around now so it works even near midnight.
  const anchor = Math.max(Date.parse(start), Math.min(
    Math.floor(now.getTime() / minute) * minute - 90 * minute,
    Date.parse(end) - 270 * minute,
  ));
  // Subtract calendar months with day clamping (May 31 -> November 30),
  // then walk local dates rather than adding fixed 24-hour periods across DST.
  const historyStart = new Date(now); historyStart.setHours(12, 0, 0, 0); historyStart.setDate(1);
  historyStart.setMonth(historyStart.getMonth() - 6);
  const lastDay = new Date(historyStart.getFullYear(), historyStart.getMonth() + 1, 0).getDate();
  historyStart.setDate(Math.min(now.getDate(), lastDay));
  const recentStart = new Date(now); recentStart.setHours(12, 0, 0, 0); recentStart.setDate(recentStart.getDate() - 6);
  const recentKey = getLocalDateKey(recentStart);
  const counts = { subjects: 20, tasks: 40, studyBlocks: 0, reflectionItems: 0, journalEntries: 0, materials: 40, historyDays: 0, totalMinutes: 240 };
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async transaction => {
    await transaction.runAsync('DELETE FROM JournalEntry WHERE user_id = ?', userId);
    await transaction.runAsync('DELETE FROM Material WHERE subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM ReflectionItem WHERE subject_id IN (SELECT id FROM Subject WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM StudyBlock WHERE task_id IN (SELECT id FROM Task WHERE user_id = ?)', userId);
    await transaction.runAsync('DELETE FROM Task WHERE user_id = ?', userId);
    await transaction.runAsync('DELETE FROM Subject WHERE user_id = ?', userId);

    const subjects = [
      { name: 'Mathematics', subject_code: 'MATH-2', field_of_study: 'Mathematics', field_colors: '#C2ACF3' },
      { name: 'Biology', subject_code: 'BIO-101', field_of_study: 'Natural Sciences', field_colors: '#2DD4BF,#60A5FA' },
      { name: 'History', subject_code: 'HIST-101', field_of_study: 'Humanities', field_colors: '#FBBF24,#FB7185' },
      ...[
        ['Calculus', 'MATH-201', 'Mathematics', '#C2ACF3,#60A5FA'],
        ['Statistics', 'STAT-102', 'Mathematics', '#C2ACF3,#60A5FA'],
        ['Discrete Mathematics', 'MATH-210', 'Mathematics', '#C2ACF3,#60A5FA'],
        ['Chemistry', 'CHEM-101', 'Natural Sciences', '#2DD4BF,#60A5FA'],
        ['Physics', 'PHYS-101', 'Natural Sciences', '#2DD4BF,#60A5FA'],
        ['Environmental Science', 'ENV-120', 'Natural Sciences', '#2DD4BF,#60A5FA'],
        ['Philosophy', 'PHIL-101', 'Humanities', '#FBBF24,#FB7185'],
        ['Psychology', 'PSYC-101', 'Humanities', '#FBBF24,#FB7185'],
        ['Sociology', 'SOC-110', 'Humanities', '#FBBF24,#FB7185'],
        ['Programming Fundamentals', 'CS-101', 'Computer Science', '#818CF8,#38BDF8'],
        ['Data Structures', 'CS-202', 'Computer Science', '#818CF8,#38BDF8'],
        ['Database Systems', 'CS-230', 'Computer Science', '#818CF8,#38BDF8'],
        ['Computer Networks', 'CS-240', 'Computer Science', '#818CF8,#38BDF8'],
        ['World Literature', 'LIT-101', 'Literature', '#F472B6,#FB923C'],
        ['Poetry and Poetics', 'LIT-205', 'Literature', '#F472B6,#FB923C'],
        ['Academic Writing', 'WRIT-101', 'Literature', '#F472B6,#FB923C'],
        ['Comparative Literature', 'LIT-220', 'Literature', '#F472B6,#FB923C'],
      ].map(([name, subject_code, field_of_study, field_colors]) => ({ name, subject_code, field_of_study, field_colors })),
    ];
    /** @type {number[]} */
    const subjectIds = [];
    for (const subject of subjects) {
      const result = await transaction.runAsync(
        'INSERT INTO Subject (user_id, name, subject_code, field_of_study, field_colors) VALUES (?, ?, ?, ?, ?)', userId, subject.name, subject.subject_code, subject.field_of_study, subject.field_colors,
      );
      subjectIds.push(result.lastInsertRowId);
    }
    const reflectionNotes = [
      'Completing the square is clearer now. I need more practice checking the final roots.',
      'I can explain the mitosis stages without notes. Next time, draw each stage from memory.',
      'The timeline helped connect the economic and political causes. Revisit the Estates-General.',
    ];
    const referenceUrls = /** @type {Record<string, string>} */ ({ Mathematics: 'https://openstax.org/subjects/math', 'Natural Sciences': 'https://openstax.org/subjects/science', Humanities: 'https://www.britannica.com/', 'Computer Science': 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', Literature: 'https://www.gutenberg.org/' });
    for (let subject = 0; subject < subjectIds.length; subject += 1) for (let unit = 1; unit <= 2; unit += 1) {
      await transaction.runAsync('INSERT INTO Material (subject_id, title, url_or_note) VALUES (?, ?, ?)', subjectIds[subject],
        `${subjects[subject].name} - Unit ${unit} Reference`, referenceUrls[subjects[subject].field_of_study]);
    }
    const tasks = [
      { subject: 0, title: 'Practice quadratic equations for the quiz', deadline: tomorrowKey, minutes: 45, postponed: 0 },
      { subject: 1, title: 'Label the cell cycle diagram', deadline: tomorrowKey, minutes: 40, postponed: 0 },
      { subject: 2, title: 'Build a timeline of the French Revolution', deadline: today, minutes: 50, postponed: 0 },
      { subject: 0, title: 'Finish the algebra problem set', deadline: yesterdayKey, minutes: 60, postponed: 0 },
      { subject: 1, title: 'Explain photosynthesis in five sentences', deadline: today, minutes: 30, postponed: 2 },
      { subject: 2, title: 'Draft the first paragraph of the Industrial Revolution essay', deadline: tomorrowKey, minutes: 25, postponed: 2 },
    ];
    /** @type {number[]} */
    const taskIds = [];
    for (const task of tasks) {
      const result = await transaction.runAsync(`
        INSERT INTO Task (user_id, subject_id, title, description, deadline, estimated_minutes, status, postpone_count)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `, userId, subjectIds[task.subject], task.title, ['Work through the examples and check each result.', 'Label each stage, then explain the process without notes.', 'Use the source timeline and write a short explanation.'][task.subject], task.deadline, task.minutes, task.postponed);
      taskIds.push(result.lastInsertRowId);
    }
    const sessionTasks = [taskIds[0], taskIds[1], taskIds[2], taskIds[5]];
    for (let index = 0; index < sessionTasks.length; index += 1) {
      const begins = anchor + index * 70 * minute, ends = begins + 60 * minute;
      const status = index === 0 || ends <= now.getTime() ? 'done' : 'scheduled';
      // A real elapsed completion keeps today's graph populated even early in
      // the day. At exactly midnight it truthfully contains zero work minutes.
      const actualEnd = index === 0 ? Math.min(ends, now.getTime()) : null;
      const breakMs = actualEnd !== null && actualEnd - begins >= 20 * minute ? 5 * minute : 0;
      const block = await transaction.runAsync(`INSERT INTO StudyBlock
        (task_id, start_time, end_time, status, actual_start_time, actual_end_time, break_time_ms, break_time_minutes, actual_study_seconds)
        SELECT id, ?, ?, ?, ?, ?, ?, ?, ? FROM Task WHERE id = ? AND user_id = ?`,
      new Date(begins).toISOString(), new Date(ends).toISOString(), status,
      index === 0 ? new Date(begins).toISOString() : null, actualEnd === null ? null : new Date(actualEnd).toISOString(),
      breakMs, breakMs / minute, actualEnd === null ? 0 : Math.floor((actualEnd - begins - breakMs) / 1000), sessionTasks[index], userId);
      counts.studyBlocks++;
      if (index === 0) {
        await transaction.runAsync('INSERT INTO ReflectionItem (subject_id, study_block_id, note, created_at) VALUES (?, ?, ?, ?)',
          subjectIds[0], block.lastInsertRowId, reflectionNotes[0], new Date(actualEnd ?? now.getTime()).toISOString());
        counts.reflectionItems++;
      }
    }
    const titles = [
      [tasks[0].title, tasks[3].title], [tasks[1].title, tasks[4].title], [tasks[2].title, tasks[5].title],
      ['Complete Problem Set 2: Derivatives', 'Model Population Growth With Integrals'],
      ['Compare Sampling Methods for the Survey', 'Calculate Confidence Intervals for Lab Results'],
      ['Prove the Graph Coloring Lemma', 'Build Truth Tables for Logic Exercises'],
      ['Balance Redox Equations in Worksheet 3', 'Write the Titration Lab Discussion'],
      ['Solve Projectile Motion Questions', 'Explain Energy Loss in the Pendulum Experiment'],
      ['Analyze the Campus Water Quality Data', 'Compare Renewable Energy Case Studies'],
      ['Map the Argument in Plato Chapter 4', 'Write an Objection to the Utilitarian Claim'],
      ['Summarize the Working Memory Experiment', 'Design a Survey About Study Habits'],
      ['Annotate the Social Mobility Reading', 'Draft the Community Interview Questions'],
      ['Implement the Grade Calculator', 'Debug the File Parsing Exercise'],
      ['Implement a Binary Search Tree', 'Compare Sorting Algorithm Benchmarks'],
      ['Normalize the Library Database Schema', 'Write SQL Joins for the Enrollment Report'],
      ['Trace a Packet Through the TCP Handshake', 'Explain Subnetting in the Network Design'],
      ['Read Chapter 4 of Things Fall Apart', 'Compare Narrative Voices in Two Short Stories'],
      ['Annotate the Imagery in the Poetry Selection', 'Analyze Meter in the Sonnet Portfolio'],
      ['Write Essay Draft on Digital Distraction', 'Revise the Literature Review Introduction'],
      ['Compare Two Translations of the Opening Scene', 'Prepare Notes on Memory in Modern Fiction'],
    ];
    /** @type {number[][]} */
    const historyTasks = [[taskIds[0], taskIds[3]], [taskIds[1], taskIds[4]], [taskIds[2], taskIds[5]], ...Array.from({ length: 17 }, () => [])];
    for (let subject = 3; subject < subjects.length; subject += 1) for (let unit = 0; unit < 2; unit += 1) {
      const due = new Date(historyStart); due.setDate(due.getDate() + 14 + (subject * 7 + unit * 43) % 145);
      const result = await transaction.runAsync(`INSERT INTO Task (user_id, subject_id, title, description, deadline, estimated_minutes, status)
        VALUES (?, ?, ?, ?, ?, 45, 'done')`, userId, subjectIds[subject], titles[subject][unit],
      `Work on ${titles[subject][unit].toLowerCase()}. Check the reference material, practise independently, and record unresolved questions.`, getLocalDateKey(due));
      historyTasks[subject].push(result.lastInsertRowId);
    }
    let index = 0;
    for (const day = new Date(historyStart); getLocalDateKey(day) < today; day.setDate(day.getDate() + 1), index += 1) {
      counts.historyDays++;
      const date = getLocalDateKey(day), recent = date >= recentKey;
      // Occasional rest days over the term; the latest six dates always have work.
      const restDay = !recent && index % 13 === 0;
      const sessions = restDay ? 0 : day.getDay() === 0 || day.getDay() === 6 ? 1 : index % 9 === 0 ? 3 : 2;
      for (let session = 0; session < sessions; session += 1) {
        const subject = (index * 3 + session * 7) % subjects.length, unit = Math.floor(index / 20) % 2;
        const planned = [30, 45, 60, 75, 90][(index + session) % 5];
        const adjustment = [-12, 0, 28, 8, -7, 35, 18][(index + session) % 7];
        const elapsed = planned + adjustment, breakMinutes = elapsed >= 40 ? 5 + (index % 3) * 5 : 0;
        const begins = new Date(day); begins.setHours(9 + session * 4, (index % 2) * 15, 0, 0);
        const ends = new Date(begins.getTime() + planned * minute);
        const actualStart = new Date(begins.getTime() + (index % 4) * 3 * minute);
        const actualEnd = new Date(actualStart.getTime() + elapsed * minute);
        const block = await transaction.runAsync(`INSERT INTO StudyBlock
          (task_id, start_time, end_time, status, actual_start_time, actual_end_time, break_time_minutes, break_time_ms, actual_study_seconds)
          VALUES (?, ?, ?, 'done', ?, ?, ?, ?, ?)`, historyTasks[subject][unit], begins.toISOString(), ends.toISOString(),
        actualStart.toISOString(), actualEnd.toISOString(), breakMinutes, breakMinutes * minute, (elapsed - breakMinutes) * 60);
        counts.studyBlocks++;
        if ((index + session) % 3 !== 1 || recent) {
          await transaction.runAsync('INSERT INTO ReflectionItem (subject_id, study_block_id, note, created_at) VALUES (?, ?, ?, ?)',
            subjectIds[subject], block.lastInsertRowId,
            `${observations[(index * 5 + session) % observations.length]} For "${titles[subject][unit]}" on ${date}, I studied ${elapsed - breakMinutes} minutes with ${breakMinutes} minutes of breaks (planned ${planned}). ${nextActions[(index * 7 + session * 3) % nextActions.length]}`,
            actualEnd.toISOString());
          counts.reflectionItems++;
        }
      }
      if (index % 2 === 0) {
        const written = new Date(day); written.setHours(20, 0, 0, 0);
        const subject = Math.floor(index / 2) % subjects.length, unit = Math.floor(index / 20) % 2;
        await transaction.runAsync('INSERT INTO JournalEntry (user_id, title, content, created_at) VALUES (?, ?, ?, ?)', userId,
          `${journalHeadings[(index / 2) % journalHeadings.length]}: ${subjects[subject].name} (${date})`,
          `${observations[(index + 11) % observations.length]} My priority on ${date} was "${titles[subject][unit]}". ${nextActions[(index * 3 + 5) % nextActions.length]} I will compare my next attempt with today's notes in ${subjects[subject].field_of_study.toLowerCase()}.`, written.toISOString());
        counts.journalEntries++;
      }
    }
    await transaction.runAsync('INSERT INTO JournalEntry (user_id, title, content, created_at) VALUES (?, ?, ?, ?)', userId,
      "Today's Study Plan", 'Finish the priority tasks, take short breaks, and review the questions from the last session.', now.toISOString());
    counts.journalEntries++;
  });
  return counts;
}
