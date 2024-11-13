import type {
  BaseTest,
  CachedBodiesCreator,
  ClearTimeout,
  EndTestResult,
  InterruptedRunStatus,
  Mutable,
  Options,
  Runner,
  RunOptions,
  RunResult,
  SetTimeout,
  Task,
  TestEndEvent,
  TestResult,
  TestStartEvent,
  TestUnit,
  TestUnits,
} from './types';

// var fn = new Function('"use strict";var{bar,bar1,bar2,bar3}=this.scope;return eval(this.source)');

export class Suite<Test extends BaseTest = BaseTest> implements RunOptions<Test> {
  constructor(name: string, options?: Options<Test>);
  constructor(options?: Options<Test>);
  constructor(nameOrOptions?: string | Options<Test>, options?: Options<Test>) {
    this.scope = {__proto__: null as any};
    this.tests = [];

    if (typeof nameOrOptions === 'string') {
      this.name = nameOrOptions;
    } else {
      Object.assign(this, nameOrOptions);
    }

    Object.assign(this, options);
  }

  addFunctionToScope(fn: Function, name?: string): void {
    if (name === undefined) {
      name = fn.name;
    } else {
      // TODO check name by RegExp
    }

    if (name in this.scope) {
      throw new Error(`Function "${name}" already exists in the scope: ${this.scope[name]}`);
    }

    this.scope[name] = fn;
    this.cachedBodiesCreator = undefined;
  }

  addTest(name: string, options?: Partial<Test>, body?: Test['body']): void;
  addTest(name: string, body: Test['body']): void;
  addTest(options: Partial<Test>, body?: Test['body']): void;
  addTest(body: Test['body']): void;
  addTest(
    nameOrBodyOrOptions?: string | Test['body'] | Partial<Test>,
    optionsOrBody?: Partial<Test> | Test['body'],
    body?: Test['body'],
  ): void {
    const test = {} as Mutable<Partial<Test>>;

    if (typeof nameOrBodyOrOptions === 'string') {
      test.name = nameOrBodyOrOptions;

      if (typeof optionsOrBody === 'function') {
        test.body = optionsOrBody;
      } else {
        test.body = body;
        Object.assign(test, optionsOrBody);
      }
    } else if (typeof nameOrBodyOrOptions === 'function') {
      test.body = nameOrBodyOrOptions;
    } else {
      if (typeof optionsOrBody === 'function') {
        test.body = optionsOrBody;
      }

      Object.assign(test, nameOrBodyOrOptions);
    }

    this.tests.push(test);
  }

  protected bodiesCache: Record<string, Function> | undefined;

  protected cachedBodiesCreator: CachedBodiesCreator | undefined;

  clearTimeout: ClearTimeout = globalThis.clearTimeout;

  concurrency = 1;

  protected endTest(options: Options<Test>, unit: TestUnit<Test>, result: EndTestResult): void {}

  filterTests() {
    return true;
  }

  protected getInitialRunResult(options: Options<Test>): RunResult {
    return {
      duration: 0,
      failed: 0,
      interrupted: 0,
      name: options.name ?? this.name,
      passed: 0,
      runStatus: 'passed',
      skipped: 0,
      startTime: new Date(),
      testsInRun: 0,
      testsInSuite: this.tests.length,
      timedOut: 0,
      todo: 0,
      wasNotRun: 0,
    };
  }

  protected *getRunner(options: Options<Test>): Runner<Test> {
    const {concurrency = this.concurrency} = options;
    let resolve: () => void = () => {};
    const tasks: Set<Task> = new Set();
    let runStatus: InterruptedRunStatus | undefined;
    const testUnits: TestUnit<Test>[] = [];

    while (runStatus === undefined) {
      let isAtMaxConcurrency = !(tasks.size < concurrency);

      if (isAtMaxConcurrency || testUnits.length === 0) {
        const nextTestEnd = new Promise<void>((res) => {
          resolve = res;
        });
        const unit = yield {isAtMaxConcurrency, nextTestEnd};

        for (const task of tasks) {
          if (task.done) {
            tasks.delete(task);
          }
        }

        isAtMaxConcurrency = !(tasks.size < concurrency);

        if (typeof unit === 'string') {
          runStatus = unit;
          break;
        }

        if (unit !== undefined) {
          testUnits.unshift(unit);
        }
      }

      if (isAtMaxConcurrency) {
        continue;
      }

      const unit = testUnits.pop();

      if (unit === undefined) {
        continue;
      }

      const task = this.runTestUnit(options, unit);

      if (task === undefined) {
        continue;
      }

      tasks.add(task);

      const handler = () => {
        task.done = true;
        resolve();
      };

      task.end.then(handler, handler);
    }

    runStatus;
  }

  protected *getTestUnits(options: Options<Test>): TestUnits<Test> {}

  maxFailures: number = Infinity;

  name = 'anonymous';

  now: () => number = globalThis.performance?.now || Date.now;

  onTestStart(event: TestStartEvent<Test>): void {}

  onTestEnd(event: TestEndEvent<Test>): void {}

  repeats = 1;

  retries = 0;

  async run(options: Options<Test> = {}): Promise<RunResult> {
    const start = this.now();

    let runStatus: InterruptedRunStatus | undefined;
    let signalHandler: (() => void) | undefined;

    const {
      clearTimeout = this.clearTimeout,
      maxFailures = this.maxFailures,
      runTimeout = this.runTimeout,
      setTimeout = this.setTimeout,
      signal = this.signal,
    } = options;

    const timeoutId = setTimeout(() => {
      runStatus = runStatus ?? 'interruptedByTimeout';
    }, runTimeout);

    if (signal !== undefined) {
      if (signal.aborted) {
        runStatus = 'interruptedBySignal';
      } else {
        signalHandler = () => {
          runStatus = runStatus ?? 'interruptedBySignal';
        };

        signal.addEventListener('abort', signalHandler);
      }
    }

    this.runResult = this.getInitialRunResult(options);

    const runner = this.getRunner(options);
    const testUnits = this.getTestUnits(options);

    while (runStatus === undefined) {
      if (this.runResult.failed >= maxFailures) {
        runStatus = runStatus ?? 'interruptedByMaxFailures';
        break;
      }

      const unit = testUnits.next().value;
      const {isAtMaxConcurrency, nextTestEnd} = runner.next(unit).value;

      if (nextTestEnd === undefined && unit === undefined) {
        break;
      }

      if (isAtMaxConcurrency || unit === undefined) {
        await nextTestEnd;
      }
    }

    clearTimeout(timeoutId as number);

    if (signalHandler !== undefined) {
      signal?.removeEventListener('abort', signalHandler);
    }

    if (runStatus !== undefined) {
      this.runResult.runStatus = runStatus;
      runner.next(runStatus);
    }

    for (const unit of testUnits) {
      if (unit !== undefined) {
        this.endTest(options, unit, {status: 'wasNotRun'});
      }
    }

    this.runResult.duration = this.now() - start;

    return this.runResult;
  }

  protected runResult: Mutable<RunResult> | undefined;

  protected runTestUnit(options: Options<Test>, unit: TestUnit<Test>): Task | undefined {}

  scope: Record<string, Function>;

  setTimeout: SetTimeout = globalThis.setTimeout;

  signal: AbortSignal | undefined;

  runTimeout = 300_000;

  tests: Partial<Test>[];

  testTimeout = 10_000;

  protected updateRunResult(
    options: Options<Test>,
    unit: TestUnit<Test>,
    result: TestResult,
  ): void {}
}
