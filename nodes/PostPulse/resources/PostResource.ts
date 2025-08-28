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
