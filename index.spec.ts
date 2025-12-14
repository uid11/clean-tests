import {assertValueIsTrue, Suite} from './index.js';

import type {BaseTest, Options, Payload, RunResult, Task, TestUnit} from './index';

declare const process: {env: {_START: string}};

const startTestsTime = Date.now();

const ok = (message: string): void => console.log(`\x1B[32m[OK]\x1B[39m ${message}`);

ok(`Prettifying and build passed in ${startTestsTime - Number(process.env._START)}ms!`);

let unknownValue: unknown = true;

assertValueIsTrue(unknownValue);

unknownValue satisfies true;
unknownValue = true;

// @ts-expect-error: `unknownValue` now has type `unknown`
unknownValue satisfies true;

assertValueIsTrue(unknownValue, 'some message');

unknownValue satisfies true;
unknownValue = true;

assertValueIsTrue(unknownValue, 'some message', {foo: 'bar'});

unknownValue satisfies true;
unknownValue = true;

assertValueIsTrue(unknownValue, {foo: 3});

unknownValue satisfies true;

try {
  assertValueIsTrue(1, 'foobar', {qux: 'quux'});

  throw 'unreachable';
} catch (error) {
  if (
    !(error instanceof Error) ||
    !error.message.includes('is not true') ||
    !error.message.includes('foobar') ||
    !error.message.includes('"qux"') ||
    !error.message.includes('"quux"')
  ) {
    throw new Error('assertValueIsTrue does not works correctly');
  }
}

const currentAssertCount = assertValueIsTrue.assertCount;

type ExtendedAssertValueIsTrue = typeof assertValueIsTrue & {
  calls?: (readonly [value: unknown, message: string | undefined, payload: Payload | undefined])[];
};

assertValueIsTrue.onPass = function (this: ExtendedAssertValueIsTrue, value, message, payload) {
  if (this.calls === undefined) {
    this.calls = [];
  }

  this.calls.push([value, message, payload]);
};

const originalOnFailure = assertValueIsTrue.onFailure;

assertValueIsTrue.onFailure = function (this: ExtendedAssertValueIsTrue, value, message, payload) {
  if (this.calls === undefined) {
    this.calls = [];
  }

  this.calls.push([value, message, payload]);

  originalOnFailure?.call(assertValueIsTrue, value, message, payload);
};

assertValueIsTrue(assertValueIsTrue.assertCount === currentAssertCount, 'foo');

try {
  assertValueIsTrue({}, 'bar', {
    error: new Error('some error'),
    foo: 0,
    someFunction() {
      'from function body';
    },
  });

  throw 'unreachable';
} catch (error) {
  assertValueIsTrue(
    error instanceof Error &&
      error.message.includes('is not true') &&
      error.message.includes('some error') &&
      error.message.includes('"foo"') &&
      error.message.includes('"someFunction"') &&
      error.message.includes('from function body') &&
      error.message.includes('bar'),
    {baz: 3},
  );
}

assertValueIsTrue(
  'calls' in assertValueIsTrue &&
    JSON.stringify(assertValueIsTrue.calls) ===
      JSON.stringify([
        [true, 'foo', undefined],
        [{}, 'bar', {error: {}, foo: 0}],
        [true, undefined, {baz: 3}],
      ]),
  'events on assertValueIsTrue are correctly overridden',
);

assertValueIsTrue(
  assertValueIsTrue.assertCount === currentAssertCount + 4,
  'assertCount works correctly',
);

assertValueIsTrue.onPass = undefined;
assertValueIsTrue.onFailure = undefined;

assertValueIsTrue(1);

assertValueIsTrue.onFailure = originalOnFailure;

if ('calls' in assertValueIsTrue) {
  delete assertValueIsTrue.calls;
}

const suiteWithOnlyName = 'Suite with only test';
const suiteWithOnly = new Suite(suiteWithOnlyName);

const getTestData = (): {foo: string} => {
  return {foo: ''};
};

suiteWithOnly.addFunctionToScope(getTestData);

suiteWithOnly.addTest('some test', () => {});

suiteWithOnly.addTest('other test', {skip: 'reason ...'}, async () => {});

suiteWithOnly.addTest('third test', {only: true}, () => {
  const testData = getTestData();

  assertValueIsTrue(testData.foo === '', 'testData is correct');
});

suiteWithOnly.addFunctionToScope(assertValueIsTrue);
suiteWithOnly.addFunctionToScope(assertValueIsTrue);

suiteWithOnly.addTest('test with timeout', {timeout: 500}, () => {});

suiteWithOnly.addTest({only: true}, () => {});

suiteWithOnly.addTest(
  'test with parameters',
  {parameters: ['foo', 34]},
  (text, counter: number) => {
    assertValueIsTrue(text === 'foo', 'string parameter is correct');
    // @ts-expect-error: `text` now has type `'foo'`
    assertValueIsTrue(text === 'bar', 'second string parameter is correct');
    assertValueIsTrue(counter === 35, 'number parameter is correct');
  },
);

const onlyResult = await suiteWithOnly.run({filterTests: () => false, testTimeout: 3_000});

