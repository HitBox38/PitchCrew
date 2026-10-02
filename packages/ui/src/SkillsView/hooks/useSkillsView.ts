import type { SkillFilter, SkillsViewProps } from '@/SkillsView/types.ts';
import type { Skill } from '@pitchcrew/core';
import { type BaseSkill } from '@pitchcrew/core/base-skills';
import { useState } from 'react';

export function useSkillsView({ data, action, working, filter, onFilter }: SkillsViewProps) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Skill | 'new' | 'import' | null>(null);
  const [starter, setStarter] = useState<BaseSkill | null>(null);
  const [deleting, setDeleting] = useState<Skill | null>(null);
  const [error, setError] = useState('');
  const agentCreators = new Map(
    data.skillProposals
      .filter((proposal) => proposal.status === 'applied' && proposal.skillId)
      .map((proposal) => [
        proposal.skillId,
        data.roles.find((role) => role.id === proposal.roleId)?.name ?? proposal.roleId,
      ]),
  );
  const creator = (skill: Skill) =>
    skill.source?.repository.split('/')[0] ?? agentCreators.get(skill.id) ?? 'You';
  const skills = data.skills.filter(
    (skill) =>
      (filter === 'all' ||
        (filter === 'shared'
          ? skill.scope === 'all'
          : skill.scope === 'all' || skill.roleIds.includes(filter))) &&
      `${skill.name} ${skill.description} ${skill.content} ${creator(skill)} ${skill.source?.repository ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const filters: { value: SkillFilter; label: string }[] = [
    { value: 'all', label: 'All skills' },
    { value: 'shared', label: 'Shared' },
    ...data.roles.map((role) => ({ value: role.id, label: role.name })),
  ];
  async function remove() {
    if (!deleting) return;
    try {
      await action(`/skills/${deleting.id}`, 'DELETE', undefined, 'Deleted skill');
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete skill.');
    }
  }
  return {
    data,
    action,
    working,
    filter,
    onFilter,
    query,
    setQuery,
    editing,
    setEditing,
    starter,
    setStarter,
    deleting,
    setDeleting,
    error,
    setError,
    creator,
    skills,
    filters,
    remove,
  };
}
