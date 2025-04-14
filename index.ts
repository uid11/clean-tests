import type {
  BaseTest,
  CachedBodiesCreator,
  ClearTimeout,
  EndResult,
  EndedTestStatus,
  EndedTestResult,
  InterruptedRunStatus,
  Mutable,
  MutableRunResult,
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
  TestUnitOnEnd,
  TestUnits,
  TestWithCounts,
} from './types';

/**
 * Class `Suite` for creation a suite of tests.
 */
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
    }

    this.assertFunctionName(name);

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

  protected assertFunctionName(name: string): void {
    try {
      if (!/^[\p{ID_Continue}$]+$/u.test(name)) {
        throw undefined;
      }

      new Function(name, '');
    } catch {
      throw new Error(`The function name "${name}" is not a valid identifier`);
    }
  }

  protected bodiesCache: Record<string, Function> = Object.create(null);

  protected cachedBodiesCreator: CachedBodiesCreator | undefined;

  clearTimeout: ClearTimeout = globalThis.clearTimeout;

  concurrency = 1;

  protected endTest(options: Options<Test>, unit: TestUnit<Test>, endResult: EndResult): void {
    if (unit.isEnded) {
      return;
    }

    unit.isEnded = true;

    const {onTestEnd = this.onTestEnd, onTestStart = this.onTestStart} = options;
    let result: TestResult;
    const {status} = endResult;
    const {repeatsCount, retriesCount, test} = unit;

    if (status === 'interrupted') {
      result = {
        duration: Date.now() - Number(endResult.startTime),
        error: undefined,
        hasError: false,
        startTime: endResult.startTime,
        status,
      };
    } else if (status === 'hasNoBody' || status === 'skipped' || status === 'wasNotRunInTime') {
      const event: TestStartEvent<Test> = {repeatsCount, retriesCount, status, test};

      try {
        onTestStart.call(this, options, event);
      } catch (error) {
        this.runResult?.onTestStartErrors.push({error, event});
      }

      result = {duration: 0, error: undefined, hasError: false, startTime: new Date(), status};
    } else {
      result = endResult;
    }

    this.updateRunResult(options, unit, result);

    const tapOutput = this.getTestTapOutput(options, unit, result);

    const event: TestEndEvent<Test> = {repeatsCount, result, retriesCount, tapOutput, test};

    try {
      onTestEnd.call(this, options, event);
    } catch (error) {
      this.runResult?.onTestEndErrors.push({error, event});
    }

    unit.onEnd?.(unit, result);
  }

  filterTests() {
    return true;
  }

  protected getInitialRunResult(options: Options<Test>): MutableRunResult<Test> {
    return {
      duration: 0,
      failed: 0,
      filterTestErrors: [],
      hasNoBody: 0,
      interrupted: 0,
      name: options.name ?? this.name,
      onSuiteEndErrors: [],
      onSuiteStartErrors: [],
      onTestEndErrors: [],
      onTestStartErrors: [],
      passed: 0,
      runStatus: 'passed',
      skipped: 0,
      startTime: new Date(),
      tapOutput: 'Bail out! The suite run did not work to the end.\n1..0\n',
      testsInRun: 0,
      testsInSuite: this.tests.length,
      timedOut: 0,
      wasNotRunInTime: 0,
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
          if (task.isEnded) {
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
        task.isEnded = true;
        resolve();
      };

      task.end.then(handler, handler);
    }

    for (const unit of testUnits) {
      this.endTest(options, unit, {status: 'wasNotRunInTime'});
    }

    for (const {clear, startTime, unit} of tasks) {
      clear();
      this.endTest(options, unit, {startTime, status: 'interrupted'});
    }
  }

  protected getRunResultTapOutput(options: Options<Test>, runResult: RunResult<Test>): string {}

  protected getTest(options: Options<Test>, partialTest: Partial<Test>): Test {
    const {
      repeats: testRepeats = this.repeats,
      retries: testRetries = this.retries,
      testTimeout = this.testTimeout,
    } = options;

    const {
      body,
      fail = false,
      name = 'anonymous',
      only = false,
      parameters = [],
      repeats = testRepeats,
      retries = testRetries,
      skip = false,
      timeout = testTimeout,
      todo = false,
      ...rest
    } = partialTest;

    const test: BaseTest = {
      body,
      fail,
      name,
      only,
      parameters,
      repeats,
      retries,
      skip,
      timeout,
      todo,
      ...rest,
    };

    return test as Test;
  }

  protected getTestTapOutput(
    options: Options<Test>,
    unit: TestUnit<Test>,
    result: TestResult,
  ): string {}

  protected *getTestUnits(options: Options<Test>): TestUnits<Test> {
    const {filterTests = this.filterTests} = options;

    let tests: Test[] = [];
    const allTests: readonly Test[] = this.tests.map((partialTest) => {
      const test = this.getTest(options, partialTest);

      if (test.only) {
        tests.push(test);
      }

      return test;
    });

    const hasOnlyTests = tests.length > 0;

    if (!hasOnlyTests) {
      tests = allTests.filter((test) => {
        try {
          return filterTests.call(this, options, test);
        } catch (error) {
          this.runResult?.filterTestErrors.push({error, test});

          return false;
        }
      });
    }

    const retries: TestWithCounts<Test>[] = [];

    const onEnd: TestUnitOnEnd<Test> = ({repeatsCount, retriesCount, test}, {status}) => {
      if (status !== 'failed' && status !== 'timedOut') {
        return;
      }

      const newRetriesCount = retriesCount + 1;

      if (newRetriesCount <= test.retries) {
        retries.unshift({repeatsCount, retriesCount: newRetriesCount, test});
      }
    };

    let repeatsIndex = 1;
    let testIndex = 0;

    while (true) {
      if (retries.length > 0) {
        const {repeatsCount, retriesCount, test} = retries.pop()!;

        yield {
          isEnded: false,
          onEnd,
          repeatsCount,
          retriesCount,
          status: undefined,
          test,
        };

        continue;
      }

      const test = tests[testIndex];

      if (test === undefined) {
        yield;

        continue;
      }

      if (!hasOnlyTests && test.skip !== false) {
        yield {
          isEnded: false,
          onEnd: undefined,
          repeatsCount: 0,
          retriesCount: 0,
          status: 'skipped',
          test,
        };

        repeatsIndex = 1;
        testIndex += 1;

        continue;
      }

      if (repeatsIndex <= test.repeats) {
        yield {
          isEnded: false,
          onEnd: test.retries > 0 ? onEnd : undefined,
          repeatsCount: repeatsIndex,
          retriesCount: 0,
          status: undefined,
          test,
        };

        repeatsIndex += 1;

        continue;
      }

      repeatsIndex = 1;
      testIndex += 1;
    }
  }

  maxFailures: number = Infinity;

  name = 'anonymous';

  now: (this: void) => number =
    globalThis.performance?.now.bind(globalThis.performance) || Date.now;

  onSuiteStart(options: Options<Test>): Promise<void> | void {
    const {print = this.print} = options;

    print('TAP version 14\n');
  }

  onSuiteEnd(options: Options<Test>, runResult: RunResult<Test>): Promise<void> | void {
    const {print = this.print} = options;

    print(runResult.tapOutput);
  }

  onTestStart(_options: Options<Test>, _event: TestStartEvent<Test>): void {}

  onTestEnd(options: Options<Test>, event: TestEndEvent<Test>): void {
    const {print = this.print} = options;

    print(event.tapOutput);
  }

  print: (this: void, message: string) => void = globalThis.console?.log ?? (() => {});

  repeats = 1;

  retries = 0;

  async run(options: Options<Test> = {}): Promise<RunResult<Test>> {
    const {now = this.now} = options;
    const start = now();

    let runStatus: InterruptedRunStatus | undefined;
    let signalHandler: (() => void) | undefined;

    const {
      clearTimeout = this.clearTimeout,
      maxFailures = this.maxFailures,
      onSuiteEnd = this.onSuiteEnd,
      onSuiteStart = this.onSuiteStart,
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

    try {
      await onSuiteStart.call(this, options);
    } catch (error) {
      this.runResult.onSuiteStartErrors.push(error);
    }

    const runner = this.getRunner(options);
    const testUnits = this.getTestUnits(options);

    while (runStatus === undefined) {
      if (this.runResult.failed + this.runResult.timedOut >= maxFailures) {
        runStatus = runStatus ?? 'interruptedByMaxFailures';
        break;
      }

      const unit = testUnits.next().value;
      const {isAtMaxConcurrency = false, nextTestEnd} = runner.next(unit).value ?? {};

      if (nextTestEnd === undefined && unit === undefined) {
        break;
      }

      if ((isAtMaxConcurrency || unit === undefined) && nextTestEnd !== undefined) {
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
        this.endTest(options, unit, {status: 'wasNotRunInTime'});
      }
    }

    this.runResult.tapOutput = this.getRunResultTapOutput(options, this.runResult);
    this.runResult.duration = now() - start;

    try {
      await onSuiteEnd.call(this, options, this.runResult);
    } catch (error) {
      this.runResult.onSuiteEndErrors.push(error);
    }

    this.runResult.duration = now() - start;

    return this.runResult;
  }

  protected runResult: MutableRunResult<Test> | undefined;

  protected runTestUnit(options: Options<Test>, unit: TestUnit<Test>): Task<Test> | undefined {
    const {repeatsCount, retriesCount, test} = unit;

    if (unit.status !== undefined) {
      this.endTest(options, unit, {status: unit.status});

      return;
    }

    const {body, fail, parameters} = test;

    if (typeof body !== 'function') {
      this.endTest(options, unit, {status: 'hasNoBody'});

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

    let clear: (() => void) | undefined;
    let error: unknown;
    let hasError = false;
    let resolve: (() => void) | undefined;
    let result: unknown;
    let status: EndedTestStatus | undefined;

    const {
      clearTimeout = this.clearTimeout,
      now = this.now,
      onTestStart = this.onTestStart,
      setTimeout = this.setTimeout,
    } = options;

    let onEnd = (): void => {
      const duration = now() - start;

      onEnd = () => {};
      status = status ?? (hasError === fail ? 'passed' : 'failed');
      clear?.();

      const testResult: EndedTestResult = {duration, error, hasError, startTime, status};

      this.endTest(options, unit, testResult);

      resolve?.();
    };

    const event: TestStartEvent<Test> = {repeatsCount, retriesCount, status: undefined, test};

    try {
      onTestStart.call(this, options, event);
    } catch (error) {
      this.runResult?.onTestStartErrors.push({error, event});
    }

    const startTime = new Date();
    const start = now();

    try {
      result = bodyWithScope(...parameters);
    } catch (catchedError) {
      error = catchedError;
      hasError = true;
    }

    if (
      result == null ||
      (typeof result !== 'object' && typeof result !== 'function') ||
      !('then' in result) ||
      typeof result.then !== 'function'
    ) {
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

    clear = (): void => {
      clearTimeout(timeoutId as number);
    };

    result.then(onEnd, (catchedError: unknown) => {
      error = catchedError;
      hasError = true;
      onEnd();
    });

    const task: Task<Test> = {clear, end, isEnded: false, startTime, unit};

    return task;
  }

  scope: Record<string, Function>;

  setTimeout: SetTimeout = globalThis.setTimeout;

  signal: AbortSignal | undefined;

  runTimeout = 300_000;

  tests: Partial<Test>[];

  testTimeout = 10_000;

  protected updateRunResult(
    _options: Options<Test>,
    unit: TestUnit<Test>,
    result: TestResult,
  ): void {
    const {runResult} = this;
    const {status} = result;

    if (runResult === undefined) {
      return;
    }

    if (
      (status === 'failed' || status === 'timedOut') &&
      runResult.runStatus === 'passed' &&
      unit.test.todo === false
    ) {
      runResult.runStatus = 'failed';
    }

    runResult.duration = Date.now() - Number(runResult.startTime);
    runResult[status] += 1;
    runResult.testsInRun += 1;
  }
}

export type * from './types';
