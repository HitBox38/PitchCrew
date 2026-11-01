import Image from 'next/image';
import Link from 'next/link';

export const Brand = ({ compact }: { compact?: boolean }) => {
  return (
    <Link href="/" aria-label="Pitchcrew home" className="brand">
      <Image
        src="/favicon.svg"
        width={38}
        height={38}
        className={compact ? 'size-7' : 'size-8 sm:size-[38px]'}
        alt=""
        priority={!compact}
      />
      <span className="brand-word">Pitchcrew</span>
    </Link>
  );
};
