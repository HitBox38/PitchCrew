import type { SkillFilter, SkillsViewProps } from '@/SkillsView/types.ts';
import type { Skill } from '@pitchcrew/core';
import { type BaseSkill } from '@pitchcrew/core/base-skills';
import { useState } from 'react';
import { pendingSkillUpdates } from '@/lib/skill-updates.ts';

export const useSkillsView = ({
  data,
  action,
  working,
  filter: requestedFilter,
  onFilter,
  selectedId,
  onSelect: setSelectedId,
  updatesOnly,
  onUpdatesOnly,
  reviewId,
  onReviewClose,
}: SkillsViewProps) => {
  const remove = async () => {
    if (!deleting) return;
    try {
      await action(`/skills/${deleting.id}`, 'DELETE', undefined, 'Deleted skill');
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete skill.');
    }
  };

  const filter =
    ['all', 'shared'].includes(requestedFilter) ||
    data.roles.some((role) => role.id === requestedFilter)
      ? requestedFilter
      : 'all';
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
    skill.source?.repository.split('/')[0] ??
    (skill.bundledId ? 'Pitchcrew' : (agentCreators.get(skill.id) ?? 'You'));
  const pendingIds = new Set(pendingSkillUpdates(data).map((check) => check.skillId));
  const skills = data.skills.filter(
    (skill) =>
      (!updatesOnly || pendingIds.has(skill.id)) &&
      (filter === 'all' ||
        (filter === 'shared'
          ? skill.scope === 'all'
          : skill.scope === 'all' || skill.roleIds.includes(filter))) &&
      `${skill.name} ${skill.description} ${skill.content} ${creator(skill)} ${skill.source?.repository ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  skills.sort((a, b) => Number(pendingIds.has(b.id)) - Number(pendingIds.has(a.id)));
  const chosen = skills.find((skill) => skill.id === selectedId);
  // A notification opens its exact review even when the existing local search hides that skill.
  const requestedReview = data.skills.find((skill) => skill.id === reviewId);
  const selected = requestedReview ?? chosen ?? skills[0] ?? null;
  const showingDetail = Boolean(requestedReview ?? chosen);
  const filters: { value: SkillFilter; label: string }[] = [
    { value: 'all', label: 'All skills' },
    { value: 'shared', label: 'Shared' },
    ...data.roles.map((role) => ({ value: role.id, label: role.name })),
  ];
  return {
    data,
    updatesOnly,
    onUpdatesOnly,
    reviewId,
    onReviewClose,
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
    selected,
    setSelectedId,
    showingDetail,
    filters,
    remove,
  };
};
