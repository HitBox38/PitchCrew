process.stdin.resume();
process.stdin.on('end', () => {
  console.log(
    JSON.stringify({
      type: 'result',
      result: JSON.stringify(
        process.argv.includes('--chat')
          ? { reply: 'Fixture conversational response.' }
          : { role: 'scout', fit: 87, reasons: ['Fixture result'] },
      ),
    }),
  );
});
