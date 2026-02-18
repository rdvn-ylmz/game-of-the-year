const DEFAULT_PRIORITY = Object.freeze({
  end_fail: 500,
  end_win: 500,
  extraction_unlocked: 400,
  low_time: 300,
  damage: 200,
  phase_mid: 100
});

export function priorityForToastKey(key) {
  return DEFAULT_PRIORITY[key] ?? 10;
}

export class ToastQueue {
  constructor({
    minGapMs = 1200,
    durationMs = 2200,
    priorityForKey = priorityForToastKey
  } = {}) {
    this.minGapMs = minGapMs;
    this.durationMs = durationMs;
    this.priorityForKey = priorityForKey;
    this._queue = [];
    this._active = null;
    this._nextEligibleAt = 0;
    this._seq = 0;
  }

  enqueue(toast) {
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
  }
}