assertValueIsTrue(onlyResult.failed === 0, 'failed counter is correct');
assertValueIsTrue(onlyResult.hasNoBody === 0, 'hasNoBody counter is correct');
assertValueIsTrue(onlyResult.interrupted === 0, 'interrupted counter is correct');
assertValueIsTrue(onlyResult.passed === 2, 'passed counter is correct');
assertValueIsTrue(onlyResult.skipped === 0, 'skipped counter is correct');
assertValueIsTrue(onlyResult.timedOut === 0, 'timedOut counter is correct');
assertValueIsTrue(onlyResult.wasNotRunInTime === 0, 'wasNotRunInTime counter is correct');

assertValueIsTrue(onlyResult.filterTestsErrors.length === 0, 'no filterTestsErrors');
assertValueIsTrue(onlyResult.onSuiteEndErrors.length === 0, 'no onSuiteEndErrors');
assertValueIsTrue(onlyResult.onSuiteStartErrors.length === 0, 'no onSuiteStartErrors');
assertValueIsTrue(onlyResult.onTestEndErrors.length === 0, 'no onTestEndErrors');
assertValueIsTrue(onlyResult.onTestStartErrors.length === 0, 'no onTestStartErrors');

assertValueIsTrue(onlyResult.duration > 0 && onlyResult.duration < 20, 'duration is correct');
assertValueIsTrue(onlyResult.name === suiteWithOnlyName, 'suite name is correct');
assertValueIsTrue(
  onlyResult.tapOutput === `1..2 # ${suiteWithOnlyName} (passed: 2)\n`,
  'TAP output is correct',
);
assertValueIsTrue(onlyResult.runStatus === 'passed', 'run status is correct');
assertValueIsTrue(
  onlyResult.startTime.valueOf() > Date.now() - onlyResult.duration - 5 &&
    onlyResult.startTime.valueOf() + onlyResult.duration < Date.now() + 1,
  'startTime is correct',
);
assertValueIsTrue(onlyResult.testsInRun === 2, 'testsInRun counter is correct');
assertValueIsTrue(onlyResult.testsInSuite === 6, 'testsInSuite counter is correct');

const suite = new Suite();

suite.addFunctionToScope(assertValueIsTrue);

let testsCounter = 0;

const increaseTestsCounter = (): void => {
  testsCounter += 1;
};

let lastCallTime: number = 0;

const assertTestsCounter = (counter: number, atLeastMustPass?: number): void => {
  const now = Date.now();
  const hasPassedFromLastCall = now - lastCallTime;

  lastCallTime = now;

  increaseTestsCounter();

  assertValueIsTrue(counter === testsCounter, `testsCounter is correct for test ${counter}`);

  if (atLeastMustPass !== undefined) {
    assertValueIsTrue(
      hasPassedFromLastCall >= atLeastMustPass,
      `at least ${atLeastMustPass}ms must pass`,
    );
  }
};

suite.addFunctionToScope(assertTestsCounter);
suite.addFunctionToScope(increaseTestsCounter);

suite.addTest({parameters: ['foo', 12]}, (key, counter) => {
  assertValueIsTrue(key === 'foo' && counter === 12, 'parameters are correct');

  assertTestsCounter(1);
});

suite.addTest(() => {
  assertTestsCounter(2);
});

suite.addTest({skip: 'some skip reason'}, () => {
  assertTestsCounter(8);
});

suite.addTest({skip: true}, () => {
  assertTestsCounter(9);
});

suite.addTest({fail: true, retries: 5}, () => {
  suite.addTest(() => {
    assertTestsCounter(9);
  });
});

suite.addTest(() => {
  suite.addTest(() => {
    assertTestsCounter(10);
  });
});

suite.addTest({todo: true}, () => {
  assertTestsCounter(3);
});

suite.addTest({repeats: 3}, () => {
  increaseTestsCounter();
});

suite.addTest({name: 'with \\error #', retries: 4}, async function* generator() {
  throw new Error('foo');
});

suite.addTest({repeats: 4, retries: 2}, () => {
  throw new Error('bar');
});

const runResult = await suite.run();

assertValueIsTrue(runResult.runStatus === 'failed', 'suite run is failed');

assertValueIsTrue(runResult.failed === 1 + 5 + 4 * 3, 'tests fail when they should');
assertValueIsTrue(runResult.passed === 4 + 3, 'number of passed tests is correct');
assertValueIsTrue(runResult.skipped === 2, 'number of skipped tests is correct');

assertValueIsTrue(testsCounter === 6, 'repeats works correctly');

testsCounter = 0;

const repeatOfResult = await suite.run();

for (const key of Object.keys(runResult) as (keyof typeof runResult)[]) {
  if (
    key !== 'duration' &&
    (typeof runResult[key] === 'number' || typeof runResult[key] === 'string')
  ) {
    assertValueIsTrue(
      runResult[key] === repeatOfResult[key],
      `${key} is the same with repeating the run`,
    );
  }
}

const suiteWithTodo = new Suite();

suiteWithTodo.addTest(() => {
  assertTestsCounter(1);
});

suiteWithTodo.addTest({todo: 'some reason'}, async () => {
  assertTestsCounter(2);

  throw new Error('baz');
});

suiteWithTodo.addTest('some name', () => {
  assertTestsCounter(3);
});

suiteWithTodo.addTest({}, () => {
  assertTestsCounter(3);
});

suiteWithTodo.addFunctionToScope(assertTestsCounter);

testsCounter = 0;

const todoResult = await suiteWithTodo.run({
  filterTests: (_options, {name}) => name === 'anonymous',
});

