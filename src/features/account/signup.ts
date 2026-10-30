export function signupPhone(value: string) {
  let phone = value.trim().replace(/[\s().-]/g, '');
  if (/^0\d{9}$/.test(phone)) phone = `+84${phone.slice(1)}`;
  if (!/^\+?[1-9]\d{8,14}$/.test(phone)) throw new Error('Vui lòng nhập số điện thoại hợp lệ (9–15 chữ số).');
  return phone;
}

export const DUPLICATE_ACCOUNT = 'Email hoặc số điện thoại đã được đăng ký. Vui lòng đăng nhập hoặc chọn Quên mật khẩu.';
export function isDuplicateAccount(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === 'ACCOUNT_EXISTS' || value?.code === 'user_already_exists' || value?.code === 'email_exists'
    || /already registered|already exists|profiles_phone_unique|số điện thoại đã được đăng ký/i.test(value?.message ?? '');
}
export function duplicateAccountError() {
  return Object.assign(new Error(DUPLICATE_ACCOUNT), { code: 'ACCOUNT_EXISTS' });
}
