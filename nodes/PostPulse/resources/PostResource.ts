import type {
	IExecuteFunctions,
	IDataObject,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import { makeApiRequest } from '../helpers/ApiHelper';
import { toUtcIsoInTimezone } from '../helpers/DateHelper';
import { TIKTOK_PRIVACY_LEVEL_LABELS, fetchTikTokCreatorInfo, type TikTokCreatorInfo } from '../helpers/TikTokHelper';

export async function executePostOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<any> {
	if (operation === 'schedule') {
		return await schedulePost.call(this, itemIndex);
	}

	if (operation === 'scheduleLight') {
		return await schedulePostLight.call(this, itemIndex);
	}

	if (operation === 'getDeliverySummary') {
		return await getDeliverySummary.call(this, itemIndex);
	}

	throw new NodeOperationError(this.getNode(), `Unknown post operation: ${operation}`, { itemIndex });
}

/** The delivery summary of a WhatsApp broadcast: how many of its messages are in each status. */
async function getDeliverySummary(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const accountId = this.getNodeParameter('whatsappAccount', itemIndex) as number | string;
	const postId = this.getNodeParameter('postId', itemIndex) as number;

	return await makeApiRequest.call(this, 'GET', `/v1/accounts/${accountId}/whatsapp/posts/${postId}/delivery`);
}

/**
 * Reads the `scheduledTime` parameter and converts it to a UTC ISO string,
 * interpreting a naive value in the workflow timezone (Workflow Settings).
 */
function resolveScheduledTime(this: IExecuteFunctions, itemIndex: number): string {
	const scheduledTimeStr = this.getNodeParameter('scheduledTime', itemIndex) as string | Date;

	return toUtcIsoInTimezone(scheduledTimeStr, this.getTimezone(), this.getNode(), itemIndex);
}

// One creator-info lookup per TikTok account per execution: all items of a run share the same `this`
const tiktokCreatorInfoByExecution = new WeakMap<IExecuteFunctions, Map<number, Promise<TikTokCreatorInfo | undefined>>>();

function getTikTokCreatorInfo(this: IExecuteFunctions, accountId: number): Promise<TikTokCreatorInfo | undefined> {
	let byAccount = tiktokCreatorInfoByExecution.get(this);
	if (!byAccount) {
		byAccount = new Map();
		tiktokCreatorInfoByExecution.set(this, byAccount);
	}
	let creatorInfo = byAccount.get(accountId);
	if (!creatorInfo) {
		creatorInfo = fetchTikTokCreatorInfo.call(this, accountId);
		byAccount.set(accountId, creatorInfo);
	}
	return creatorInfo;
}

/**
 * Builds the TikTok-specific platform settings.
 */
async function resolveTikTokSettings(this: IExecuteFunctions, itemIndex: number, accountId: number): Promise<IDataObject> {
	const title = this.getNodeParameter('tiktokTitle', itemIndex, '') as string;
	if (!title.trim()) {
		throw new NodeOperationError(this.getNode(), 'TikTok title is required', { itemIndex });
	}

	const creatorInfo = await getTikTokCreatorInfo.call(this, accountId);
	// Same fallback as the planner-app: every level is allowed when creator info is unavailable
	const privacyLevels = creatorInfo?.privacy_level_options ?? Object.keys(TIKTOK_PRIVACY_LEVEL_LABELS);
	const privacyLevel = this.getNodeParameter('tiktokPrivacyLevel', itemIndex, '') as string;
	if (!privacyLevels.includes(privacyLevel)) {
		throw new NodeOperationError(
			this.getNode(),
			privacyLevel ? `TikTok privacy level ${privacyLevel} is not available for this account` : 'TikTok privacy level is required',
			{
				itemIndex,
				description: `Choose a Privacy Level. Available values: ${privacyLevels.join(', ')}.`,
			},
		);
	}

	// Turning Disclose Content off clears both commercial content flags
	const discloseContent = this.getNodeParameter('tiktokDiscloseContent', itemIndex, false) as boolean;
	const brandOrganic = discloseContent && (this.getNodeParameter('tiktokBrandOrganic', itemIndex, false) as boolean);
	const brandContent = discloseContent && (this.getNodeParameter('tiktokBrandContent', itemIndex, false) as boolean);
	// TikTok Content Sharing Guidelines: branded content "can only be configured with visibility as public/friends"
	if (brandContent && privacyLevel === 'SELF_ONLY') {
		throw new NodeOperationError(this.getNode(), "Visibility for branded content can't be private", {
			itemIndex,
			description: 'Choose another Privacy Level or turn off Branded Content.',
		});
	}

	// Interactions disabled in the account's TikTok app settings stay disabled, as in the planner-app
	return {
		title,
		privacyLevel,
		disableComments: creatorInfo?.comment_disabled === true || !(this.getNodeParameter('tiktokAllowComments', itemIndex, false) as boolean),
		disableDuet: creatorInfo?.duet_disabled === true || !(this.getNodeParameter('tiktokAllowDuet', itemIndex, false) as boolean),
		disableStitch: creatorInfo?.stitch_disabled === true || !(this.getNodeParameter('tiktokAllowStitch', itemIndex, false) as boolean),
		autoAddMusic: this.getNodeParameter('tiktokAutoAddMusic', itemIndex, false) as boolean,
		brandOrganic,
		brandContent,
		hasUsageConfirmation: true,
	};
}

/**
 * Builds the Pinterest-specific platform settings. The board is sent as the post's chatId.
 */
function resolvePinterestSettings(this: IExecuteFunctions, itemIndex: number): IDataObject {
	const settings: IDataObject = {};
	const optionalFields: Array<[string, string]> = [
		['title', 'pinterestTitle'],
		['link', 'pinterestLink'],
		['altText', 'pinterestAltText'],
		['boardSectionId', 'pinterestBoardSectionId'],
	];
	for (const [settingName, parameterName] of optionalFields) {
		const value = String(this.getNodeParameter(parameterName, itemIndex, '') ?? '').trim();
		if (value) {
			settings[settingName] = value;
		}
	}
	return settings;
}

/**
 * Builds the WhatsApp-specific platform settings. The sending number is sent as the post's chatId; the API
 * checks the template's variables.
 */
function resolveWhatsAppSettings(this: IExecuteFunctions, itemIndex: number): IDataObject {
	const settings: IDataObject = {};
	const contactListId = this.getNodeParameter('whatsappContactList', itemIndex, '');
	if (contactListId !== '') {
		settings.contactListId = Number(contactListId);
	}
	const [templateName, templateLanguage] = String(this.getNodeParameter('whatsappTemplate', itemIndex, '') ?? '').split('|');
	if (templateName) {
		settings.templateName = templateName;
	}
	if (templateLanguage) {
		settings.templateLanguage = templateLanguage;
	}
	const headerParameter = String(this.getNodeParameter('whatsappHeaderParameter', itemIndex, '') ?? '').trim();
	if (headerParameter) {
		settings.headerParameter = headerParameter;
	}
	const collections: Array<[string, string]> = [
		['bodyParameters', 'whatsappBodyParameters'],
		['buttonParameters', 'whatsappButtonParameters'],
	];
	for (const [settingName, parameterName] of collections) {
		const values = toKeyValues(this.getNodeParameter(parameterName, itemIndex, {}) as IDataObject);
		if (Object.keys(values).length > 0) {
			settings[settingName] = values;
		}
	}
	// Sent for every template: the API applies it only to a header video whose index (moov box) is at the end
	const androidVideoCompat = String(this.getNodeParameter('whatsappAndroidVideoCompat', itemIndex, 'REPACK') ?? '').trim();
	if (androidVideoCompat) {
		settings.androidVideoCompat = androidVideoCompat;
	}
	return settings;
}

/** The key/value pairs of a fixedCollection with a multiple `parameter` option, without empty keys. */
function toKeyValues(collection: IDataObject): IDataObject {
	const values: IDataObject = {};
	for (const entry of (collection.parameter as IDataObject[] | undefined) ?? []) {
		const key = String(entry.key ?? '').trim();
		if (key) {
			values[key] = String(entry.value ?? '');
		}
	}
	return values;
}

async function schedulePost(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const scheduleMode = this.getNodeParameter('scheduleMode', itemIndex, 'scheduled') as string;

	let scheduledTime: string | null = null;
	if (scheduleMode === 'scheduled') {
		scheduledTime = resolveScheduledTime.call(this, itemIndex);
	}

	const isDraft = this.getNodeParameter('isDraft', itemIndex) as boolean;
	const publications = this.getNodeParameter('publications.publication', itemIndex, []) as any[];

	const body: IDataObject = {
		isDraft,
		publications: publications.map((pub) => {
			const publication: IDataObject = {
				socialMediaAccountId: pub.socialMediaAccountId,
				posts: (pub.posts?.post || []).map((post: any) => {
					const postData: IDataObject = {};

					// Only add non-empty values
					if (post.content) postData.content = post.content;
					if (post.chatId) postData.chatId = post.chatId;
					if (post.thumbnailPath) postData.thumbnailPath = post.thumbnailPath;

					// Handle attachment paths - only add if there are valid paths
					const attachmentPaths = (post.attachmentPaths?.path || [])
						.map((path: any) => path.value)
						.filter((value: string) => value && value.trim() !== '');

					if (attachmentPaths.length > 0) {
						postData.attachmentPaths = attachmentPaths;
					}

					return postData;
				}),
			};

			const platformSettings = parsePlatformSettings.call(this, pub.platformSettings, itemIndex);
			if (platformSettings) {
				publication.platformSettings = platformSettings;
			}
			return publication;
		}),
	};

	if (scheduledTime) {
		body.scheduledTime = scheduledTime;
	}

	return makeApiRequest.call(this, 'POST', '/v1/posts', body);
}

/**
 * The platform settings of a Schedule (Advanced) publication, or undefined when they are empty. The field holds JSON
 * text, but an expression in it may return an object (for example one built from Get Templates output), which n8n
 * passes on as is.
 */
function parsePlatformSettings(this: IExecuteFunctions, value: unknown, itemIndex: number): IDataObject | undefined {
	let settings = value;
	if (typeof settings === 'string') {
		if (!settings.trim()) {
			return undefined;
		}
		try {
			settings = JSON.parse(settings);
		} catch (error) {
			throw new NodeOperationError(this.getNode(), 'Platform Settings is not valid JSON', {
				itemIndex,
				description: (error as Error).message,
			});
		}
	}
	if (settings && typeof settings === 'object' && !Array.isArray(settings) && Object.keys(settings).length > 0) {
		return settings as IDataObject;
	}
	return undefined;
}

async function schedulePostLight(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const scheduleMode = this.getNodeParameter('scheduleMode', itemIndex, 'scheduled') as string;

	let scheduledTime: string | null = null;
	if (scheduleMode === 'scheduled') {
		scheduledTime = resolveScheduledTime.call(this, itemIndex);
	}
	const socialMediaAccountValue = this.getNodeParameter('socialMediaAccount', itemIndex) as string;
	const content = this.getNodeParameter('content', itemIndex, '') as string;
	const attachmentPathsString = this.getNodeParameter('attachmentPaths', itemIndex, '') as string;

	// Parse the pipe-separated value to extract platform and ID
	const [platform, accountIdStr] = socialMediaAccountValue.split('|');
	const accountId = parseInt(accountIdStr, 10);

	// Get chatId from Facebook Page, Telegram Channel, Pinterest board or WhatsApp number if applicable
	let chatId = '';
	if (platform === 'FACEBOOK') {
		chatId = this.getNodeParameter('facebookPage', itemIndex, '') as string;
	} else if (platform === 'TELEGRAM') {
		chatId = this.getNodeParameter('telegramChannel', itemIndex, '') as string;
	} else if (platform === 'PINTEREST') {
		chatId = this.getNodeParameter('pinterestBoard', itemIndex, '') as string;
	} else if (platform === 'WHATSAPP') {
		chatId = this.getNodeParameter('whatsappPhoneNumber', itemIndex, '') as string;
	}

	// Build platform settings based on the platform
	// Handle platform name vs API type mismatches
	let apiType = platform;
	if (platform === 'TIKTOK') {
		apiType = 'TIK_TOK';
	} else if (platform === 'X_TWITTER') {
		apiType = 'TWITTER';
	}

	const platformSettings: IDataObject = {
		type: apiType,
	};

	// Add platform-specific fields
	if (platform === 'INSTAGRAM') {
		const publicationType = this.getNodeParameter('publicationType', itemIndex, 'FEED') as string;
		platformSettings.publicationType = publicationType;
	} else if (platform === 'FACEBOOK' || platform === 'FACEBOOK_PAGE') {
		// A Facebook Page account is the Page itself: same publication types, no Page to pick
		const facebookPublicationType = this.getNodeParameter('facebookPublicationType', itemIndex, 'FEED') as string;
		platformSettings.publicationType = facebookPublicationType;
	} else if (platform === 'YOUTUBE') {
		const youtubeTitle = this.getNodeParameter('youtubeTitle', itemIndex) as string;
		platformSettings.title = youtubeTitle;
	} else if (platform === 'TIKTOK') {
		Object.assign(platformSettings, await resolveTikTokSettings.call(this, itemIndex, accountId));
	} else if (platform === 'THREADS') {
		const threadsTopicTag = this.getNodeParameter('threadsTopicTag', itemIndex, '') as string;
		if (threadsTopicTag && threadsTopicTag.trim() !== '') {
			platformSettings.topicTag = threadsTopicTag;
		}
	} else if (platform === 'PINTEREST') {
		Object.assign(platformSettings, resolvePinterestSettings.call(this, itemIndex));
	} else if (platform === 'WHATSAPP') {
		Object.assign(platformSettings, resolveWhatsAppSettings.call(this, itemIndex));
	}
	// For X_TWITTER, BLUE_SKY, TELEGRAM, LINKEDIN - just send the type

	// Additional parameters - only Instagram and TikTok support them
	if (platform === 'INSTAGRAM' || platform === 'TIKTOK') {
		platformSettings.aiContent = this.getNodeParameter('aiContent', itemIndex, false) as boolean;
	}

	// Build the post data
	const postData: IDataObject = {};
	if (content) postData.content = content;
	if (chatId) postData.chatId = chatId;

	let posts: IDataObject[] = [postData];

	// Handle attachment paths - parse comma-separated string
	if (attachmentPathsString && attachmentPathsString.trim() !== '') {
		const attachmentPaths = attachmentPathsString
			.split(',')
			.map((path: string) => path.trim())
			.filter((path: string) => path !== '');

		if (attachmentPaths.length > 0) {
			// The API takes one media per story, and a publication holds any number of stories: same split as
			// the website. publicationType is set above only for the platforms that have it, so nothing else splits.
			posts = platformSettings.publicationType === 'STORY'
				? attachmentPaths.map((path: string) => ({ ...postData, attachmentPaths: [path] }))
				: [{ ...postData, attachmentPaths }];
		}
	}

	// Build the publication
	const publication: IDataObject = {
		socialMediaAccountId: accountId,
		posts,
		platformSettings,
	};

	const body: IDataObject = {
		isDraft: false, // Always false for Light version
		publications: [publication],
	};

	if (scheduledTime) {
		body.scheduledTime = scheduledTime;
	}

	return makeApiRequest.call(this, 'POST', '/v1/posts', body);
}