assertValueIsTrue(
  todoResult.runStatus === 'passed',
  'todo test runs but does not affect the run status of suite',
);
assertValueIsTrue(
  todoResult.passed === 2 && todoResult.testsInRun === 3 && todoResult.testsInSuite === 4,
  'filterTests works correctly',
);

const suiteWithMaxFailures = new Suite({maxFailures: 3, retries: 5});

suiteWithMaxFailures.addTest(function* constructor() {
  throw new Error('foo');
});

const maxFailuresResult = await suiteWithMaxFailures.run();

assertValueIsTrue(
  maxFailuresResult.runStatus === 'interruptedByMaxFailures' &&
    maxFailuresResult.tapOutput.includes('Bail out!') &&
    maxFailuresResult.tapOutput.includes('interrupted by MaxFailures'),
  'run has expected status for interruption by maxFailures',
  {maxFailuresResult},
);

assertValueIsTrue(
  maxFailuresResult.failed === 3 &&
    maxFailuresResult.testsInRun === 4 &&
    maxFailuresResult.testsInSuite === 1 &&
    maxFailuresResult.wasNotRunInTime === 1,
  'maxFailures interruption works correctly',
  {maxFailuresResult},
);

const asyncSuite = new Suite();

asyncSuite.addTest(() => {
  assertTestsCounter(1);
});

asyncSuite.addTest(async () => {
  assertTestsCounter(2);
});

asyncSuite.addTest(function* test() {
  assertTestsCounter(3);
});

asyncSuite.addTest(async function* test() {
  assertTestsCounter(4);

  await waitForTimeout(20);
});

asyncSuite.addTest(() => {
  assertTestsCounter(5, 20 - 1);
});

asyncSuite.addTest(() => {
  assertTestsCounter(6);
});

const waitForTimeout = (timeout: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, timeout));

asyncSuite.addFunctionToScope(assertTestsCounter);
asyncSuite.addFunctionToScope(waitForTimeout);

testsCounter = 0;

const asyncSuiteResult = await asyncSuite.run();

assertValueIsTrue(
  asyncSuiteResult.runStatus === 'passed' &&
    asyncSuiteResult.passed === 6 &&
    asyncSuiteResult.testsInRun === 6,
  'asynchronous tests works correctly',
  {asyncSuiteResult},
);

testsCounter = 0;

const asyncSuiteResultWithTimeout = await asyncSuite.run({testTimeout: 10});

assertValueIsTrue(
  asyncSuiteResultWithTimeout.runStatus === 'failed' &&
    asyncSuiteResultWithTimeout.failed === 1 &&
    asyncSuiteResultWithTimeout.passed === 4 &&
    asyncSuiteResultWithTimeout.timedOut === 1,
  'testTimeout works correctly',
  {asyncSuiteResultWithTimeout},
);

const asyncSuiteResultWithRunTimeout = await asyncSuite.run({
  onSuiteStart: () => {
    testsCounter = 0;
  },
  runTimeout: 10,
});

assertValueIsTrue(
  asyncSuiteResultWithRunTimeout.runStatus === 'interruptedByTimeout' &&
    asyncSuiteResultWithRunTimeout.tapOutput.includes('Bail out!') &&
    asyncSuiteResultWithRunTimeout.tapOutput.includes('interrupted by Timeout') &&
    asyncSuiteResultWithRunTimeout.duration < 10 + 2 &&
    asyncSuiteResultWithRunTimeout.failed === 0 &&
    asyncSuiteResultWithRunTimeout.interrupted === 1 &&
    asyncSuiteResultWithRunTimeout.passed === 3 &&
    asyncSuiteResultWithRunTimeout.timedOut === 0 &&
    asyncSuiteResultWithRunTimeout.wasNotRunInTime === 2,
  'runTimeout works correctly',
  {asyncSuiteResultWithRunTimeout},
);

testsCounter = 0;

const controller = new AbortController();

setTimeout(() => {
  controller.abort();
}, 10);

const asyncSuiteResultWithSignal = await asyncSuite.run({signal: controller.signal});

assertValueIsTrue(
  asyncSuiteResultWithSignal.runStatus === 'interruptedBySignal' &&
    asyncSuiteResultWithSignal.tapOutput.includes('Bail out!') &&
    asyncSuiteResultWithSignal.tapOutput.includes('interrupted by Signal') &&
    asyncSuiteResultWithSignal.duration < 10 + 2 &&
    asyncSuiteResultWithSignal.failed === 0 &&
    asyncSuiteResultWithSignal.interrupted === 1 &&
    asyncSuiteResultWithSignal.passed === 3 &&
    asyncSuiteResultWithSignal.timedOut === 0 &&
    asyncSuiteResultWithSignal.wasNotRunInTime === 2,
  'interruption by signal works correctly',
  {asyncSuiteResultWithSignal},
);

try {
  asyncSuite.addFunctionToScope(function assertTestsCounter() {});

  throw 'unreachable';
} catch (error) {
  assertValueIsTrue(
    error instanceof Error &&
      error.message.includes('assertTestsCounter') &&
      error.message.includes('already exists'),
    'addFunctionToScope(...) checks changes in scope',
  );
}

try {
  asyncSuite.addFunctionToScope(() => {}, '1234');

  throw 'unreachable';
} catch (error) {
  assertValueIsTrue(
    error instanceof Error &&
      error.message.includes('1234') &&
      error.message.includes('is not a valid identifier'),
    'addFunctionToScope(...) checks function names',
    {error},
  );
}

let currentlyRunningTestsCounter = 0;

