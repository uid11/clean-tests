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
  | WithStatus<NotRunningTestStatus>;

export type InterruptedRunStatus =
  | 'interruptedByMaxFailures'
  | 'interruptedBySignal'
  | 'interruptedByTimeout';

/**
 * Returns a copy of the object type with mutable properties.
 * `Mutable<{readonly foo: string}>` = `{foo: string}`.
 */
export type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

export type MutableRunResult<Test extends BaseTest> = Mutable<
  Omit<RunResult<Test>, 'onTestEndErrors' | 'onTestStartErrors'>
> & {onTestEndErrors: TestEndError<Test>[]; onTestStartErrors: TestStartError<Test>[]};

export type NotRunningTestStatus = 'skipped' | 'todo' | 'wasNotRun';

export type Options<Test extends BaseTest> = Partial<RunOptions<Test>>;

export type Runner<Test extends BaseTest> = Generator<
  RunnerState,
  undefined,
  'interrupted' | TestUnit<Test> | undefined
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
  now: (this: void) => number;
  onTestStart: (this: void, event: TestStartEvent<Test>) => void;
  onTestEnd: (this: void, event: TestEndEvent<Test>) => void;
  repeats: number;
  retries: number;
  runTimeout: number;
  setTimeout: SetTimeout;
  signal: AbortSignal | undefined;
  testTimeout: number;
}>;

export type RunningTestResult = TestResult<RunningTestStatus>;

export type RunningTestStatus = 'failed' | 'passed' | 'timedOut';

export type RunStatus = InterruptedRunStatus | 'failed' | 'passed';

export type RunResult<Test extends BaseTest> = Readonly<{
  duration: number;
  name: string;
  onTestEndErrors: readonly TestEndError<Test>[];
  onTestStartErrors: readonly TestStartError<Test>[];
  runStatus: RunStatus;
  startTime: Date;
  testsInRun: number;
  testsInSuite: number;
}> &
  Readonly<Record<Status, number>>;

export type SetTimeout = (handler: () => void, timeout: number) => unknown;

export type Status = NotRunningTestStatus | 'interrupted' | RunningTestStatus;

export type Task<Test extends BaseTest> = {
  readonly clear: () => void;
  done: boolean;
  readonly end: Promise<void>;
  readonly startTime: Date;
  readonly unit: TestUnit<Test>;
};

export type TestEndError<Test extends BaseTest> = Readonly<{
  error: unknown;
  event: TestEndEvent<Test>;
}>;

export type TestEndEvent<Test extends BaseTest> = Readonly<{result: TestResult; test: Test}>;

export type TestResult<SomeStatus extends Status = Status> = Readonly<{
  duration: number;
  error: unknown;
  hasError: boolean;
  startTime: Date;
  status: SomeStatus;
}>;

export type TestStartError<Test extends BaseTest> = Readonly<{
  error: unknown;
  event: TestStartEvent<Test>;
}>;

export type TestStartEvent<Test extends BaseTest> = Readonly<{
  status: NotRunningTestStatus | undefined;
  test: Test;
}>;

export type TestUnit<Test extends BaseTest> = Readonly<{
  onEnd: ((result: TestResult) => void) | undefined;
  status: Exclude<NotRunningTestStatus, 'wasNotRun'> | undefined;
  test: Test;
}>;

export type TestUnits<Test extends BaseTest> = Generator<
  TestUnit<Test> | undefined,
  undefined,
  undefined
>;

type WithStatus<SomeStatus extends Status> = SomeStatus extends Status
  ? Readonly<{status: SomeStatus}>
  : never;
