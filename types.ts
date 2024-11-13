import type {Suite} from './index';

export interface BaseTest {
  readonly body: ((this: void, ...args: this['parameters']) => unknown) | undefined;
  readonly fail: boolean;
  readonly name: string;
  readonly only: boolean;
  readonly parameters: readonly unknown[];
  /**
   * If greater than 1, then ignore retries.
   */
  readonly repeats: number;
  readonly retry: number;
  readonly skip: boolean | string;
  readonly timeout: number;
  readonly todo: boolean | string;
}

export type CachedBodiesCreator = (this: {
  scope: Record<string, Function>;
  source: string;
}) => unknown;

export type ClearTimeout = (id: number) => void;

export type EndTestResult =
  | RunningTestResult
  | Readonly<{startTime: Date; status: 'interrupted'}>
  | Readonly<{status: 'skipped'}>
  | Readonly<{status: 'todo'}>
  | Readonly<{status: 'wasNotRun'}>;

export type InterruptedRunStatus = Exclude<RunStatus, 'failed' | 'passed'>;

/**
 * Returns a copy of the object type with mutable properties.
 * `Mutable<{readonly foo: string}>` = `{foo: string}`.
 */
export type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

export type Options<Test extends BaseTest> = Partial<RunOptions<Test>>;

export type Runner<Test extends BaseTest> = Generator<
  RunnerState,
  RunnerState,
  InterruptedRunStatus | TestUnit<Test> | undefined
>;

export type RunnerState = Readonly<
  | {isAtMaxConcurrency: true; nextTestEnd: Promise<void>}
  | {isAtMaxConcurrency: false; nextTestEnd: Promise<void> | undefined}
>;

export type RunOptions<Test extends BaseTest> = Readonly<{
  clearTimeout: ClearTimeout;
  concurrency: number;
  filterTests: (this: Suite<Test>, test: Test) => boolean;
  maxFailures: number;
  name: string;
  now: () => number;
  /**
   * Call for all tests from `getTestUnits`.
   */
  onTestStart: Function;
  /**
   * Call for all tests from `getTestUnits`.
   */
  onTestEnd: Function;
  repeats: number;
  retries: number;
  runTimeout: number;
  setTimeout: SetTimeout;
  signal: AbortSignal | undefined;
  testTimeout: number;
}>;

export type RunningTestResult = TestResult<'failed' | 'passed' | 'timedOut'>;

export type RunStatus =
  | 'failed'
  | 'passed'
  | 'interruptedByMaxFailures'
  | 'interruptedBySignal'
  | 'interruptedByTimeout';

export type RunResult = Readonly<{
  duration: number;
  name: string;
  runStatus: RunStatus;
  startTime: Date;
  testsInRun: number;
  testsInSuite: number;
}> &
  Readonly<Record<Status, number>>;

export type SetTimeout = (handler: () => void, timeout: number) => unknown;

export type Status =
  | 'failed'
  | 'interrupted'
  | 'passed'
  | 'skipped'
  | 'timedOut'
  | 'todo'
  | 'wasNotRun';

export type Task = {readonly clear: () => void; done: boolean; readonly end: Promise<void>};

export type TestEndEvent<Test extends BaseTest> = Readonly<{result: TestResult; test: Test}>;

export type TestResult<SomeStatus extends Status = Status> = Readonly<{
  duration: number;
  error: unknown;
  hasError: boolean;
  startTime: Date;
  status: SomeStatus;
}>;

export type TestStartEvent<Test extends BaseTest> = Readonly<{
  status: 'skipped' | 'todo' | 'wasNotRun' | undefined;
  test: Test;
}>;

export type TestUnit<Test extends BaseTest> = Readonly<{
  onEnd: ((result: TestResult) => void) | undefined;
  status: 'skipped' | 'todo' | undefined;
  test: Test;
}>;

export type TestUnits<Test extends BaseTest> = Generator<
  TestUnit<Test> | undefined,
  undefined,
  undefined
>;
