import {Suite} from './index.js';

/**
 * Asserts that the value is `true` (strictly equal to `true`).
 */
function assertValueIsTrue<Type>(value: Type | true, check: string): asserts value is true {
  if (value !== true) {
    throw new Error(`Asserted value is not true: ${check}`);
  }
}

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