const assertConcurrency = (concurrency: number): void => {
  assertValueIsTrue(
    concurrency === currentlyRunningTestsCounter,
    `current concurrency (${currentlyRunningTestsCounter}) is correct`,
  );
};

let bodiesCache: Suite['bodiesCache'] | undefined;
let cachedBodiesCreator: Suite['cachedBodiesCreator'];

const currentTests: number[] = [];
const messages: string[] = [];

const suiteWithConcurrency = new Suite({
  concurrency: 3,
  now: Date.now,
  onSuiteStart() {
    testsCounter = 0;
  },
  onTestEnd(...args) {
    currentlyRunningTestsCounter -= 1;

    const [, event] = args;
    const {
      test: {parameters},
    } = event;

    if (typeof parameters[2] === 'number') {
      const newCurrentTests = currentTests.filter((counter) => counter !== parameters[2]);

      currentTests.length = 0;
      currentTests.push(...newCurrentTests);
    }

    assertValueIsTrue(event.tapOutput.includes('---'), 'TAP output includes YAML by default');

    Object.assign<typeof event, Partial<typeof event>>(event, {
      tapOutput: `${event.tapOutput.trim()} # ${event.result.duration}ms\n`,
    });

    Suite.prototype.onTestEnd.call(this, ...args);

    if (bodiesCache === undefined) {
      bodiesCache = this.bodiesCache;
    }

    if (cachedBodiesCreator === undefined) {
      cachedBodiesCreator = this.cachedBodiesCreator;
    }

    assertValueIsTrue(bodiesCache === this.bodiesCache, 'bodiesCache is cached');
    assertValueIsTrue(
      cachedBodiesCreator === this.cachedBodiesCreator,
      'cachedBodiesCreator is cached',
    );
  },
  onTestStart(_options, {test: {parameters}}) {
    if (typeof parameters[2] === 'number') {
      currentTests.push(parameters[2]);
    }

    currentlyRunningTestsCounter += 1;

    suiteWithConcurrency.addFunctionToScope(assertConcurrency, 'assertConcurrency');
    suiteWithConcurrency.addFunctionToScope(assertTestsCounter);
  },
  print(message) {
    messages.push(message);
  },
});

suiteWithConcurrency.addTest(async function () {
  assertConcurrency(1);
  assertTestsCounter(1);

  await waitForTimeout(20);

  assertConcurrency(3);
});

suiteWithConcurrency.addTest(async () => {
  assertConcurrency(2);
  assertTestsCounter(2);

  await waitForTimeout(20);

  assertConcurrency(3);
});

const assertCurrentTests = (tests: readonly number[]) => {
  assertValueIsTrue(String(currentTests) === String(tests), `current running tests are ${tests}`);
};

const concurrencyTest = async (
  concurrency: number,
  concurrencyAtTheEnd = concurrency,
  counter = concurrency,
  timeout = 20,
  tests?: readonly number[],
) => {
  assertConcurrency(concurrency);
  assertTestsCounter(counter);

  if (tests !== undefined) {
    assertCurrentTests(tests);
  }

  await waitForTimeout(timeout);

  assertConcurrency(concurrencyAtTheEnd);
};

suiteWithConcurrency.addTest({parameters: [3]}, concurrencyTest);
suiteWithConcurrency.addTest({parameters: [3, 1, 4, 10]}, concurrencyTest);
suiteWithConcurrency.addTest({body: concurrencyTest, parameters: [3, 2, 5, 5]});

suiteWithConcurrency.addFunctionToScope(waitForTimeout);

const suiteWithConcurrencyResult = await suiteWithConcurrency.run();

assertValueIsTrue(
  suiteWithConcurrencyResult.runStatus === 'passed' &&
    suiteWithConcurrencyResult.passed === 5 &&
    suiteWithConcurrencyResult.testsInRun === 5 &&
    suiteWithConcurrencyResult.duration >= 28 &&
    suiteWithConcurrencyResult.duration <= 35,
  `concurrency works correctly (duration is ${suiteWithConcurrencyResult.duration})`,
);

console.log(messages.join(''));

suiteWithConcurrency.addTest('test', {parameters: [1, 3, 1, 20, [1]]}, concurrencyTest);
suiteWithConcurrency.addTest('test', {parameters: [2, 3, 2, 15, [1, 2]]}, concurrencyTest);
suiteWithConcurrency.addTest('test', {parameters: [3, 3, 3, 10, [1, 2, 3]]}, concurrencyTest);
suiteWithConcurrency.addTest('test', {parameters: [3, 3, 4, 5, [1, 2, 4]]}, concurrencyTest);
suiteWithConcurrency.addTest('test', {parameters: [3, 3, 5, 10, [1, 4, 5]]}, concurrencyTest);
suiteWithConcurrency.addTest('test', {parameters: [3, 2, 6, 15, [1, 5, 6]]}, concurrencyTest);
suiteWithConcurrency.addTest('test', {parameters: [3, 1, 7, 20, [5, 6, 7]]}, concurrencyTest);

bodiesCache = undefined;
cachedBodiesCreator = undefined;
currentTests.length = 0;

const anotherConcurrencyResult = await suiteWithConcurrency.run({
  filterTests(_options, {name}) {
    return name !== 'anonymous';
  },
  onSuiteStart(...args) {
    suiteWithConcurrency.onSuiteStart.call(this, ...args);
    suiteWithConcurrency.addFunctionToScope(assertCurrentTests);
    suiteWithConcurrency.addFunctionToScope(assertValueIsTrue);
  },
  print: console.log,
});

