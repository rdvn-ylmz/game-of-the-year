const DEFAULT_PRIORITY = Object.freeze({
  end_critical: 600,
  damage: 500,
  phase_two: 400,
  phase_three: 400,
  combo_timeout: 300,
  combo_cap: 200,
  combo_gain: 100,
  combo_reset: 90
});

const DEFAULT_DEBOUNCE_BY_KEY_MS = Object.freeze({
  combo_gain: 900
});

export function priorityForToastKey(key) {
  return DEFAULT_PRIORITY[key] ?? 10;
}

export class ToastQueue {
  constructor({
    minGapMs = 1200,
    durationMs = 2200,
    priorityForKey = priorityForToastKey,
    debounceByKeyMs = DEFAULT_DEBOUNCE_BY_KEY_MS
  } = {}) {
    this.minGapMs = minGapMs;
    this.durationMs = durationMs;
    this.priorityForKey = priorityForKey;
    this.debounceByKeyMs = debounceByKeyMs;
    this._queue = [];
    this._active = null;
    this._nextEligibleAt = 0;
    this._lastEnqueueAtByKey = {};
    this._seq = 0;
  }

  enqueue(toast, nowMs = 0) {
    const debounceMs = this.debounceByKeyMs[toast.key] ?? 0;
    const lastEnqueueAt = this._lastEnqueueAtByKey[toast.key] ?? -Infinity;
    if (debounceMs > 0 && nowMs - lastEnqueueAt < debounceMs) {
      return false;
    }

    this._lastEnqueueAtByKey[toast.key] = nowMs;
    const normalized = {
      ...toast,
      _seq: this._seq,
      _priority: this.priorityForKey(toast.key)
    };
    this._seq += 1;

    this._queue.push(normalized);
    this._queue.sort((left, right) => {
      if (right._priority !== left._priority) {
        return right._priority - left._priority;
      }
      return left._seq - right._seq;
    });
    return true;
  }

  tick(nowMs) {
    let changed = false;

    if (this._active && nowMs >= this._active.hideAt) {
      this._active = null;
      changed = true;
    }

    if (!this._active && this._queue.length > 0 && nowMs >= this._nextEligibleAt) {
      const next = this._queue.shift();
      this._active = {
        key: next.key,
        message: next.message,
        values: next.values ?? null,
        tone: next.tone,
        hideAt: nowMs + this.durationMs
      };
      this._nextEligibleAt = nowMs + this.minGapMs;
      changed = true;
    }

    return {
      changed,
      active: this._active
    };
  }

  reset() {
    this._queue = [];
    this._active = null;
    this._nextEligibleAt = 0;
    this._lastEnqueueAtByKey = {};
  }
}
