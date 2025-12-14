import type {
  AssertValueIsTrue,
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
  Payload,
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
  Thenable,
} from './types';

/**
 * Asserts that the value is `true` (strictly equal to `true`).
 */
export const assertValueIsTrue: AssertValueIsTrue = (
  value: unknown,
  messageOrPayload?: Payload | string,
  payload?: Payload,
) => {
  assertValueIsTrue.assertCount += 1;

  const event = value === true ? 'onPass' : 'onFailure';

  if (typeof messageOrPayload === 'string') {
    assertValueIsTrue[event]?.(value, messageOrPayload, payload);
  } else {
    assertValueIsTrue[event]?.(value, undefined, messageOrPayload ?? payload);
  }
};

assertValueIsTrue.assertCount = 0;
assertValueIsTrue.onFailure = (value, message, payload) => {
  const payloadString = payload
    ? ' ' +
      JSON.stringify(
        payload,
        (_key, val: unknown) =>
          typeof val === 'function' ? String(val) : val instanceof Error ? val.stack : val,
        2,
      )
    : '';

  throw new Error(`${message ? message + ': ' : ''}${value} is not true${payloadString}`);
};

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

      Object.assign<Suite<Test>, Options<Test> | undefined>(this, options);
    } else {
      Object.assign<Suite<Test>, Options<Test> | undefined>(this, nameOrOptions);
    }
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
        Object.assign<
          TestWithParameters<BaseTest, Parameters>,
          TestWithParameters<Test, Parameters> | undefined
        >(test, optionsOrBody);
      }
    } else if (typeof nameOrBodyOrOptions === 'function') {
      test.body = nameOrBodyOrOptions;
    } else {
      if (typeof optionsOrBody === 'function') {
        test.body = optionsOrBody;
      }

      Object.assign<
        TestWithParameters<BaseTest, Parameters>,
        TestWithParameters<Test, Parameters> | undefined
      >(test, nameOrBodyOrOptions);
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
    const {repeatIndex, retryIndex, test} = unit;

    if (status === 'interrupted') {
      result = {
        duration: Date.now() - Number(endResult.startTime),
        error: undefined,
        hasError: false,
        startTime: endResult.startTime,
        status,
      };
    } else if (status === 'hasNoBody' || status === 'skipped' || status === 'wasNotRunInTime') {
      const event: TestStartEvent<Test> = {repeatIndex, retryIndex, status, test};

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

    const event: TestEndEvent<Test> = {repeatIndex, result, retryIndex, tapOutput, test};

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
    const {name = this.name} = options;
    const escapedName = this.escapeTapOutput(name);

    return {
      ...this.statusCounters,
      duration: 0,
      filterTestsErrors: [],
      name,
      onSuiteEndErrors: [],
      onSuiteStartErrors: [],
      onTestEndErrors: [],
      onTestStartErrors: [],
      runStatus: 'passed',
      startTime: new Date(),
      tapOutput: `Bail out! The suite run did not work to the end.\n1..0 # ${escapedName} (no tests were run)\n`,
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

  protected getRunResultTapOutput(options: Options<Test>, runResult: RunResult<Test>): string {
    const {name = this.name} = options;
    const {runStatus} = runResult;
    const bailOut =
      runStatus === 'failed' || runStatus === 'passed'
        ? ''
        : `Bail out! The suite run was interrupted by ${runStatus.slice('interruptedBy'.length)}.\n`;
    const counters = (Object.keys(this.statusCounters) as Status[])
      .map((status) => (runResult[status] > 0 ? `${status}: ${runResult[status]}` : undefined))
      .filter((counter) => counter !== undefined)
      .join(', ');
    const escapedName = this.escapeTapOutput(name);
    const plan = `1..${runResult.testsInRun} # ${escapedName} (${counters === '' ? 'no tests were run' : counters})\n`;

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
    options: Options<Test>,
    unit: TestUnit<Test>,
    result: TestResult,
  ): string {
    const {duration, error, hasError, status} = result;

    if (status === 'interrupted' || status === 'wasNotRunInTime') {
      return '';
    }

    const {escapeTapOutput} = this;
    const {onelineTapOutput = this.onelineTapOutput} = options;
    const {repeatIndex, retryIndex, test} = unit;
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

    if (isOk && onelineTapOutput) {
      return testPoint;
    }

    const fields: string[] = [`duration: ${duration}`];

    if (hasError || status === 'timedOut') {
      const errorMessage = hasError
        ? String(error instanceof Error ? error.stack : error)
        : status === 'timedOut'
          ? `${test.timeout}ms timeout expired`
          : '';
      const errorMessageWithIndent = errorMessage.split('\n').join('\n    ');

      fields.push(`error: |\n    ${errorMessageWithIndent}`);
    }

    if (test.parameters.length > 0) {
      fields.push(`parameters: ${JSON.stringify(test.parameters)}`);
    }

    if (repeatIndex > 1) {
      fields.push(`repeatIndex: ${repeatIndex}`);
    }

    if (retryIndex > 0) {
      fields.push(`retryIndex: ${retryIndex}`);
    }

    if (status === 'hasNoBody' || status === 'timedOut') {
      fields.push(`status: ${status}`);
    }

    return `${testPoint}  ---\n  ${fields.join('\n  ')}\n  ...\n`;
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
          this.runResult?.filterTestsErrors.push({error, test});

          return false;
        }
      });
    }

    const retries: TestWithCounters<Test>[] = [];

    const onEnd: TestUnitOnEnd<Test> = ({repeatIndex, retryIndex, test}, {status}) => {
      if (status !== 'failed' && status !== 'timedOut') {
        return;
      }

      const newRetryIndex = retryIndex + 1;

      if (newRetryIndex <= test.retries) {
        retries.unshift({repeatIndex, retryIndex: newRetryIndex, test});
      }
    };

    let currentRepeatIndex = 1;
    let testIndex = 0;

    while (true) {
      if (retries.length > 0) {
        const {repeatIndex, retryIndex, test} = retries.pop()!;

        yield {
          isEnded: false,
          onEnd,
          repeatIndex,
          retryIndex,
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
          repeatIndex: 0,
          retryIndex: 0,
          status: 'skipped',
          test,
        };

        currentRepeatIndex = 1;
        testIndex += 1;

        continue;
      }

      if (currentRepeatIndex <= test.repeats) {
        yield {
          isEnded: false,
          onEnd: test.retries > 0 ? onEnd : undefined,
          repeatIndex: currentRepeatIndex,
          retryIndex: 0,
          status: undefined,
          test,
        };

        currentRepeatIndex += 1;

        continue;
      }

      currentRepeatIndex = 1;
      testIndex += 1;
    }
  }

  protected isThenable<Type>(value: Type): value is Type & Thenable {
    return (
      value != null &&
      (typeof value === 'object' || typeof value === 'function') &&
      'then' in value &&
      typeof value.then === 'function'
    );
  }

  maxFailures: number = Infinity;

  name = 'anonymous';

  now: (this: void) => number =
    globalThis.performance?.now.bind(globalThis.performance) || Date.now;

  onelineTapOutput = false;

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
      const result = onSuiteStart.call(this, options);

      if (this.isThenable(result)) {
        await result;
      }
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
      const result = onSuiteEnd.call(this, options, this.runResult);

      if (this.isThenable(result)) {
        await result;
      }
    } catch (error) {
      this.runResult.onSuiteEndErrors.push(error);
    }

    this.runResult.duration = now() - start;

    return this.runResult;
  }

  protected runResult: MutableRunResult<Test> | undefined;

  protected runTestUnit(options: Options<Test>, unit: TestUnit<Test>): Task<Test> | undefined {
    const {repeatIndex, retryIndex, test} = unit;

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
    const event: TestStartEvent<Test> = {repeatIndex, retryIndex, status: undefined, test};

    try {
      onTestStart.call(this, options, event);
    } catch (error) {
      this.runResult?.onTestStartErrors.push({error, event});
    }

    if (this.cachedBodiesCreator === undefined) {
      const names = Object.keys(this.scope).join(',');

      this.bodiesCache = Object.create(null);
      this.cachedBodiesCreator = new Function(
        `'use strict';var{${names}}=this.scope;return eval('('+this.source+')')`,
      ) as CachedBodiesCreator;
    }

    const source = String(body);

    let bodyWithScope = this.bodiesCache[source];

    if (bodyWithScope === undefined) {
      try {
        bodyWithScope = this.cachedBodiesCreator.call({scope: this.scope, source}) as Function;
      } catch {
        if (source.includes('[native code]') && source.startsWith('function ')) {
          bodyWithScope = body;
        } else {
          const objectWithBody = this.cachedBodiesCreator.call({
            scope: this.scope,
            source: '{' + source + '}',
          }) as Readonly<Record<string, Function>>;

          for (const key in objectWithBody) {
            bodyWithScope = objectWithBody[key];

            break;
          }
        }
      }

      if (typeof bodyWithScope !== 'function') {
        throw new Error(`Cannot parse body of test from source: ${source}`);
      }

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

      if (
        result != null &&
        (typeof result === 'object' || typeof result === 'function') &&
        'next' in result &&
        typeof result.next === 'function'
      ) {
        result = result.next();
      }
    } catch (catchedError) {
      error = catchedError;
      hasError = true;
    }

    if (!this.isThenable(result)) {
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
