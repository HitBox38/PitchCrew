process.stdin.resume();
process.stdin.on('end', () => {
  console.log(
    JSON.stringify({
      type: 'result',
      result: JSON.stringify({ role: 'scout', fit: 87, reasons: ['Fixture result'] }),
    }),
  );
});
