import { SetMetadata } from '@nestjs/common';

export const ANY_AUTHENTICATED_KEY = 'anyAuthenticated';

/**
 * Allow any authenticated user, regardless of role. Used for own-account
 * routes (profile, password, logout, avatar) and personal notifications.
 */
export const AnyAuthenticated = () => SetMetadata(ANY_AUTHENTICATED_KEY, true);
