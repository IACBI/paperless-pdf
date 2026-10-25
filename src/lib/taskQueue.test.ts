import { describe, expect, it } from 'vitest';
import { TaskCancelledError, createTaskQueue } from './taskQueue';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createTaskQueue', () => {
  it('rejects invalid concurrency values', () => {
    expect(() => createTaskQueue(0)).toThrow(RangeError);
    expect(() => createTaskQueue(1.5)).toThrow(RangeError);
    expect(() => createTaskQueue(NaN)).toThrow(RangeError);
  });

  it('never runs more tasks than the concurrency limit', async () => {
    const queue = createTaskQueue(2);
    let active = 0;
    let maxActive = 0;
    const gates = Array.from({ length: 6 }, () => deferred());

    const tasks = gates.map((gate, i) =>
      queue.schedule(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await gate.promise;
        active--;
        return i;
      }),
    );

    await flush();
    expect(active).toBe(2);

    for (const gate of gates) {
      gate.resolve();
      await flush();
    }
    await expect(Promise.all(tasks.map((t) => t.promise))).resolves.toEqual([0, 1, 2, 3, 4, 5]);
    expect(maxActive).toBe(2);
  });

  it('starts queued tasks in FIFO order', async () => {
    const queue = createTaskQueue(1);
    const order: number[] = [];
    const tasks = [0, 1, 2].map((i) =>
      queue.schedule(async () => {
        order.push(i);
      }),
    );
    await Promise.all(tasks.map((t) => t.promise));
    expect(order).toEqual([0, 1, 2]);
  });

  it('frees the slot when a task rejects, and keeps the queue moving', async () => {
    const queue = createTaskQueue(1);
    const failing = queue.schedule(() => Promise.reject(new Error('boom')));
    const next = queue.schedule(async () => 'ok');
    await expect(failing.promise).rejects.toThrow('boom');
    await expect(next.promise).resolves.toBe('ok');
  });

  it('frees the slot when a task throws synchronously', async () => {
    const queue = createTaskQueue(1);
    const failing = queue.schedule((): Promise<never> => {
      throw new Error('sync');
    });
    const next = queue.schedule(async () => 'after');
    await expect(failing.promise).rejects.toThrow('sync');
    await expect(next.promise).resolves.toBe('after');
  });

  it('cancelling a queued task prevents it from running and rejects its promise', async () => {
    const queue = createTaskQueue(1);
    const gate = deferred();
    let ranCancelled = false;
    const blocker = queue.schedule(() => gate.promise);
    const cancelled = queue.schedule(async () => {
      ranCancelled = true;
    });
    const after = queue.schedule(async () => 'after');

    cancelled.cancel();
    await expect(cancelled.promise).rejects.toBeInstanceOf(TaskCancelledError);

    gate.resolve();
    await blocker.promise;
    await expect(after.promise).resolves.toBe('after');
    expect(ranCancelled).toBe(false);
  });

  it('cancelling a running task does not interrupt it or consume extra slots', async () => {
    const queue = createTaskQueue(1);
    const gate = deferred<string>();
    const running = queue.schedule(() => gate.promise);
    running.cancel();

    const next = queue.schedule(async () => 'next');
    gate.resolve('done');
    await expect(running.promise).resolves.toBe('done');
    await expect(next.promise).resolves.toBe('next');
  });

  it('bump moves a queued task to the front so it runs next', async () => {
    const queue = createTaskQueue(1);
    const gate = deferred();
    const order: string[] = [];
    const blocker = queue.schedule(() => gate.promise);
    const a = queue.schedule(async () => {
      order.push('a');
    });
    const b = queue.schedule(async () => {
      order.push('b');
    });
    const c = queue.schedule(async () => {
      order.push('c');
    });

    c.bump();
    gate.resolve();
    await Promise.all([blocker.promise, a.promise, b.promise, c.promise]);
    expect(order).toEqual(['c', 'a', 'b']);
  });

  it('bump on a started, settled, or cancelled task does nothing', async () => {
    const queue = createTaskQueue(1);
    const gate = deferred();
    const order: string[] = [];
    const running = queue.schedule(async () => {
      order.push('running');
      await gate.promise;
    });
    const queued = queue.schedule(async () => {
      order.push('queued');
    });
    const cancelled = queue.schedule(async () => {
      order.push('cancelled');
    });

    const cancelledOutcome = expect(cancelled.promise).rejects.toBeInstanceOf(TaskCancelledError);
    running.bump();
    cancelled.cancel();
    cancelled.bump();
    expect(() => queued.bump()).not.toThrow();

    gate.resolve();
    await Promise.all([running.promise, queued.promise]);
    await cancelledOutcome;
    expect(order).toEqual(['running', 'queued']);
  });

  it('keeps the concurrency limit while tasks are cancelled and bumped', async () => {
    const queue = createTaskQueue(2);
    let active = 0;
    let maxActive = 0;
    const started: number[] = [];
    const gates = Array.from({ length: 6 }, () => deferred());

    const tasks = gates.map((gate, i) =>
      queue.schedule(async () => {
        started.push(i);
        active++;
        maxActive = Math.max(maxActive, active);
        await gate.promise;
        active--;
        return i;
      }),
    );

    // Attached before cancelling so the rejection is never unhandled.
    const cancelled = expect(tasks[4].promise).rejects.toBeInstanceOf(TaskCancelledError);
    tasks[4].cancel();
    tasks[5].bump();
    tasks[3].bump();
    await flush();
    expect(active).toBe(2);

    for (const gate of gates) {
      gate.resolve();
      await flush();
    }
    await cancelled;
    await expect(Promise.all([0, 1, 2, 3, 5].map((i) => tasks[i].promise))).resolves.toEqual([
      0, 1, 2, 3, 5,
    ]);
    expect(started).toEqual([0, 1, 3, 5, 2]);
    expect(maxActive).toBe(2);
  });

  it('cancelling twice or after settling is a no-op', async () => {
    const queue = createTaskQueue(1);
    const task = queue.schedule(async () => 1);
    await expect(task.promise).resolves.toBe(1);
    expect(() => task.cancel()).not.toThrow();
    expect(() => task.cancel()).not.toThrow();
  });
});
