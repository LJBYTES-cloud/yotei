/** Reuse unchanged SQLite rows so memoized lists survive background refreshes.
 * Only flat records are accepted; all dashboard query results are flat values.
 * @template {{id?: string | number, date?: string}} T
 * @param {T[]} previous @param {T[]} incoming @returns {T[]}
 */
export function reconcileRows(previous, incoming) {
  const byId = new Map(previous.map(row => [row.id ?? row.date, row]));
  let unchanged = previous.length === incoming.length;
  const next = incoming.map((row, index) => {
    const old = byId.get(row.id ?? row.date);
    const keys = Object.keys(row);
    const same = old && keys.length === Object.keys(old).length && keys.every(key => Object.is(Reflect.get(old, key), Reflect.get(row, key)));
    const result = same ? old : row;
    if (result !== previous[index]) unchanged = false;
    return result;
  });
  return unchanged ? previous : next;
}
