import {Suite} from './index.js';

import type {BaseTest, Options, RunResult, Task, TestUnit} from './index';

declare const process: {env: {_START: string}};

const startTestsTime = Date.now();

let totalAssertsCounter = 0;

/**
 * Asserts that the value is `true` (strictly equal to `true`).
 */
function assertValueIsTrue<Type>(value: Type | true, check: string): asserts value is true {
  if (value !== true) {
    throw new Error(`Asserted value is not true: ${check}`);
  }

  totalAssertsCounter += 1;

  console.log(' ✅', check);
}

const ok = (message: string): void => console.log(`\x1B[32m[OK]\x1B[39m ${message}`);

ok(`Prettifying and build passed in ${startTestsTime - Number(process.env._START)}ms!`);

const suiteWithOnlyName = 'Suite with only test';
const suiteWithOnly = new Suite(suiteWithOnlyName);

const getTestData = (): {foo: string} => {
  return {foo: ''};
};

suiteWithOnly.addFunctionToScope(getTestData);

suiteWithOnly.addTest('some test', () => {
  // some asserts
});

suiteWithOnly.addTest('other test', {skip: 'reason ...'}, async () => {
  // ...
});

suiteWithOnly.addTest('third test', {only: true}, () => {
  const testData = getTestData();

  assertValueIsTrue(testData.foo === '', 'testData is correct');
});

suiteWithOnly.addFunctionToScope(assertValueIsTrue);
suiteWithOnly.addFunctionToScope(assertValueIsTrue);

suiteWithOnly.addTest('test with timeout', {timeout: 500}, () => {});

suiteWithOnly.addTest(
  'test with parameters',
  {parameters: ['foo', 34]},
  (text, counter: number) => {
    assertValueIsTrue(text === 'foo', 'string parameter is correct');
    // @ts-expect-error
    assertValueIsTrue(text === 'bar', 'second string parameter is correct');
    assertValueIsTrue(counter === 35, 'number parameter is correct');
  },
);

const onlyResult = await suiteWithOnly.run({testTimeout: 3_000});

assertValueIsTrue(onlyResult.failed === 0, 'failed counter is correct');
assertValueIsTrue(onlyResult.hasNoBody === 0, 'hasNoBody counter is correct');
assertValueIsTrue(onlyResult.interrupted === 0, 'interrupted counter is correct');
assertValueIsTrue(onlyResult.passed === 1, 'passed counter is correct');
assertValueIsTrue(onlyResult.skipped === 0, 'skipped counter is correct');
assertValueIsTrue(onlyResult.timedOut === 0, 'timedOut counter is correct');
assertValueIsTrue(onlyResult.wasNotRunInTime === 0, 'wasNotRunInTime counter is correct');

assertValueIsTrue(onlyResult.filterTestErrors.length === 0, 'no filterTestErrors');
assertValueIsTrue(onlyResult.onSuiteEndErrors.length === 0, 'no onSuiteEndErrors');
assertValueIsTrue(onlyResult.onSuiteStartErrors.length === 0, 'no onSuiteStartErrors');
assertValueIsTrue(onlyResult.onTestEndErrors.length === 0, 'no onTestEndErrors');
assertValueIsTrue(onlyResult.onTestStartErrors.length === 0, 'no onTestStartErrors');

assertValueIsTrue(onlyResult.duration > 0 && onlyResult.duration < 20, 'duration is correct');
assertValueIsTrue(onlyResult.name === suiteWithOnlyName, 'suite name is correct');
assertValueIsTrue(onlyResult.runStatus === 'passed', 'run status is correct');
assertValueIsTrue(
  onlyResult.startTime.valueOf() > Date.now() - onlyResult.duration - 5 &&
    onlyResult.startTime.valueOf() + onlyResult.duration < Date.now() + 1,
  'startTime is correct',
);
assertValueIsTrue(onlyResult.testsInRun === 1, 'testsInRun counter is correct');
assertValueIsTrue(onlyResult.testsInSuite === 5, 'testsInSuite counter is correct');

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

suite.addTest({name: 'with \\error #', retries: 4}, () => {
  throw new Error('foo');
});

suite.addTest({repeats: 4, retries: 2}, () => {
  throw new Error('bar');
});

const result = await suite.run();

assertValueIsTrue(result.runStatus === 'failed', 'suite run is failed');

assertValueIsTrue(result.failed === 1 + 5 + 4 * 3, 'tests fail when they should');
assertValueIsTrue(result.passed === 4 + 3, 'number of passed tests is correct');
assertValueIsTrue(result.skipped === 2, 'number of skipped tests is correct');

assertValueIsTrue(testsCounter === 6, 'repeats works correctly');

testsCounter = 0;

const repeatOfResult = await suite.run();

for (const key of Object.keys(result) as (keyof typeof result)[]) {
  if (key !== 'duration' && (typeof result[key] === 'number' || typeof result[key] === 'string')) {
    assertValueIsTrue(
      result[key] === repeatOfResult[key],
      `${key} is the same with repeating the run`,
    );
  }
}

const suiteWithTodo = new Suite();

suiteWithTodo.addTest(() => {
  assertTestsCounter(1);
});

suiteWithTodo.addTest({todo: 'some reason'}, () => {
  assertTestsCounter(2);

  throw new Error('baz');
});

suiteWithTodo.addTest('some name', () => {
  assertTestsCounter(3);
});

suiteWithTodo.addFunctionToScope(assertTestsCounter);

testsCounter = 0;

const todoResult = await suiteWithTodo.run({
  filterTests: (_options, {name}) => name === 'anonymous',
});

