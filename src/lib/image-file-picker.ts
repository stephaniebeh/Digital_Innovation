const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif)$/i;

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name);
}

/** Copy out of the input FileList — the list is cleared if the input re-renders. */
export function imageFilesFromFileList(list: FileList | null): File[] {
  if (!list?.length) return [];
  return Array.from(list).filter(isImageFile);
}
