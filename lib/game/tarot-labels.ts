import { MAJOR_ARCANA } from "@/lib/cards";

export function majorArcanaName(index: number): string {
  const card = MAJOR_ARCANA[index];
  return card?.name ?? `Major ${index}`;
}
