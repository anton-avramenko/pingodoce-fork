/**
 * Text-based recreations of the card wordmarks for the POC.
 *
 * These are styled type, not the official logo artwork — deliberately, so the
 * POC doesn't ship copied trademark assets. Swap for the brand team's supplied
 * logos before any public-facing use.
 */

interface WordmarkProps {
  className?: string;
  /** Tone: 'onGreen' for the bright card, 'onLight' for white surfaces. */
  tone?: 'onGreen' | 'onLight';
}

export function OMeuWordmark({ className, tone = 'onGreen' }: WordmarkProps) {
  const script = tone === 'onGreen' ? 'text-brand-deep' : 'text-brand-dark';
  return (
    <span className={`inline-flex flex-col leading-none ${className ?? ''}`} aria-label="O Meu Pingo Doce">
      <span className="text-[15px] font-extrabold tracking-tight text-white">
        O<span className="text-white/95">MEU</span>
      </span>
      <span className={`-mt-0.5 font-serif text-[13px] italic ${script}`}>pingo doce</span>
    </span>
  );
}

export function PoupaMaisWordmark({ className, tone = 'onGreen' }: WordmarkProps) {
  const color = tone === 'onGreen' ? 'text-white' : 'text-brand-dark';
  return (
    <span
      className={`inline-flex items-baseline font-extrabold italic tracking-tight ${color} ${className ?? ''}`}
      aria-label="Poupa Mais"
    >
      <span className="text-[15px]">Poupa</span>
      <span className="text-[15px] text-brand-deep">Mais</span>
    </span>
  );
}
