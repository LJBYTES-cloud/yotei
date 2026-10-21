import { getDatabase, requireUserId } from './database';
import { firstFieldColor } from '../utils/subjectFields';

export const REVIEW_INTERVAL_DAYS = { Hard: 1, Good: 3, Easy: 7 };
/** @typedef {keyof typeof REVIEW_INTERVAL_DAYS} ReviewDifficulty */
/** @typedef {{id: number, subject_id: number, topic: string, last_reviewed_at: string | null, next_review_at: string | null, subject_name: string, subject_color: string}} ReviewItem */

const REVIEW_SELECT = `
  SELECT review.*, subject.name AS subject_name,
    substr(subject.field_colors, 1, instr(subject.field_colors || ',', ',') - 1) AS subject_color
  FROM ReviewItem AS review INNER JOIN Subject AS subject ON subject.id = review.subject_id
`;

/** @param {string} userId @param {number} reviewId @returns {Promise<ReviewItem>} */
async function getReview(userId, reviewId) {
  const database = await getDatabase();
  const review = /** @type {ReviewItem | null} */ (await database.getFirstAsync(
    `${REVIEW_SELECT} WHERE review.id = ? AND subject.user_id = ?`, reviewId, userId,
  ));
  if (!review) throw new Error('Select a review item belonging to your account.');
  return review;
}

/** @param {string} userId @param {{subject_id: number, topic: string}} input @returns {Promise<ReviewItem>} */
export async function createReviewItem(userId, { subject_id, topic }) {
  requireUserId(userId);
  if (!Number.isSafeInteger(subject_id) || subject_id < 1) throw new Error('Select a subject.');
  const trimmedTopic = typeof topic === 'string' ? topic.trim() : '';
  if (!trimmedTopic || trimmedTopic.length > 256) throw new Error('Enter a topic between 1 and 256 characters.');
  const database = await getDatabase();
  const subject = /** @type {import('./SubjectService').Subject | null} */ (await database.getFirstAsync(
    'SELECT id, user_id, name, field_of_study, field_colors FROM Subject WHERE id = ? AND user_id = ?', subject_id, userId,
  ));
  if (!subject) throw new Error('Select a subject belonging to your account.');
  // Bind ownership to the insert itself so another account's subject cannot be used.
  const result = await database.runAsync(`
    INSERT INTO ReviewItem (subject_id, topic, last_reviewed_at, next_review_at)
    SELECT id, ?, NULL, NULL FROM Subject WHERE id = ? AND user_id = ?
  `, trimmedTopic, subject_id, userId);
  if (result.changes !== 1) throw new Error('Select a subject belonging to your account.');
  // No fallible read follows the committed insert: a failed lookup must not
  // report an existing topic as unsaved and invite a duplicate on retry.
  return {
    id: result.lastInsertRowId, subject_id: subject.id, topic: trimmedTopic,
    last_reviewed_at: null, next_review_at: null, subject_name: subject.name, subject_color: firstFieldColor(subject.field_colors),
  };
}

/** @param {string} userId @returns {Promise<ReviewItem[]>} */
export async function getDueReviews(userId) {
  requireUserId(userId);
  const database = await getDatabase();
  return database.getAllAsync(`
    ${REVIEW_SELECT}
    WHERE subject.user_id = ?
      AND (review.next_review_at IS NULL OR julianday(review.next_review_at) <= julianday(?))
    ORDER BY review.next_review_at IS NOT NULL, julianday(review.next_review_at), review.id
  `, userId, new Date().toISOString());
}

/** @param {string} userId @param {number} reviewId @param {ReviewDifficulty} difficulty @returns {Promise<ReviewItem>} */
export async function markReviewed(userId, reviewId, difficulty) {
  requireUserId(userId);
  if (!Number.isSafeInteger(reviewId) || reviewId < 1) throw new Error('Select a valid review item.');
  if (typeof difficulty !== 'string' || !Object.hasOwn(REVIEW_INTERVAL_DAYS, difficulty)) throw new Error('Select Hard, Good, or Easy.');
  const now = new Date();
  const next = new Date(now);
  // Advance local calendar days, preserving the review time through DST changes.
  next.setDate(next.getDate() + REVIEW_INTERVAL_DAYS[difficulty]);
  const database = await getDatabase();
  const result = await database.runAsync(`
    UPDATE ReviewItem SET last_reviewed_at = ?, next_review_at = ?
    WHERE id = ? AND subject_id IN (SELECT id FROM Subject WHERE user_id = ?)
      AND (next_review_at IS NULL OR julianday(next_review_at) <= julianday(?))
  `, now.toISOString(), next.toISOString(), reviewId, userId, now.toISOString());
  // A second tap or a stale screen cannot rate the same occurrence twice.
  if (result.changes !== 1) throw new Error('This review is no longer due or does not belong to your account.');
  return getReview(userId, reviewId);
}