assertValueIsTrue(
  anotherConcurrencyResult.runStatus === 'passed' &&
    anotherConcurrencyResult.passed === 7 &&
    anotherConcurrencyResult.testsInRun === 7 &&
    anotherConcurrencyResult.testsInSuite === 12 &&
    anotherConcurrencyResult.duration >= 38 &&
    anotherConcurrencyResult.duration <= 45,
  `concurrency works correctly for tests with different duration (duration is ${anotherConcurrencyResult.duration})`,
  {anotherConcurrencyResult},
);

type Test = BaseTest & {bar: number};
type FooOptions = Options<Test> & {foo?: string; baz?: number};

class FooSuite extends Suite<Test> {
  constructor(options: FooOptions = {}) {
    super(options);
  }

  assertTests(count: number) {
    assertValueIsTrue(count === this.wereRun.length, `were run ${count} tests`);

    for (const {bar} of this.wereRun) {
      assertValueIsTrue(bar !== undefined, 'test property bar is defined');
    }
  }

  declare baz?: number;

  foo = 'qux';

  override onSuiteStart(options: FooOptions) {
    if (options.foo !== undefined) {
      this.print(options.foo);
    }
  }

  override async run(options: FooOptions = {}): Promise<RunResult<Test> & {foo: string}> {
    const {foo = this.foo} = options;
    const result = await super.run({foo, ...options});

    return {foo, ...result};
  }

  protected wereRun: Test[] = [];

  protected override runTestUnit(
    options: FooOptions,
    unit: TestUnit<Test>,
  ): Task<Test> | undefined {
    if (options.foo === undefined) {
      throw new Error('No "foo" option');
    } else {
      this.wereRun.push(unit.test);
    }

    return super.runTestUnit(options, unit);
  }
}

const fooSuite = new FooSuite();

fooSuite.addTest('name', {bar: 1}, function () {});
fooSuite.addTest({bar: 2}, function name() {});
fooSuite.addTest({bar: 3, body: () => {}});

fooSuite.assertTests(0);

const fooResult = await fooSuite.run();

fooSuite.assertTests(3);

assertValueIsTrue(
  fooSuite.foo === 'qux' &&
    fooResult.runStatus === 'passed' &&
    fooResult.testsInRun === 3 &&
    fooResult.foo === 'qux',
  'extended suite works correctly',
  {fooSuite},
);

const anotherFooResult = await fooSuite.run({foo: 'quux'});

fooSuite.assertTests(6);

assertValueIsTrue(
  fooSuite.foo === 'qux' &&
    anotherFooResult.runStatus === 'passed' &&
    anotherFooResult.testsInRun === 3 &&
    anotherFooResult.foo === 'quux',
  'extended suite works correctly with extended options',
  {anotherFooResult},
);

const anotherFooSuite = new FooSuite({baz: 3});

anotherFooSuite.addTest(() => {});

assertValueIsTrue(
  anotherFooSuite.baz === 3 && anotherFooSuite.foo === 'qux' && anotherFooSuite.tests.length === 1,
  'extended constructor works correctly',
  {anotherFooSuite},
);

const onelineResult = await anotherFooSuite.run({
  onelineTapOutput: true,
  onTestEnd(options, event) {
    assertValueIsTrue(
      !event.tapOutput.includes('---'),
      'TAP output does not includes YAML with onelineTapOutput: true',
    );

    Suite.prototype.onTestEnd.call(this, options, event);
  },
});

assertValueIsTrue(
  onelineResult.runStatus === 'passed' && onelineResult.passed === 1,
  'test was passed with onelineTapOutput: true',
);

const runWithoutTests = await anotherFooSuite.run({filterTests: () => false});

assertValueIsTrue(
  runWithoutTests.runStatus === 'passed' &&
    runWithoutTests.tapOutput === '1..0 # anonymous (no tests were run)\n' &&
    runWithoutTests.foo === 'qux' &&
    runWithoutTests.testsInRun === 0 &&
    runWithoutTests.testsInSuite === 1,
  'run without tests is passed',
  {runWithoutTests},
);

const suiteWithRepeatsAndAsync = new Suite({repeats: 2, retries: 3, testTimeout: 10});

suiteWithRepeatsAndAsync.addFunctionToScope(waitForTimeout);

suiteWithRepeatsAndAsync.addTest('first', async () => {
  await waitForTimeout(11);
});

suiteWithRepeatsAndAsync.addTest('second', async () => {
  await waitForTimeout(12);
});

suiteWithRepeatsAndAsync.addTest({repeats: 0}, function () {
  throw new Error('foo');
});

suiteWithRepeatsAndAsync.addTest({repeats: 3});

suiteWithRepeatsAndAsync.addTest({body: () => {}, repeats: 1});

let firstRepeatIndex = 1;
let firstRetryIndex = 0;
let secondRepeatIndex = 1;
let secondRetryIndex = 0;

let repeatsAndAsyncState: 'initial' | 'beforeSync' | 'sync' | 'afterSync' = 'initial';

