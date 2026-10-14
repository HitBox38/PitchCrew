if (process.argv.includes('--version')) {
  console.log('grok 1.0.52 (fixture)');
} else if (process.argv.includes('models')) {
  console.log('Available models:\n  * grok-build (default)');
} else {
  console.log(JSON.stringify({ type: 'text', data: '{"reply":"Fixture Grok reply."}' }));
  console.log(JSON.stringify({ type: 'end', stopReason: 'end_turn' }));
}
