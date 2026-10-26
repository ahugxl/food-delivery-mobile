export function imageFromBase64(base64: string) {
  if (base64.length > 7 * 1024 * 1024) throw new Error('Ảnh không được vượt quá 5 MB.');
  const binary = atob(base64);
  if (!binary.length || binary.length > 5 * 1024 * 1024) throw new Error('Ảnh không hợp lệ hoặc lớn hơn 5 MB.');
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
    : bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? 'image/png'
    : binary.startsWith('RIFF') && binary.slice(8, 12) === 'WEBP' ? 'image/webp' : null;
  if (!mime) throw new Error('Vui lòng chọn ảnh JPEG, PNG hoặc WebP.');
  return { buffer, mime, extension: mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] };
}
