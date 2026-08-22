import { PROFILE_KEY, createDefaultProfile, normalizeProfile } from './profile.js';

function canReadStorage(storage) {
  try {
    const hasMethods = storage != null
      && typeof storage.getItem === 'function'
      && typeof storage.setItem === 'function';
    if (!hasMethods) return false;
    storage.getItem(PROFILE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function createProfileStorage(storage) {
  const isPersistent = canReadStorage(storage);

  return {
    isPersistent,
    load() {
      if (!isPersistent) return createDefaultProfile();
      try {
        const serialized = storage.getItem(PROFILE_KEY);
        return normalizeProfile(serialized === null ? undefined : JSON.parse(serialized));
      } catch {
        return createDefaultProfile();
      }
    },
    save(profile) {
      if (!isPersistent) return false;
      try {
        storage.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(profile)));
        return true;
      } catch {
        return false;
      }
    },
  };
}
