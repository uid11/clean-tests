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
  readonly retries: number;
  readonly skip: boolean | string;
  readonly timeout: number;
  readonly todo: boolean | string;
}

export type CachedBodiesCreator = (this: {
  scope: Record<string, Function>;
  source: string;
}) => unknown;

export type ClearTimeout = (id: number) => void;

export type EndResult =
  | EndedTestResult
  | Readonly<{startTime: Date; status: 'interrupted'}>
  | WithStatus<NotStartedTestStatus>;

export type FilterTestError<Test extends BaseTest> = Readonly<{error: unknown; test: Test}>;

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
  Omit<RunResult<Test>, 'filterTestErrors' | 'onTestEndErrors' | 'onTestStartErrors'>
> & {
  filterTestErrors: FilterTestError<Test>[];
  onTestEndErrors: TestEndError<Test>[];
  onTestStartErrors: TestStartError<Test>[];
};

export type NotStartedTestStatus = 'hasNoBody' | 'skipped' | 'wasNotRunInTime';

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

export type EndedTestResult = TestResult<EndedTestStatus>;

export type EndedTestStatus = 'failed' | 'passed' | 'timedOut';

export type RunStatus = InterruptedRunStatus | 'failed' | 'passed';

export type RunResult<Test extends BaseTest> = Readonly<{
  duration: number;
  filterTestErrors: readonly FilterTestError<Test>[];
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

export type Status = NotStartedTestStatus | 'interrupted' | EndedTestStatus;

export type Task<Test extends BaseTest> = {
  readonly clear: (this: void) => void;
  readonly end: Promise<void>;
  isEnded: boolean;
  readonly startTime: Date;
  readonly unit: TestUnit<Test>;
};

export type TestEndError<Test extends BaseTest> = Readonly<{
  error: unknown;
  event: TestEndEvent<Test>;
}>;

export type TestEndEvent<Test extends BaseTest> = TestWithCounts<Test> &
  Readonly<{result: TestResult}>;

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

export type TestStartEvent<Test extends BaseTest> = TestWithCounts<Test> &
  Readonly<{status: NotStartedTestStatus | undefined}>;

export type TestUnit<Test extends BaseTest> = TestWithCounts<Test> & {
  isEnded: boolean;
  readonly onEnd: TestUnitOnEnd<Test> | undefined;
  readonly status: 'skipped' | undefined;
};

export type TestUnitOnEnd<Test extends BaseTest> = (
  unit: TestUnit<Test>,
  result: TestResult,
) => void;

export type TestUnits<Test extends BaseTest> = Generator<
  TestUnit<Test> | undefined,
  undefined,
  undefined
>;

export type TestWithCounts<Test extends BaseTest> = Readonly<{
  repeatsCount: number;
  retriesCount: number;
  test: Test;
}>;

type WithStatus<SomeStatus extends Status> = SomeStatus extends Status
  ? Readonly<{status: SomeStatus}>
  : never;
