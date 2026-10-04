import type { FastifyInstance } from 'fastify';

export function registerJsonBody(app: FastifyInstance) {
  const parse = app.getDefaultJsonParser('error', 'error');
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser<string>('application/json', { parseAs: 'string' }, (req, body, done) => {
    // The renderer sends this content type even for bodyless POST actions.
    if (body.length === 0) return done(null, undefined);
    parse(req, body, (error, value) => {
      if (error) return done(error);
      if (value === null || typeof value !== 'object')
        return done(new Error('JSON body must be an object or array.'));
      done(null, value);
    });
  });
}
