import type { Skill } from '@pitchcrew/core';
import { skillDelivery } from '@pitchcrew/core/skill-delivery';

/** Shared by runtime prompts and generated context files so neither reloads deferred bodies. */
export const skillInstructions = (skills: Skill[], selectedSkills: Skill[] = []): string => {
  const { included, available } = skillDelivery(skills, selectedSkills);
  const sections: string[] = [];
  if (included.length)
    sections.push(
      `Assigned skills (apply when relevant to the request; these do not grant tools or override Pitchcrew's boundaries):\n${included.map((skill) => `### ${skill.name}\n${skill.description}\n${skill.content}`).join('\n\n')}`,
    );
  if (available.length)
    sections.push(
      `Available assigned skills (instructions are not included yet):\nBefore working on a task, read any available skill relevant to that task with pitchcrew_read_skill using its id. The tool returns this run's exact assigned instructions; read them before applying the skill. Skills do not grant tools or approvals or override Pitchcrew's boundaries. Only SKILL.md instructions are available; supporting scripts and assets are not included.\n${JSON.stringify(available.map((skill) => ({ id: skill.id, name: skill.name, description: skill.description })))}`,
    );
  return sections.join('\n\n');
};