const repeatsAndAsyncResult = await suiteWithRepeatsAndAsync.run({
  concurrency: 3,
  onTestEnd(_options, event) {
    this.print(event.tapOutput);

    if (event.test.name === 'first') {
      if (repeatsAndAsyncState === 'initial') {
        repeatsAndAsyncState = 'beforeSync';
      }

      assertValueIsTrue(
        repeatsAndAsyncState === 'beforeSync' &&
          event.repeatIndex === firstRepeatIndex &&
          event.retryIndex === firstRetryIndex &&
          event.result.status === 'timedOut' &&
          event.result.duration >= this.testTimeout - 3,
        `repeatIndex (${firstRepeatIndex}) and retryIndex (${firstRetryIndex}) are correct`,
        {event},
      );

      firstRepeatIndex += 1;

      if (firstRepeatIndex > this.repeats) {
        firstRepeatIndex = 1;
        firstRetryIndex += 1;
      }
    } else if (event.test.name === 'second') {
      if (repeatsAndAsyncState === 'sync') {
        repeatsAndAsyncState = 'afterSync';
      }

      assertValueIsTrue(
        (repeatsAndAsyncState === 'beforeSync' || repeatsAndAsyncState === 'afterSync') &&
          event.repeatIndex === secondRepeatIndex &&
          event.retryIndex === secondRetryIndex &&
          event.result.status === 'timedOut' &&
          event.result.duration >= this.testTimeout - 3,
        `repeatIndex (${secondRepeatIndex}) and retryIndex (${secondRetryIndex}) are correct`,
        {event},
      );

      secondRetryIndex += 1;

      if (secondRetryIndex > this.retries) {
        secondRetryIndex = 0;
        secondRepeatIndex += 1;
      }
    } else {
      if (repeatsAndAsyncState === 'beforeSync') {
        repeatsAndAsyncState = 'sync';
      }

      assertValueIsTrue(repeatsAndAsyncState === 'sync', 'tests sequence is correct');
    }
  },
  onSuiteEnd() {
    assertValueIsTrue(repeatsAndAsyncState === 'afterSync', 'tests ends in correct order');
  },
});

assertValueIsTrue(
  repeatsAndAsyncResult.hasNoBody === 3 &&
    repeatsAndAsyncResult.passed === 1 &&
    repeatsAndAsyncResult.timedOut ===
      2 * (suiteWithRepeatsAndAsync.repeats * (suiteWithRepeatsAndAsync.retries + 1)) &&
    repeatsAndAsyncResult.testsInRun === 20 &&
    repeatsAndAsyncResult.onTestEndErrors.length === 0 &&
    repeatsAndAsyncResult.onSuiteEndErrors.length === 0,
  'repeats and retries works correctly with concurrency and asynchronous tests',
  {repeatsAndAsyncResult},
);

const suiteWithLongTermSyncPart = new Suite({
  filterTests: (_options, {fail}) => !fail,
  testTimeout: 10,
});

suiteWithLongTermSyncPart.addFunctionToScope(waitForTimeout);

suiteWithLongTermSyncPart.addTest(async () => {
  var stop = Date.now() + 10;

  while (Date.now() < stop) {}

  await waitForTimeout(10);
});

suiteWithLongTermSyncPart.addTest('failed test', {fail: true});
suiteWithLongTermSyncPart.addTest({fail: true}, () => {});
suiteWithLongTermSyncPart.addTest({fail: true, skip: true}, () => {});
suiteWithLongTermSyncPart.addTest({fail: true, todo: true}, () => {});

const longTermSyncPartResult = await suiteWithLongTermSyncPart.run();

assertValueIsTrue(
  longTermSyncPartResult.runStatus === 'failed' &&
    longTermSyncPartResult.duration > 8 &&
    longTermSyncPartResult.duration < 12 &&
    longTermSyncPartResult.hasNoBody === 0 &&
    longTermSyncPartResult.skipped === 0 &&
    longTermSyncPartResult.timedOut === 1 &&
    longTermSyncPartResult.testsInRun === 1 &&
    longTermSyncPartResult.testsInSuite === 5,
  'tests with long-term synchronous part interrupts correctly',
  {longTermSyncPartResult},
);

const successfulLongTermSyncPartResult = await suiteWithLongTermSyncPart.run({testTimeout: 22});

assertValueIsTrue(
  successfulLongTermSyncPartResult.runStatus === 'passed' &&
    successfulLongTermSyncPartResult.duration > 18 &&
    successfulLongTermSyncPartResult.duration < 22 &&
    successfulLongTermSyncPartResult.hasNoBody === 0 &&
    successfulLongTermSyncPartResult.passed === 1 &&
    successfulLongTermSyncPartResult.skipped === 0 &&
    successfulLongTermSyncPartResult.testsInRun === 1 &&
    successfulLongTermSyncPartResult.testsInSuite === 5,
  'tests with long-term synchronous part works correctly',
  {successfulLongTermSyncPartResult},
);

const failedTestsResult = await suiteWithLongTermSyncPart.run({
  filterTests: (_options, {fail}) => fail,
});

assertValueIsTrue(
  failedTestsResult.runStatus === 'failed' &&
    failedTestsResult.duration < 2 &&
    failedTestsResult.failed === 2 &&
    failedTestsResult.hasNoBody === 1 &&
    failedTestsResult.passed === 0 &&
    failedTestsResult.skipped === 1 &&
    failedTestsResult.testsInRun === 4 &&
    failedTestsResult.testsInSuite === 5,
  'fail option works correctly for tests',
  {failedTestsResult},
);

