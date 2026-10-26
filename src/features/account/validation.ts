import type { Row } from '../../types/supabase';
import type { DeliveryAddress } from '../order/checkout';
import { validCoordinates } from '../location/coordinates';
export function profileInput(fullName: string, phone: string, avatar: string | null) {
    const name = fullName.trim();
    const normalizedPhone = phone.trim().replace(/[\s().-]/g, '');
    if (name.length < 2 || name.length > 100)
        throw new Error('Họ tên cần từ 2 đến 100 ký tự.');
    if (normalizedPhone && !/^\+?\d{9,15}$/.test(normalizedPhone))
        throw new Error('Số điện thoại cần từ 9 đến 15 chữ số.');
    return { p_full_name: name, p_phone: normalizedPhone || null, p_avatar_url: avatar };
}
export type SavedAddress = Row<'user_addresses'>;
export function addressInput(id: string, address: DeliveryAddress, isDefault: boolean, create: boolean) {
    if (!['Home', 'Work', 'Other'].includes(address.label))
        throw new Error('Loại địa chỉ không hợp lệ.');
    if (address.street.trim().length < 5 || address.street.trim().length > 500)
        throw new Error('Địa chỉ cần từ 5 đến 500 ký tự.');
    if (!validCoordinates(address))
        throw new Error('Vui lòng chọn tọa độ giao hàng hợp lệ.');
    return { p_id: id, p_title: address.label, p_address: address.street.trim(), p_latitude: address.latitude, p_longitude: address.longitude, p_is_default: isDefault, p_create: create };
}
export function deliveryFromSaved(row: SavedAddress): DeliveryAddress | null {
    if (!validCoordinates(row))
        return null;
    return { savedAddressId: row.id, street: row.address, label: row.title === 'Home' || row.title === 'Work' ? row.title : 'Other', latitude: row.latitude, longitude: row.longitude };
}
export function reconcileDeliveryAddress(current: DeliveryAddress, rows: SavedAddress[]): DeliveryAddress {
    const selected = current.savedAddressId ? rows.find(row => row.id === current.savedAddressId) : undefined;
    if (!current.savedAddressId && current.street.trim())
        return current; // Keep an explicitly chosen manual pin.
    const next = (selected && deliveryFromSaved(selected)) || deliveryFromSavedDefault(rows);
    if (!next)
        return current.savedAddressId ? { street: '', label: 'Home' } : current;
    return current.savedAddressId === next.savedAddressId && current.street === next.street && current.label === next.label && current.latitude === next.latitude && current.longitude === next.longitude ? current : next;
}
function deliveryFromSavedDefault(rows: SavedAddress[]) {
    const row = rows.find(item => item.is_default && validCoordinates(item));
    return row ? deliveryFromSaved(row) : null;
}
