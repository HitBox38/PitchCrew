/** Fictional posting with the same mixed plain-text/ARIA shape as the saved-record defect. */
export const postingParagraphs = [
  'Engineering, Haifa, Full Time',
  'Frontend Engineer',
  'About us',
  'At Northwind Labs, we build tools that help teams find and complete their work. We preserve the details—including punctuation, numbers like 3–5, and names such as TypeScript.',
  'The role',
  'We are hiring a Frontend Engineer to design, prototype, and ship desktop and web experiences. You will work with researchers, designers, and backend engineers.',
  'What you’ll do',
  'Build accessible experiences with React, TypeScript, and CSS.',
  'Develop desktop apps with Electron and system APIs.',
  'Make thoughtful architecture decisions.',
  'You’ll excel if you',
  'Have 3–5 years of frontend experience.',
  'Enjoy turning vague specifications into polished features.',
  'Benefits and perks',
  'Salary and equity.',
  'Health insurance for you and dependents.',
  'The team',
  'Our team includes engineers and researchers from several industries. We welcome people with different backgrounds.',
  'Additional details',
  'This final paragraph is part of the original posting. Preserve it in full, even after the lists and all earlier sections; never replace it with a summary.',
] as const;

export const rawPostingExtraction = `${postingParagraphs[0]}
${postingParagraphs[1]}

  - heading "${postingParagraphs[2]}" [level=2]
  - paragraph: ${postingParagraphs[3]}
  - heading "${postingParagraphs[4]}" [level=2]
  - paragraph: "${postingParagraphs[5]}"
  - heading "${postingParagraphs[6]}" [level=2]
  - list:
    - listitem: ${postingParagraphs[7]}
    - listitem: ${postingParagraphs[8]}
    - listitem: ${postingParagraphs[9]}
  - heading "${postingParagraphs[10]}" [level=2]
  - list:
    - listitem: ${postingParagraphs[11]}
    - listitem: ${postingParagraphs[12]}
  - heading "${postingParagraphs[13]}" [level=2]
  - list:
    - listitem: ${postingParagraphs[14]}
    - listitem: ${postingParagraphs[15]}
  - heading "${postingParagraphs[16]}" [level=2]
  - paragraph: ${postingParagraphs[17]}
  - heading "${postingParagraphs[18]}" [level=2]
  - paragraph: ${postingParagraphs[19]}`;

/** Explicit agent retry, not a lossy automatic cleanup of the accessibility representation. */
export const readablePosting = `${postingParagraphs[0]}
${postingParagraphs[1]}

${postingParagraphs[2]}

${postingParagraphs[3]}

${postingParagraphs[4]}

${postingParagraphs[5]}

${postingParagraphs[6]}

- ${postingParagraphs[7]}
- ${postingParagraphs[8]}
- ${postingParagraphs[9]}

${postingParagraphs[10]}

- ${postingParagraphs[11]}
- ${postingParagraphs[12]}

${postingParagraphs[13]}

- ${postingParagraphs[14]}
- ${postingParagraphs[15]}

${postingParagraphs[16]}

${postingParagraphs[17]}

${postingParagraphs[18]}

${postingParagraphs[19]}`;