const suiteWithErrors = new Suite({
  filterTests(_options, test) {
    if (test.name === 'anonymous') {
      throw new Error('foobar');
    }

    return true;
  },
  onSuiteEnd() {
    throw new Error('foobar');
  },
  onSuiteStart() {
    throw new Error('foobar');
  },
  onTestEnd() {
    throw new Error('foobar');
  },
  onTestStart() {
    throw new Error('foobar');
  },
});

suiteWithErrors.addTest({repeats: 5}, () => {
  throw new Error('foo');
});

suiteWithErrors.addTest('foo', () => {});

suiteWithErrors.addTest({}, () => {
  throw new Error('foo');
});

suiteWithErrors.addTest('bar', () => {});

suiteWithErrors.addTest(() => {
  throw new Error('foo');
});

const errorsResult = await suiteWithErrors.run();

assertValueIsTrue(
  errorsResult.runStatus === 'passed' &&
    errorsResult.failed === 0 &&
    errorsResult.filterTestsErrors.length === 3 &&
    errorsResult.onSuiteEndErrors.length === 1 &&
    errorsResult.onSuiteStartErrors.length === 1 &&
    errorsResult.onTestEndErrors.length === 2 &&
    errorsResult.onTestStartErrors.length === 2 &&
    errorsResult.passed === 2 &&
    errorsResult.testsInRun === 2 &&
    errorsResult.testsInSuite === 5,
  'errors in all functions processes correctly',
  {errorsResult},
);

const errors: unknown[] = [
  ...errorsResult.filterTestsErrors.map(({error}) => error),
  ...errorsResult.onSuiteEndErrors,
  ...errorsResult.onSuiteStartErrors,
  ...errorsResult.onTestEndErrors.map(({error}) => error),
  ...errorsResult.onTestStartErrors.map(({error}) => error),
];

for (const error of errors) {
  assertValueIsTrue(
    error instanceof Error && error.message === 'foobar',
    'collects errors correctly',
    {error},
  );
}

const suiteWithSkippedTests = new Suite();

suiteWithSkippedTests.addTest({skip: true});
suiteWithSkippedTests.addTest({fail: true, skip: ''}, () => {});
suiteWithSkippedTests.addTest({fail: true, skip: '', todo: ''}, () => {});
suiteWithSkippedTests.addTest({fail: true, skip: '', todo: true});
suiteWithSkippedTests.addTest({skip: '', todo: true}, () => {});
suiteWithSkippedTests.addTest({skip: '', todo: true});

const skippedTestsResult = await suiteWithSkippedTests.run();

assertValueIsTrue(
  skippedTestsResult.runStatus === 'passed' &&
    skippedTestsResult.skipped === 6 &&
    skippedTestsResult.testsInRun === 6 &&
    skippedTestsResult.testsInSuite === 6,
  'skip option takes precedence over all other test options except the only option',
  {skippedTestsResult},
);

const skippedTestsWithFilterResult = await suiteWithSkippedTests.run({
  filterTests(_options, {skip}) {
    return skip === false;
  },
});

assertValueIsTrue(
  skippedTestsWithFilterResult.runStatus === 'passed' &&
    skippedTestsWithFilterResult.skipped === 0 &&
    skippedTestsWithFilterResult.testsInRun === 0 &&
    skippedTestsWithFilterResult.testsInSuite === 6,
  'filtering takes priority over test skipping',
  {skippedTestsWithFilterResult},
);

suiteWithSkippedTests.addTest({only: true, skip: true});
suiteWithSkippedTests.addTest({body() {}, only: true, skip: true});
suiteWithSkippedTests.addTest({
  async *body() {
    throw new Error('foo');
  },
  fail: true,
  only: true,
});
suiteWithSkippedTests.addTest({
  *body() {
    throw new Error('foo');
  },
  fail: true,
  only: true,
  skip: true,
});

const onlySkippedTestsResult = await suiteWithSkippedTests.run({filterTests: () => false});

assertValueIsTrue(
  onlySkippedTestsResult.runStatus === 'passed' &&
    onlySkippedTestsResult.failed === 0 &&
    onlySkippedTestsResult.hasNoBody === 1 &&
    onlySkippedTestsResult.passed === 3 &&
    onlySkippedTestsResult.skipped === 0 &&
    onlySkippedTestsResult.testsInRun === 4 &&
    onlySkippedTestsResult.testsInSuite === 10,
  'only option takes precedence over skip and filtering',
  {onlySkippedTestsResult},
);

const suiteWithTodoTests = new Suite();

suiteWithTodoTests.addTest({todo: true});
suiteWithTodoTests.addTest({skip: true, todo: ''});
suiteWithTodoTests.addTest({skip: true, todo: ''});
suiteWithTodoTests.addTest({fail: true, skip: '', todo: true});
suiteWithTodoTests.addTest('name', {fail: true, todo: true});
suiteWithTodoTests.addTest({todo: true}, () => {
  throw new Error('baz');
});
suiteWithTodoTests.addTest({body: () => {}, skip: true, todo: ''});
suiteWithTodoTests.addTest({
  async *body() {
    throw new Error('bar');
  },
  name: 'some name',
  skip: true,
  todo: '',
});
suiteWithTodoTests.addTest({fail: true, skip: '', todo: true}, () => {});
suiteWithTodoTests.addTest({
  *body() {
    throw new Error('foo');
  },
  fail: true,
  todo: '',
});

// @ts-expect-error: expected at least one argument
suiteWithTodoTests.addTest();

const todoTestsResult = await suiteWithTodoTests.run();