assertValueIsTrue(todoResult.runStatus === 'passed', 'todo test does not affect the run status');
assertValueIsTrue(
  todoResult.passed === 1 && todoResult.testsInRun === 2 && todoResult.testsInSuite === 3,
  'filterTests works correctly',
);

const suiteWithMaxFailures = new Suite({maxFailures: 3, retries: 5});

suiteWithMaxFailures.addTest(() => {
  throw new Error('foo');
});

const maxFailuresResult = await suiteWithMaxFailures.run();

assertValueIsTrue(
  maxFailuresResult.runStatus === 'interruptedByMaxFailures',
  'run has expected status for interruption by maxFailures',
);

assertValueIsTrue(
  maxFailuresResult.failed === 3 &&
    maxFailuresResult.testsInRun === 4 &&
    maxFailuresResult.testsInSuite === 1 &&
    maxFailuresResult.wasNotRunInTime === 1,
  'maxFailures interruption works correctly',
);

const asyncSuite = new Suite();

asyncSuite.addTest(() => {
  assertTestsCounter(1);
});

asyncSuite.addTest(async () => {
  assertTestsCounter(2);
});

asyncSuite.addTest(() => {
  assertTestsCounter(3);
});

asyncSuite.addTest(async () => {
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
);

testsCounter = 0;

const asyncSuiteResultWithTimeout = await asyncSuite.run({testTimeout: 10});

assertValueIsTrue(
  asyncSuiteResultWithTimeout.runStatus === 'failed' &&
    asyncSuiteResultWithTimeout.failed === 1 &&
    asyncSuiteResultWithTimeout.passed === 4 &&
    asyncSuiteResultWithTimeout.timedOut === 1,
  'testTimeout works correctly',
);

const asyncSuiteResultWithRunTimeout = await asyncSuite.run({
  onSuiteStart: () => {
    testsCounter = 0;
  },
  runTimeout: 10,
});

assertValueIsTrue(
  asyncSuiteResultWithRunTimeout.runStatus === 'interruptedByTimeout' &&
    asyncSuiteResultWithRunTimeout.duration < 10 + 2 &&
    asyncSuiteResultWithRunTimeout.failed === 0 &&
    asyncSuiteResultWithRunTimeout.interrupted === 1 &&
    asyncSuiteResultWithRunTimeout.passed === 3 &&
    asyncSuiteResultWithRunTimeout.timedOut === 0 &&
    asyncSuiteResultWithRunTimeout.wasNotRunInTime === 2,
  'runTimeout works correctly',
);

testsCounter = 0;

const controller = new AbortController();

setTimeout(() => {
  controller.abort();
}, 10);

const asyncSuiteResultWithSignal = await asyncSuite.run({signal: controller.signal});

assertValueIsTrue(
  asyncSuiteResultWithSignal.runStatus === 'interruptedBySignal' &&
    asyncSuiteResultWithSignal.duration < 10 + 2 &&
    asyncSuiteResultWithSignal.failed === 0 &&
    asyncSuiteResultWithSignal.interrupted === 1 &&
    asyncSuiteResultWithSignal.passed === 3 &&
    asyncSuiteResultWithSignal.timedOut === 0 &&
    asyncSuiteResultWithSignal.wasNotRunInTime === 2,
  'interruption by signal works correctly',
);

try {
  asyncSuite.addFunctionToScope(function assertTestsCounter() {});

  throw 'unreachable';
} catch (error) {
  assertValueIsTrue(
    error instanceof Error &&
      error.message.includes('assertTestsCounter') &&
      error.message.includes('already exists'),
    'addFunctionToScope checks changes in scope',
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
    'addFunctionToScope checks function names',
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

    Object.assign(event, {tapOutput: `${event.tapOutput.trim()} # ${event.result.duration}ms\n`});

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

suiteWithConcurrency.addTest(async () => {
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
    suiteWithConcurrencyResult.duration >= 30 &&
    suiteWithConcurrencyResult.duration <= 35,
  'concurrency works correctly',
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
    anotherConcurrencyResult.duration >= 40 &&
    anotherConcurrencyResult.duration <= 45,
  'concurrency works correctly for tests with different duration',
);

type Test = BaseTest & {bar?: number};
type FooOptions = Options<Test> & {foo?: string};

class FooSuite extends Suite<Test> {
  assertTests(count: number) {
    assertValueIsTrue(count === this.wereRun.length, `were run ${count} tests`);

    for (const {bar} of this.wereRun) {
      assertValueIsTrue(bar !== undefined, 'test property bar is defined');
    }
  }

  foo = 'qux';

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

fooSuite.addTest('name', {bar: 1}, () => {});
fooSuite.addTest({bar: 2}, () => {});
fooSuite.addTest({bar: 3, body: () => {}});

fooSuite.assertTests(0);

const fooResult = await fooSuite.run();

fooSuite.assertTests(3);

assertValueIsTrue(
  fooResult.runStatus === 'passed' && fooResult.testsInRun === 3 && fooResult.foo === 'qux',
  'extended suite works correctly',
);

const anotherFooResult = await fooSuite.run({foo: 'quux'});

fooSuite.assertTests(6);

assertValueIsTrue(
  anotherFooResult.runStatus === 'passed' &&
    anotherFooResult.testsInRun === 3 &&
    anotherFooResult.foo === 'quux',
  'extended suite works correctly with extended options',
);

ok(`All ${totalAssertsCounter} tests passed in ${Date.now() - startTestsTime}ms!`);
