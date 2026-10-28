/** JSON IPC cannot preserve typed arrays between Bun and Node without an explicit encoding. */
export type WorkerValue =
  | ['value', null | boolean | string | number]
  | ['undefined']
  | ['bigint', string]
  | ['bytes', 'buffer' | 'uint8array' | 'arraybuffer', string]
  | ['array', WorkerValue[]]
  | ['object', [string, WorkerValue][]]
  | ['error', string, string, string | undefined, WorkerValue];

export const encodeWorkerValue = (value: unknown, ancestors = new Set<object>()): WorkerValue => {
  if (value === undefined) return ['undefined'];
  if (typeof value === 'bigint') return ['bigint', String(value)];
  if (value === null || ['boolean', 'string', 'number'].includes(typeof value))
    return ['value', value as null | boolean | string | number];
  if (Buffer.isBuffer(value)) return ['bytes', 'buffer', value.toString('base64')];
  if (value instanceof Uint8Array)
    return ['bytes', 'uint8array', Buffer.from(value).toString('base64')];
  if (value instanceof ArrayBuffer)
    return ['bytes', 'arraybuffer', Buffer.from(value).toString('base64')];
  if (typeof value !== 'object' || ancestors.has(value))
    throw new TypeError('Isolated workers require acyclic JSON values or binary data.');
  ancestors.add(value);
  try {
    if (value instanceof Error)
      return [
        'error',
        value.name,
        value.message,
        value.stack,
        encodeWorkerValue(Object.fromEntries(Object.entries(value)), ancestors),
      ];
    if (Array.isArray(value))
      return ['array', value.map((item) => encodeWorkerValue(item, ancestors))];
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new TypeError('Isolated workers require plain objects or binary data.');
    return [
      'object',
      Object.entries(value).map(([key, item]) => [key, encodeWorkerValue(item, ancestors)]),
    ];
  } finally {
    ancestors.delete(value);
  }
};

export const decodeWorkerValue = (value: WorkerValue): unknown => {
  switch (value[0]) {
    case 'value':
      return value[1];
    case 'undefined':
      return undefined;
    case 'bigint':
      return BigInt(value[1]);
    case 'bytes': {
      const bytes = Buffer.from(value[2], 'base64');
      return value[1] === 'buffer'
        ? bytes
        : value[1] === 'uint8array'
          ? new Uint8Array(bytes)
          : Uint8Array.from(bytes).buffer;
    }
    case 'array':
      return value[1].map(decodeWorkerValue);
    case 'object':
      return Object.fromEntries(value[1].map(([key, item]) => [key, decodeWorkerValue(item)]));
    case 'error': {
      const error = new Error(value[2]);
      error.name = value[1];
      error.stack = value[3];
      return Object.assign(error, decodeWorkerValue(value[4]));
    }
  }
};