assertValueIsTrue(
  todoTestsResult.runStatus === 'passed' &&
    todoTestsResult.failed === 1 &&
    todoTestsResult.hasNoBody === 3 &&
    todoTestsResult.passed === 1 &&
    todoTestsResult.testsInRun === 11 &&
    todoTestsResult.testsInSuite === 11,
  'todo option does not affect other test options',
  {todoTestsResult},
);

suiteWithTodoTests.addTest({only: true, todo: ''});
suiteWithTodoTests.addTest({
  *body() {
    throw new Error('foo');
  },
  only: true,
  todo: '',
});
suiteWithTodoTests.addTest({fail: true, only: true, todo: ''}, async function* () {});
suiteWithTodoTests.addTest({fail: true, only: true, todo: true});
suiteWithTodoTests.addTest({only: true, todo: true}, Object);

const onlyTodoTestsResult = await suiteWithTodoTests.run({filterTests: () => false});

assertValueIsTrue(
  onlyTodoTestsResult.runStatus === 'passed' &&
    onlyTodoTestsResult.failed === 2 &&
    onlyTodoTestsResult.hasNoBody === 2 &&
    onlyTodoTestsResult.passed === 1 &&
    onlyTodoTestsResult.testsInRun === 5 &&
    onlyTodoTestsResult.testsInSuite === 16,
  'only option takes precedence over all other options and filtering',
  {onlyTodoTestsResult},
);

const syncSuite = new Suite({
  onSuiteEnd() {
    assertTestsCounter(5);
  },
  onSuiteStart() {
    assertTestsCounter(1);
  },
});

syncSuite.addFunctionToScope(assertTestsCounter);

syncSuite.addTest(() => {
  assertTestsCounter(2);
});

syncSuite.addTest(() => {
  assertTestsCounter(3);
});

syncSuite.addTest(() => {
  assertTestsCounter(4);
});

testsCounter = 0;

const syncSuitePromise = syncSuite.run();

assertTestsCounter(6);

const syncSuiteResult = await syncSuitePromise;

assertTestsCounter(7);

assertValueIsTrue(
  syncSuiteResult.runStatus === 'passed' &&
    syncSuiteResult.failed === 0 &&
    syncSuiteResult.hasNoBody === 0 &&
    syncSuiteResult.passed === 3 &&
    syncSuiteResult.testsInRun === 3 &&
    syncSuiteResult.testsInSuite === 3,
  'synchronous test suite is executed entirely within the current microtask',
  {syncSuiteResult},
);

syncSuite.addTest(async () => {
  assertTestsCounter(5);
});

syncSuite.addTest(() => {
  assertTestsCounter(7);
});

testsCounter = 0;

const syncSuiteWithAsyncPromise = syncSuite.run({
  onSuiteEnd() {
    assertTestsCounter(8);
  },
});

assertTestsCounter(6);

const syncSuiteWithAsyncResult = await syncSuiteWithAsyncPromise;

assertTestsCounter(9);

assertValueIsTrue(
  syncSuiteWithAsyncResult.runStatus === 'passed' &&
    syncSuiteWithAsyncResult.failed === 0 &&
    syncSuiteWithAsyncResult.hasNoBody === 0 &&
    syncSuiteWithAsyncResult.passed === 5 &&
    syncSuiteWithAsyncResult.testsInRun === 5 &&
    syncSuiteWithAsyncResult.testsInSuite === 5,
  'asynchronous tests are executed within the next microtask',
  {syncSuiteWithAsyncResult},
);

const suiteForAddTest = new Suite();

suiteForAddTest.addFunctionToScope(assertTestsCounter);

suiteForAddTest.addTest('The test only with the name');

suiteForAddTest.addTest('The test with the body', () => {
  assertTestsCounter(1);
});

suiteForAddTest.addTest('The test with the body in options', {
  body: async function () {
    assertTestsCounter(2);
  },
});

const higherPriorityName = 'Higher priority name';

suiteForAddTest.addTest('The test with both names', {
  body: async function* (_name) {
    assertTestsCounter(3);
  },
  name: higherPriorityName,
  parameters: ['checkName'],
});

suiteForAddTest.addTest(
  'The body from the test options has higher priority',
  {
    body: function* () {
      assertTestsCounter(4);
    },
  },
  () => {
    throw new Error('foo');
  },
);

testsCounter = 0;

const suiteForAddTestResult = await suiteForAddTest.run({
  onTestStart(_options, {test}) {
    if (test.parameters[0] === 'checkName') {
      assertValueIsTrue(
        test.name === higherPriorityName,
        'The name from the test options has higher priority',
        {test},
      );
    } else {
      assertValueIsTrue(test.parameters.length === 0, 'Test parameters are correct', {test});
    }
  },
});

assertValueIsTrue(
  suiteForAddTestResult.runStatus === 'passed' &&
    suiteForAddTestResult.failed === 0 &&
    suiteForAddTestResult.hasNoBody === 1 &&
    suiteForAddTestResult.onTestStartErrors.length === 0 &&
    suiteForAddTestResult.passed === 4 &&
    suiteForAddTestResult.testsInRun === 5 &&
    suiteForAddTestResult.testsInSuite === 5,
  'addTest(...) works correctly with any valid set of arguments',
  {suiteForAddTestResult},
);

ok(`All ${assertValueIsTrue.assertCount} tests passed in ${Date.now() - startTestsTime}ms!`);
