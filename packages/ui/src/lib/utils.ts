import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return mergeClasses(clsx(inputs));
};

// Keep custom typography/shadow tokens distinct from text/shadow color utilities.
const mergeClasses = extendTailwindMerge({
  extend: {
    theme: {
      text: ['body', 'label', 'caption', 'note', 'detail'],
      shadow: ['clay', 'clay-hover', 'sunken', 'glaze', 'switch-thumb', 'sheet', 'pop'],
      ease: ['material', 'drawer'],
    },
  },
});
