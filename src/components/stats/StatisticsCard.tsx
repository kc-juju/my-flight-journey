import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';

type Tone = 'plain' | 'inverted' | 'muted';

interface StatisticsCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: string;
  tone?: Tone;
  /** Extra content under the value — a bar, a caption, a breakdown. */
  children?: ReactNode;
  className?: string;
}

const TONE: Record<Tone, string> = {
  plain: 'bg-surface-container-lowest text-on-surface shadow-sm',
  inverted: 'bg-primary-container text-on-primary shadow-md',
  muted: 'bg-surface-container text-on-surface shadow-sm',
};

export function StatisticsCard({
  label,
  value,
  unit,
  icon,
  tone = 'plain',
  children,
  className = '',
}: StatisticsCardProps) {
  const labelTone = tone === 'inverted' ? 'text-on-primary/70' : 'text-on-surface-variant';

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`flex flex-col justify-between rounded-xl p-stack-md ${TONE[tone]} ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`font-label-caps text-label-caps uppercase tracking-widest ${labelTone}`}>
          {label}
        </span>
        {icon && <Icon name={icon} className={`opacity-50 ${labelTone}`} />}
      </div>

      <div className="mt-stack-md flex items-baseline gap-2">
        <span
          className={`font-display-lg text-display-lg leading-none ${
            tone === 'inverted' ? 'text-on-primary' : 'text-primary'
          }`}
        >
          {value}
        </span>
        {unit && (
          <span className={`font-headline-md text-headline-md ${labelTone}`}>{unit}</span>
        )}
      </div>

      {children}
    </motion.section>
  );
}
