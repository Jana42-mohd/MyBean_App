// Stand-ins for the phone and the backend, so lib/ modules can run under plain Node.
const Module = require('module');

exports.build = name => require(require('path').join(process.env.TEST_BUILD, name));

// Replace modules by name for everything loaded afterwards in this test process
exports.install = map => {
  const orig = Module._load;
  Module._load = function (request, ...rest) {
    if (Object.prototype.hasOwnProperty.call(map, request)) return map[request];
    return orig.call(this, request, ...rest);
  };
};

exports.fakeAsyncStorage = () => {
  const store = {};
  return {
    store,
    module: {
      __esModule: true,
      default: {
        getItem: async k => (k in store ? store[k] : null),
        setItem: async (k, v) => { store[k] = v; },
        removeItem: async k => { delete store[k]; },
        multiRemove: async ks => { ks.forEach(k => delete store[k]); },
      },
    },
  };
};

// A query builder that records every call and answers with whatever `behave(call)` returns:
//   { data, error, status }. Chained methods all return the builder; awaiting it runs the call.
exports.fakeSupabase = (behave, session = { user: { id: 'u1' } }) => {
  const calls = [];
  const builder = (table, op, payload, opts) => {
    const call = { table, op, payload, opts, filters: {}, select: null };
    const run = () => {
      calls.push(call);
      const b = behave(call) || {};
      return Promise.resolve({ data: b.data ?? null, error: b.error ?? null, status: b.status ?? (b.error ? 400 : 200) });
    };
    const c = {};
    for (const m of ['eq', 'in', 'gte', 'order', 'limit']) c[m] = (...a) => { call.filters[m] = a; return c; };
    c.select = (...a) => { call.select = a; return c; };
    c.then = (res, rej) => run().then(res, rej);
    return c;
  };
  return {
    calls,
    module: {
      supabase: {
        auth: { getSession: async () => ({ data: { session } }) },
        from: table => ({
          select: (...a) => { const c = builder(table, 'select'); c.select(...a); return c; },
          upsert: (p, o) => builder(table, 'upsert', p, o),
          insert: p => builder(table, 'insert', p),
          delete: () => builder(table, 'delete'),
        }),
      },
    },
  };
};

exports.NET_ERROR = { message: 'TypeError: Network request failed', code: '' }; // what the client returns with no signal
exports.settle = (ms = 25) => new Promise(r => setTimeout(r, ms));
