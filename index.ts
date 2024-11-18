import type {
  BaseTest,
  CachedBodiesCreator,
  ClearTimeout,
  EndTestResult,
  InterruptedRunStatus,
  Mutable,
  Options,
  Runner,
  RunningTestResult,
  RunningTestStatus,
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

  protected bodiesCache: Record<string, Function> = Object.create(null);

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
    const tasks: Set<Task<Test>> = new Set();
    const testUnits: TestUnit<Test>[] = [];

    while (true) {
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

        if (unit === 'interrupted') {
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

    for (const unit of testUnits) {
      this.endTest(options, unit, {status: 'wasNotRun'});
    }

    for (const {clear, startTime, unit} of tasks) {
      clear();
      this.endTest(options, unit, {startTime, status: 'interrupted'});
    }
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
    const {now = this.now} = options;
    const start = now();

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
      const {isAtMaxConcurrency = false, nextTestEnd} = runner.next(unit).value ?? {};

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
      runner.next('interrupted');
    }

    for (const unit of testUnits) {
      if (unit !== undefined) {
        this.endTest(options, unit, {status: 'wasNotRun'});
      }
    }

    this.runResult.duration = now() - start;

    return this.runResult;
  }

  protected runResult: Mutable<RunResult> | undefined;

  protected runTestUnit(options: Options<Test>, unit: TestUnit<Test>): Task | undefined {
    const {test} = unit;

    if (unit.status !== undefined) {
      this.endTest(options, unit, {status: unit.status});

      return;
    }

    const {body, fail, parameters} = test;

    if (typeof body !== 'function') {
      this.endTest(options, unit, {status: 'todo'});

      return;
    }

    if (this.cachedBodiesCreator === undefined) {
      const names = Object.keys(this.scope).join(',');

      this.bodiesCache = Object.create(null);
      this.cachedBodiesCreator = new Function(
        `"use strict";var{${names}}=this.scope;return eval(this.source)`,
      ) as CachedBodiesCreator;
    }

    const source = String(body);

    let bodyWithScope = this.bodiesCache[source];

    if (bodyWithScope === undefined) {
      bodyWithScope = this.cachedBodiesCreator.call({scope: this.scope, source}) as Function;
      this.bodiesCache[source] = bodyWithScope;
    }

    let error: unknown;
    let hasError = false;
    let isEnded = false;
    let resolve: (() => void) | undefined;
    let result: unknown;
    let status: RunningTestStatus | undefined;

    const {
      clearTimeout = this.clearTimeout,
      now = this.now,
      setTimeout = this.setTimeout,
    } = options;

    const onEnd = (): void => {
      if (isEnded) {
        return;
      }

      const duration = now() - start;

      isEnded = true;
      status = status ?? (hasError === fail ? 'passed' : 'failed');
      resolve?.();

      const testResult: RunningTestResult = {duration, error, hasError, startTime, status};

      this.endTest(options, unit, testResult);
    };

    const startTime = new Date();
    const start = now();

    try {
      result = bodyWithScope(...parameters);
    } catch (catchedError) {
      error = catchedError;
      hasError = true;
    }

    if (!(result instanceof Object) || !('then' in result) || typeof result.then !== 'function') {
      onEnd();

      return;
    }

    const end = new Promise<void>((res) => {
      resolve = res;
    });

    const timePassed = now() - start;

    const timeoutId = setTimeout(() => {
      status = 'timedOut';
      onEnd();
    }, test.timeout - timePassed);

    const clear = (): void => {
      clearTimeout(timeoutId as number);
    };

    result.then(
      () => {
        onEnd();
      },
      (catchedError: unknown) => {
        error = catchedError;
        hasError = true;
        onEnd();
      },
    );

    const task: Task<Test> = {clear, done: false, end, startTime, unit};

    return task;
  }

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

export type * from './types';
