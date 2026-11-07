import { Button } from '@pitchcrew/design-system/button';
import { Switch } from '@pitchcrew/design-system/switch';
import { ArrowUp, ArrowDown, Star, Pencil } from 'lucide-react';
import type { ManagedRuntimeModel } from '@pitchcrew/core';
import type { RuntimeModelsModel } from '../types.ts';
import { RemoveCustomModel } from './RemoveCustomModel.tsx';
import { RuntimeModelIdentity } from './RuntimeModelIdentity.tsx';

export const RuntimeModelRow = ({
  entry,
  model,
  edit,
  disabled,
}: {
  entry: ManagedRuntimeModel;
  model: RuntimeModelsModel;
  edit: () => void;
  disabled: boolean;
}) => {
  const preferences = model.state!.preferences;
  const favorite = preferences.favorite.includes(entry.value);
  const hidden = preferences.hidden.includes(entry.value);
  return (
    <li className="settings-list-row" aria-label={`${entry.label} model`}>
      <div className="settings-list-main">
        <RuntimeModelIdentity entry={entry} />
        <div className="settings-row-actions">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`${favorite ? 'Unfavorite' : 'Favorite'} ${entry.label}`}
            aria-pressed={favorite}
            onClick={() => model.toggle('favorite', entry.value)}
          >
            <Star size={15} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </Button>
          <label
            className="flex min-h-11 items-center gap-2"
            htmlFor={`runtime-${model.id}-model-${entry.value}-show`}
          >
            <span id={`runtime-${model.id}-model-${entry.value}-show-label`} className="quiet">
              Show<span className="sr-only"> {entry.label} in model pickers</span>
            </span>
            <Switch
              id={`runtime-${model.id}-model-${entry.value}-show`}
              checked={!hidden}
              disabled={disabled}
              aria-labelledby={`runtime-${model.id}-model-${entry.value}-show-label`}
              onCheckedChange={() => model.toggle('hidden', entry.value)}
            />
          </label>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled || !model.canMove(entry.value, -1)}
            aria-label={`Move ${entry.label} up`}
            onClick={() => model.move(entry.value, -1)}
          >
            <ArrowUp size={15} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled || !model.canMove(entry.value, 1)}
            aria-label={`Move ${entry.label} down`}
            onClick={() => model.move(entry.value, 1)}
          >
            <ArrowDown size={15} aria-hidden="true" />
          </Button>
          {entry.custom ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={`Edit ${entry.label}`}
                id={`runtime-${model.id}-edit-${entry.value}`}
                onClick={edit}
              >
                <Pencil size={15} aria-hidden="true" />
              </Button>
              <RemoveCustomModel entry={entry} model={model} disabled={disabled} />
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
};
