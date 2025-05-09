import type {
  BaseTest,
  Body,
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
  Status,
  Task,
  TestEndEvent,
  TestResult,
  TestStartEvent,
  TestUnit,
  TestUnitOnEnd,
  TestUnits,
  TestWithCounters,
  TestWithParameters,
} from './types';

/**
 * Class `Suite` for creation a suite of tests.
 */
export class Suite<Test extends BaseTest = BaseTest> implements RunOptions<Test> {
  constructor(name: string, options?: Options<Test>);
  constructor(options?: Options<Test>);
  constructor(nameOrOptions?: string | Options<Test>, options?: Options<Test>) {
    this.scope = Object.create(null);
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

    if (name in this.scope) {
      if (this.scope[name] === fn) {
        return;
      }

      throw new Error(
        `Another function "${name}" already exists in the scope: ${this.scope[name]}`,
      );
    }

    this.assertFunctionName(name);

    this.cachedBodiesCreator = undefined;
    this.scope[name] = fn;
  }

  addTest<const Parameters extends readonly unknown[]>(
    name: string,
    options?: TestWithParameters<Test, Parameters>,
    body?: Body<Parameters>,
  ): void;
  addTest<const Parameters extends readonly unknown[]>(name: string, body: Body<Parameters>): void;
  addTest<const Parameters extends readonly unknown[]>(
    options: TestWithParameters<Test, Parameters>,
    body?: Body<Parameters>,
  ): void;
  addTest<const Parameters extends readonly unknown[]>(body: Body<Parameters>): void;
  addTest<const Parameters extends readonly unknown[]>(
    nameOrBodyOrOptions?: string | Body<Parameters> | TestWithParameters<Test, Parameters>,
    optionsOrBody?: TestWithParameters<Test, Parameters> | Body<Parameters>,
    body?: Body<Parameters>,
  ): void {
    const test: Mutable<TestWithParameters<BaseTest, Parameters>> = {};

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

    this.tests.push(test as Partial<BaseTest> as Partial<Test>);
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

  protected escapeTapOutput(message: string): string {
    return message.replace(/\s/g, ' ').replace(/\\/g, '\\\\').replace(/#/g, '\\#');
  }

  filterTests() {
    return true;
  }

  protected getInitialRunResult(options: Options<Test>): MutableRunResult<Test> {
    return {
      ...this.statusCounters,
      duration: 0,
      filterTestErrors: [],
      name: options.name ?? this.name,
      onSuiteEndErrors: [],
      onSuiteStartErrors: [],
      onTestEndErrors: [],
      onTestStartErrors: [],
      runStatus: 'passed',
      startTime: new Date(),
      tapOutput: 'Bail out! The suite run did not work to the end.\n1..0\n',
      testsInRun: 0,
      testsInSuite: this.tests.length,
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
        const nextTestEnd =
          tasks.size === 0
            ? undefined
            : new Promise<void>((res) => {
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

    for (const {clear, startTime, unit} of tasks) {
      clear();
      this.endTest(options, unit, {startTime, status: 'interrupted'});
    }

    for (const unit of testUnits) {
      this.endTest(options, unit, {status: 'wasNotRunInTime'});
    }
  }

  protected getRunResultTapOutput(_options: Options<Test>, runResult: RunResult<Test>): string {
    const {runStatus} = runResult;
    const bailOut =
      runStatus === 'failed' || runStatus === 'passed'
        ? ''
        : `Bail out! The suite run was interrupted by ${runStatus.slice('interruptedBy'.length)}.\n`;
    const counters = (Object.keys(this.statusCounters) as Status[])
      .map((status) => (runResult[status] > 0 ? `${status}: ${runResult[status]}` : undefined))
      .filter((counter) => counter !== undefined)
      .join(', ');
    const plan = `1..${runResult.testsInRun} # ${counters === '' ? 'No tests were run.' : counters}\n`;

    return bailOut + plan;
  }

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
    _options: Options<Test>,
    unit: TestUnit<Test>,
    result: TestResult,
  ): string {
    const {status} = result;

    if (status === 'interrupted' || status === 'wasNotRunInTime') {
      return '';
    }

    const {escapeTapOutput} = this;
    const {test} = unit;
    const description = escapeTapOutput(test.name);
    let directive = '';
    const isOk = status !== 'failed' && status !== 'timedOut';
    const testNumber = this.runResult?.testsInRun ?? 0;

    if (test.skip) {
      directive = ' # skip';

      if (typeof test.skip === 'string') {
        directive += ' ' + escapeTapOutput(test.skip);
      }
    } else if (test.todo) {
      directive = ' # todo';

      if (typeof test.todo === 'string') {
        directive += ' ' + escapeTapOutput(test.todo);
      }
    }

    const testPoint = `${isOk ? '' : 'not '}ok ${testNumber} - ${description}${directive}\n`;

    if (isOk) {
      return testPoint;
    }

    const errorMessage = result.hasError
      ? String(result.error)
      : status === 'timedOut'
        ? `${test.timeout}ms timeout expired`
        : '';
    const error = '    ' + errorMessage.split('\n').join('\n    ');

    return `${testPoint}  ---\n  duration: ${result.duration}\n  error: |\n${error}\n  ...\n`;
  }

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

    const retries: TestWithCounters<Test>[] = [];

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
        const state = yield;

        if (state === 'isRunning') {
          continue;
        }

        return;
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

  onSuiteStart(this: Suite<Test>, options: Options<Test>): Promise<void> | void {
    const {print = this.print} = options;

    print('TAP version 14\n');
  }

  onSuiteEnd(
    this: Suite<Test>,
    options: Options<Test>,
    runResult: RunResult<Test>,
  ): Promise<void> | void {
    const {print = this.print} = options;

    print(runResult.tapOutput);
  }

  onTestStart(this: Suite<Test>, _options: Options<Test>, _event: TestStartEvent<Test>): void {}

  onTestEnd(this: Suite<Test>, options: Options<Test>, event: TestEndEvent<Test>): void {
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

    let interruptionPromiseResolve: (() => void) | undefined;
    const interruptionPromise = new Promise<void>((resolve) => {
      interruptionPromiseResolve = resolve;
    });

    const timeoutId = setTimeout(() => {
      runStatus = runStatus ?? 'interruptedByTimeout';
      interruptionPromiseResolve?.();
    }, runTimeout);

    if (signal !== undefined) {
      if (signal.aborted) {
        runStatus = 'interruptedBySignal';
      } else {
        signalHandler = () => {
          runStatus = runStatus ?? 'interruptedBySignal';
          interruptionPromiseResolve?.();
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

    runner.next();

    while (runStatus === undefined) {
      if (this.runResult.failed + this.runResult.timedOut >= maxFailures) {
        runStatus = runStatus ?? 'interruptedByMaxFailures';
        break;
      }

      const unit = testUnits.next('isRunning').value;
      const {isAtMaxConcurrency = false, nextTestEnd} = runner.next(unit).value ?? {};

      if (nextTestEnd === undefined && unit === undefined) {
        break;
      }

      if ((isAtMaxConcurrency || unit === undefined) && nextTestEnd !== undefined) {
        await Promise.race<void>([interruptionPromise, nextTestEnd]);
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

    const {onTestStart = this.onTestStart} = options;
    const event: TestStartEvent<Test> = {repeatsCount, retriesCount, status: undefined, test};

    try {
      onTestStart.call(this, options, event);
    } catch (error) {
      this.runResult?.onTestStartErrors.push({error, event});
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

  protected statusCounters: Readonly<Record<Status, 0>> = {
    failed: 0,
    hasNoBody: 0,
    interrupted: 0,
    passed: 0,
    skipped: 0,
    timedOut: 0,
    wasNotRunInTime: 0,
  };

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
