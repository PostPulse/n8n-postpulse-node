import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

import { makeApiRequest } from './ApiHelper';

/**
 * TikTok privacy levels (TikTokPostPrivacyLevel in the API) with the labels the planner-app shows.
 */
export const TIKTOK_PRIVACY_LEVEL_LABELS: Record<string, string> = {
	PUBLIC_TO_EVERYONE: 'Everyone',
	FOLLOWER_OF_CREATOR: 'Followers',
	MUTUAL_FOLLOW_FRIENDS: 'Friends (Mutual Followers)',
	SELF_ONLY: 'Only me',
};

/**
 * The `data` part of GET /v1/accounts/{id}/tiktok/creator-info
 */
export interface TikTokCreatorInfo {
	privacy_level_options?: string[];
	comment_disabled?: boolean;
	duet_disabled?: boolean;
	stitch_disabled?: boolean;
}

/**
 * Fetches the account's TikTok creator info. A failed lookup is not fatal:
 * it returns undefined and callers fall back to offering every option.
 */
export async function fetchTikTokCreatorInfo(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	accountId: number,
): Promise<TikTokCreatorInfo | undefined> {
	try {
		const response = await makeApiRequest.call(this, 'GET', `/v1/accounts/${accountId}/tiktok/creator-info`);
		return response?.data ?? undefined;
	} catch {
		return undefined;
	}
}
