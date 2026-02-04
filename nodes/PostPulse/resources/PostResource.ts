import type {
	IExecuteFunctions,
	IDataObject,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import { makeApiRequest } from '../helpers/ApiHelper';

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
	
	throw new NodeOperationError(this.getNode(), `Unknown post operation: ${operation}`, { itemIndex });
}

async function schedulePost(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const scheduledTime = this.getNodeParameter('scheduledTime', itemIndex) as string;
	const isDraft = this.getNodeParameter('isDraft', itemIndex) as boolean;
	const publications = this.getNodeParameter('publications.publication', itemIndex, []) as any[];

	const body: IDataObject = {
		scheduledTime,
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
			
			if (pub.platformSettings && pub.platformSettings.trim() !== '' && pub.platformSettings !== '{}') {
				const parsedSettings = JSON.parse(pub.platformSettings);
				if (parsedSettings && typeof parsedSettings === 'object' && Object.keys(parsedSettings).length > 0) {
					publication.platformSettings = parsedSettings;
				}
			}
			return publication;
		}),
	};

	return makeApiRequest.call(this, 'POST', '/v1/posts', body);
}

async function schedulePostLight(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const scheduledTime = this.getNodeParameter('scheduledTime', itemIndex) as string;
	const socialMediaAccountValue = this.getNodeParameter('socialMediaAccount', itemIndex) as string;
	const content = this.getNodeParameter('content', itemIndex, '') as string;
	const attachmentPathsString = this.getNodeParameter('attachmentPaths', itemIndex, '') as string;

	// Parse the pipe-separated value to extract platform and ID
	const [platform, accountIdStr] = socialMediaAccountValue.split('|');
	const accountId = parseInt(accountIdStr, 10);

	// Get chatId from Facebook Page or Telegram Channel if applicable
	let chatId = '';
	if (platform === 'FACEBOOK') {
		chatId = this.getNodeParameter('facebookPage', itemIndex, '') as string;
	} else if (platform === 'TELEGRAM') {
		chatId = this.getNodeParameter('telegramChannel', itemIndex, '') as string;
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
	} else if (platform === 'FACEBOOK') {
		const facebookPublicationType = this.getNodeParameter('facebookPublicationType', itemIndex, 'FEED') as string;
		platformSettings.publicationType = facebookPublicationType;
	} else if (platform === 'YOUTUBE') {
		const youtubeTitle = this.getNodeParameter('youtubeTitle', itemIndex) as string;
		platformSettings.title = youtubeTitle;
	} else if (platform === 'TIKTOK') {
		const tiktokTitle = this.getNodeParameter('tiktokTitle', itemIndex) as string;
		platformSettings.title = tiktokTitle;
		platformSettings.hasUsageConfirmation = true;
	} else if (platform === 'THREADS') {
		const threadsTopicTag = this.getNodeParameter('threadsTopicTag', itemIndex, '') as string;
		if (threadsTopicTag && threadsTopicTag.trim() !== '') {
			platformSettings.topicTag = threadsTopicTag;
		}
	}
	// For X_TWITTER, BLUE_SKY, TELEGRAM, LINKEDIN - just send the type

	// Build the post data
	const postData: IDataObject = {};
	if (content) postData.content = content;
	if (chatId) postData.chatId = chatId;

	// Handle attachment paths - parse comma-separated string
	if (attachmentPathsString && attachmentPathsString.trim() !== '') {
		const attachmentPaths = attachmentPathsString
			.split(',')
			.map((path: string) => path.trim())
			.filter((path: string) => path !== '');
		
		if (attachmentPaths.length > 0) {
			postData.attachmentPaths = attachmentPaths;
		}
	}

	// Build the publication
	const publication: IDataObject = {
		socialMediaAccountId: accountId,
		posts: [postData],
		platformSettings,
	};

	const body: IDataObject = {
		scheduledTime,
		isDraft: false, // Always false for Light version
		publications: [publication],
	};

	return makeApiRequest.call(this, 'POST', '/v1/posts', body);
}

