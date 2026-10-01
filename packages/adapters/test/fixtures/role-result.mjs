export function roleResult(prompt, mode) {
  const role = prompt.match(/You are Pitchcrew's (scout|writer|reviewer)/)?.[1];
  const packet = {
    resume: '# Fictional Candidate\n- Built café interfaces.',
    coverLetter: 'Built café interfaces.',
    formAnswers: '',
    note: '',
    claims: [
      { claim: 'Built café interfaces.', source: 'profile.md', quote: 'Built café interfaces.' },
    ],
  };
  const result =
    mode === 'wrong-role'
      ? { role: 'reviewer', passed: true, feedback: [] }
      : prompt.includes('Return ONLY JSON: {"reply"')
        ? { reply: 'Fixture conversational café response.' }
        : role === 'writer'
          ? { role, packet }
          : role === 'reviewer'
            ? { role, passed: true, feedback: [] }
            : { role: 'scout', fit: 87, reasons: ['Fixture result'] };
  return mode === 'invalid' ? 'This is not JSON.' : JSON.stringify(result);
}
