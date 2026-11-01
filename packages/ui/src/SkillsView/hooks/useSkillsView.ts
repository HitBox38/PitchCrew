import type { SkillsViewProps } from '@/SkillsView/types.ts';
import type { Skill } from '@pitchcrew/core';
import { type BaseSkill } from '@pitchcrew/core/base-skills';
import { useRef, useState } from 'react';
import { pendingSkillUpdates } from '@/lib/skill-updates.ts';
import { skillCreators, skillMatches } from '../helpers.ts';

export type SkillEditing = Skill | 'new' | 'import';

export const useSkillsView = (props: SkillsViewProps) => {
  const { data, action, filter: requestedFilter, selectedId, onSelect, updatesOnly } = props;
  const filter =
    ['all', 'shared'].includes(requestedFilter) ||
    data.roles.some((role) => role.id === requestedFilter)
      ? requestedFilter
      : 'all';
  const [query, setQuery] = useState('');
  const [editing, setEditingNow] = useState<SkillEditing | null>(null);
  const [starter, setStarter] = useState<BaseSkill | null>(null);
  const [startersOpen, setStartersOpen] = useState(false);
  const [deleting, setDeleting] = useState<Skill | null>(null);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  // The open editor registers its unsaved-changes guard so local switches also ask first.
  const leave = useRef<((next: () => void) => void) | null>(null);
  const setEditing = (next: SkillEditing | null, nextStarter: BaseSkill | null = null) => {
    const go = () => {
      setStarter(nextStarter);
      setEditingNow(next);
    };
    if (leave.current && next) leave.current(go);
    else go();
  };
  // Route changes (another skill, filter or Back) close the editor once the guard allows them.
  const routeKey = `${filter}|${selectedId ?? ''}`;
  const [previousRoute, setPreviousRoute] = useState(routeKey);
  if (previousRoute !== routeKey) {
    setPreviousRoute(routeKey);
    setEditingNow(null);
    setSavedId(null);
  }
  const remove = async () => {
    if (!deleting) return;
    try {
      await action(`/skills/${deleting.id}`, 'DELETE', undefined, 'Deleted skill');
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete skill.');
    }
  };
  const creator = skillCreators(data);
  const pending = new Set(pendingSkillUpdates(data).map((check) => check.skillId));
  const skills = data.skills
    .filter((skill) =>
      skillMatches(skill, { filter, query, updatesOnly, pending, creator: creator(skill) }),
    )
    .sort((a, b) => Number(pending.has(b.id)) - Number(pending.has(a.id)));
  const chosen = skills.find((skill) => skill.id === selectedId);
  // A notification opens its exact review even when the existing local search hides that skill.
  const requestedReview = data.skills.find((skill) => skill.id === props.reviewId);
  // A newly added skill opens even though its editor could not navigate while still mounted.
  const saved = data.skills.find((skill) => skill.id === savedId);
  const selected = requestedReview ?? saved ?? chosen ?? skills[0] ?? null;
  const filtered = Boolean(query.trim() || updatesOnly || filter !== 'all');
  const clearFilters = () => {
    setQuery('');
    if (updatesOnly) props.onUpdatesOnly();
    if (filter !== 'all') props.onFilter('all');
  };
  return {
    ...props,
    filter,
    query,
    setQuery,
    editing,
    setEditing,
    closeEditor: () => setEditingNow(null),
    registerLeave: (guard: ((next: () => void) => void) | null) => {
      leave.current = guard;
    },
    starter,
    startersOpen,
    setStartersOpen,
    deleting,
    setDeleting,
    error,
    setError,
    creator,
    pending,
    skills,
    selected,
    setSelectedId: (id: string | null) => {
      setSavedId(null);
      onSelect(id);
    },
    onSaved: setSavedId,
    showingDetail: Boolean(requestedReview ?? chosen ?? saved ?? editing),
    filtered,
    clearFilters,
    remove,
  };
};
