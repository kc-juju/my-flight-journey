/**
 * The games worth recording, and how to draw each one.
 *
 * `ballgame` is what the first event was tagged before there was more than
 * one sport in the atlas; it still reads as baseball.
 */
export const SPORTS: Record<string, { label: string; icon: string }> = {
  baseball: { label: 'Baseball', icon: 'sports_baseball' },
  ballgame: { label: 'Baseball', icon: 'sports_baseball' },
  basketball: { label: 'Basketball', icon: 'sports_basketball' },
  football: { label: 'Football', icon: 'sports_soccer' },
  'american-football': { label: 'American football', icon: 'sports_football' },
  hockey: { label: 'Ice hockey', icon: 'sports_hockey' },
  tennis: { label: 'Tennis', icon: 'sports_tennis' },
  rugby: { label: 'Rugby', icon: 'sports_rugby' },
  volleyball: { label: 'Volleyball', icon: 'sports_volleyball' },
  cricket: { label: 'Cricket', icon: 'sports_cricket' },
};

export function sportOf(kind?: string) {
  return kind ? SPORTS[kind] : undefined;
}
