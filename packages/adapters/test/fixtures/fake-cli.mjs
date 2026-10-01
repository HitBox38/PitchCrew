process.stdin.resume();
process.stdin.on('end', () => {
  console.log(
    JSON.stringify({
      type: 'result',
      result: JSON.stringify(
        process.argv.includes('--chat')
          ? { reply: 'Fixture conversational response.' }
          : {
              role: 'scout',
              fit: 87,
              reasons: process.argv.includes('--check-env')
                ? [String(process.env.PITCHCREW_GOOGLE_CLIENT_SECRET ?? 'absent')]
                : ['Fixture result'],
            },
      ),
    }),
  );
});
