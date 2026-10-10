import Image from 'next/image';

export function Brand() {
  return (
    <a href="/" aria-label="Pitchcrew home" className="inline-flex items-center gap-2 sm:gap-2.5">
      <Image src="/favicon.svg" width={42} height={42} className="size-8 sm:size-[42px]" alt="" />
      <span className="font-serif text-[21px] font-semibold tracking-[-0.035em] sm:text-[25px]">
        Pitchcrew
      </span>
    </a>
  );
}
