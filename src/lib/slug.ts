export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function getParticipantSlug(participant: {
  id: string;
  name?: string | null;
  phoneNumber: string;
}): string {
  if (participant.name && participant.name.trim().length > 0) {
    const nameSlug = slugify(participant.name);
    if (nameSlug) return nameSlug;
  }
  return `peserta-${participant.phoneNumber}`;
}
