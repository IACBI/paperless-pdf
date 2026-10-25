/** Rejection reason for a task that was cancelled before it started. */
export class TaskCancelledError extends Error {
  constructor() {
    super('Task was cancelled before it started');
    this.name = 'TaskCancelledError';
  }
}

export interface ScheduledTask<T> {
  promise: Promise<T>;
  /**
   * Drops the task if it has not started yet; its promise then rejects with
   * {@link TaskCancelledError}. A task that is already running is not
   * interrupted: it finishes, and the caller decides whether to use the result.
   */
  cancel(): void;
  /**
   * Moves a task that has not started yet to the front of the queue, so it
   * runs next. Does nothing once the task has started, settled, or been
   * cancelled.
   */
  bump(): void;
}

export interface TaskQueue {
  schedule<T>(task: () => Promise<T>): ScheduledTask<T>;
}

/**
 * Queue that runs at most `concurrency` async tasks at once. Tasks start in
 * FIFO order unless {@link ScheduledTask.bump} moves one forward. Used to keep
 * a 1000-page document from starting 1000 pdf.js renders in the same tick.
 */
export function createTaskQueue(concurrency: number): TaskQueue {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('createTaskQueue: concurrency must be a positive integer');
  }

  let active = 0;
  const waiting: Array<() => void> = [];

  function pump(): void {
    while (active < concurrency && waiting.length > 0) {
      const start = waiting.shift();
      if (!start) break;
      active++;
      start();
    }
  }

  return {
    schedule<T>(task: () => Promise<T>): ScheduledTask<T> {
      let settled = false;
      let started = false;
      let resolveTask!: (value: T) => void;
      let rejectTask!: (reason: unknown) => void;
      const promise = new Promise<T>((resolve, reject) => {
        resolveTask = resolve;
        rejectTask = reject;
      });

      const start = (): void => {
        started = true;
        let running: Promise<T>;
        try {
          running = Promise.resolve(task());
        } catch (error) {
          running = Promise.reject(error);
        }
        // A finished task always frees its slot, even when it failed, so one
        // bad render cannot stall the rest of the queue.
        running
          .then(
            (value) => {
              settled = true;
              resolveTask(value);
            },
            (error: unknown) => {
              settled = true;
              rejectTask(error);
            },
          )
          .finally(() => {
            active--;
            pump();
          });
      };

      waiting.push(start);
      pump();

      return {
        promise,
        cancel(): void {
          if (started || settled) return;
          const index = waiting.indexOf(start);
          if (index !== -1) waiting.splice(index, 1);
          settled = true;
          rejectTask(new TaskCancelledError());
        },
        bump(): void {
          if (started || settled) return;
          const index = waiting.indexOf(start);
          if (index > 0) {
            waiting.splice(index, 1);
            waiting.unshift(start);
          }
        },
      };
    },
  };
}
