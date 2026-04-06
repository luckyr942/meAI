/**
 * MeAI Local Queue — In-Process Async Queue
 * Replaces BullMQ + Redis with a zero-dependency, in-memory job queue.
 * Jobs are processed sequentially with configurable delays and retries.
 */

class LocalQueue {
  constructor(name, options = {}) {
    this.name = name;
    this.jobs = [];
    this.processing = false;
    this.concurrency = options.concurrency || 1;
    this.handlers = new Map();
    this.jobCounter = 0;

    console.log(`📋 Local Queue "${name}" initialized (no Redis needed!)`);
  }

  /**
   * Register a handler for a specific job name.
   */
  process(jobName, handler) {
    this.handlers.set(jobName, handler);
  }

  /**
   * Add a job to the queue.
   */
  async add(jobName, data, options = {}) {
    this.jobCounter++;
    const job = {
      id: this.jobCounter,
      name: jobName,
      data,
      delay: options.delay || 0,
      attempts: options.attempts || 3,
      currentAttempt: 0,
      addedAt: Date.now(),
    };

    this.jobs.push(job);
    console.log(`[Queue] Added job #${job.id} "${jobName}" (${this.jobs.length} pending)`);

    // Start processing if idle
    if (!this.processing) {
      this._processNext();
    }
  }

  /**
   * Internal: Process jobs sequentially with delays.
   */
  async _processNext() {
    if (this.jobs.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const job = this.jobs.shift();

    // Honor delay
    if (job.delay > 0) {
      const elapsed = Date.now() - job.addedAt;
      const remaining = job.delay - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
    }

    const handler = this.handlers.get(job.name);
    if (!handler) {
      console.error(`[Queue] No handler registered for job "${job.name}"`);
      this._processNext();
      return;
    }

    job.currentAttempt++;
    try {
      await handler(job);
      console.log(`[Queue] ✅ Job #${job.id} "${job.name}" completed.`);
    } catch (err) {
      console.error(`[Queue] ❌ Job #${job.id} "${job.name}" failed (attempt ${job.currentAttempt}/${job.attempts}): ${err.message}`);

      if (job.currentAttempt < job.attempts) {
        // Exponential backoff retry
        const retryDelay = Math.pow(2, job.currentAttempt) * 1000;
        job.delay = retryDelay;
        job.addedAt = Date.now();
        this.jobs.push(job);
        console.log(`[Queue] Retrying job #${job.id} in ${retryDelay}ms...`);
      }
    }

    // Process next job
    this._processNext();
  }

  /**
   * Get queue status summary.
   */
  status() {
    return {
      name: this.name,
      pending: this.jobs.length,
      processing: this.processing,
      totalProcessed: this.jobCounter,
    };
  }
}

module.exports = { LocalQueue };
