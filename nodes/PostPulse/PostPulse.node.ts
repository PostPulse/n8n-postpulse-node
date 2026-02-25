import {
	NodeConnectionTypes,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type ILoadOptionsFunctions,
} from 'n8n-workflow';

import { executeAccountOperation } from './resources/AccountResource';
import { executeMediaOperation } from './resources/MediaResource';
import { executePostOperation } from './resources/PostResource';
import { makeApiRequest } from './helpers/ApiHelper';

export class PostPulse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'PostPulse',
		name: 'postPulse',
		icon: 'file:postpulse.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with PostPulse API to manage social media posts',
		defaults: {
			name: 'PostPulse',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'postPulseOAuth2Api',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://api.post-pulse.com',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'account',
					},
					{
						name: 'Media',
						value: 'media',
					},
					{
						name: 'Post',
						value: 'post',
					},
				],
				default: 'post',
			},
			// Account Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['account'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get connected social media accounts',
						action: 'Get connected accounts',
					},
					{
						name: 'Get Connected Chats',
						value: 'getConnectedChats',
						description: 'Get connected chats for an account by platform',
						action: 'Get connected chats',
					},
				],
				default: 'getAll',
			},
			// Account Fields
			{
				displayName: 'Account ID',
				name: 'accountId',
				type: 'number',
				required: true,
				default: 0,
				displayOptions: {
					show: {
						resource: ['account'],
						operation: ['getConnectedChats'],
					},
				},
				description: 'ID of the account to get connected chats for',
			},
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['account'],
						operation: ['getConnectedChats'],
					},
				},
				description: 'Platform to get connected chats for. Use the platform value from the Get Many accounts operation.',
			},
			// Media Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['media'],
					},
				},
				options: [
					{
						name: 'Upload',
						value: 'upload',
						description: 'Upload media file',
						action: 'Upload media',
					},
					{
						name: 'Get Upload Status',
						value: 'getUploadStatus',
						description: 'Get the status of a media import job',
						action: 'Get upload status',
					},
				],
				default: 'upload',
			},
			// Post Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['post'],
					},
				},
				options: [
					{
						name: 'Schedule',
						value: 'schedule',
						description: 'Schedule a post',
						action: 'Schedule a post',
					},
					{
						name: 'Schedule (Light)',
						value: 'scheduleLight',
						description: 'Schedule a post with simplified interface',
						action: 'Schedule a light post',
					},
				],
				default: 'schedule',
			},
			// Media Upload Fields
			{
				displayName: 'Upload Source',
				name: 'uploadSource',
				type: 'options',
				options: [
					{
						name: 'From File',
						value: 'file',
						description: 'Upload a binary file from the workflow',
					},
					{
						name: 'From Public URL',
						value: 'url',
						description: 'Import media from a public URL',
					},
				],
				default: 'file',
				displayOptions: {
					show: {
						resource: ['media'],
						operation: ['upload'],
					},
				},
				description: 'Choose whether to upload a file or import from a URL',
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						resource: ['media'],
						operation: ['upload'],
						uploadSource: ['file'],
					},
				},
				description: 'Name of the binary property which contains the file to upload',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['media'],
						operation: ['upload'],
						uploadSource: ['url'],
					},
				},
				description: 'Public URL of the media to import',
				placeholder: 'https://example.com/image.jpg',
			},
			{
				displayName: 'Filename Hint',
				name: 'filenameHint',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['media'],
						operation: ['upload'],
						uploadSource: ['url'],
					},
				},
				description: 'Optional filename hint for the imported media (max 255 characters)',
				placeholder: 'my-image.jpg',
			},
			// Media Get Upload Status Fields
			{
				displayName: 'Import ID',
				name: 'importId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						resource: ['media'],
						operation: ['getUploadStatus'],
					},
				},
				description: 'The ID of the media import job to check status for',
			},
			// Post Schedule (Original) Fields 
			{
				displayName: 'Scheduled Time',
				name: 'scheduledTime',
				type: 'dateTime',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['schedule'],
					},
					},
					description: 'When to schedule the post. The time will be interpreted using the workflow timezone (see Workflow Settings).',
			},
			{
				displayName: '⚠️ Scheduled Time is interpreted using the Workflow Timezone (see Workflow Settings)',
				name: 'timezoneNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['schedule'],
					},
				},
			},
			{
				displayName: 'Is Draft',
				name: 'isDraft',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['schedule'],
					},
				},
				description: 'Whether this is a draft post',
			},
			{
				displayName: 'Publications',
				name: 'publications',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['schedule'],
					},
				},
				default: {},
				options: [
					{
						name: 'publication',
						displayName: 'Publication',
						values: [
							{
								displayName: 'Social Media Account ID',
								name: 'socialMediaAccountId',
								type: 'number',
								required: true,
								default: 0,
								description: 'ID of the social media account to post to',
							},
							{
								displayName: 'Platform Settings',
								name: 'platformSettings',
								type: 'json',
								required: true,
								default: '{}',
								description: 'Platform-specific settings as JSON object',
							},
							{
								displayName: 'Posts',
								name: 'posts',
								type: 'fixedCollection',
								typeOptions: {
									multipleValues: true,
								},
								default: {},
								options: [
									{
										name: 'post',
										displayName: 'Post',
										values: [
											{
												displayName: 'Attachment Paths',
												name: 'attachmentPaths',
												type: 'fixedCollection',
												typeOptions: {
													multipleValues: true,
												},
												default: {},
												description: 'Paths to media attachments',
												options: [
													{
														name: 'path',
														displayName: 'Path',
														values: [
															{
																displayName: 'Path',
																name: 'value',
																type: 'string',
																default: '',
																description: 'Path to media attachment',
															},
														],
													},
												],
											},
											{
												displayName: 'Chat ID',
												name: 'chatId',
												type: 'string',
												default: '',
												description: 'Chat ID for Telegram and Facebook posts',
											},
											{
												displayName: 'Content',
												name: 'content',
												type: 'string',
												typeOptions: {
													rows: 5
												},
												default: '',
												description: 'Post content/text',
											},
											{
												displayName: 'Thumbnail Path',
												name: 'thumbnailPath',
												type: 'string',
												default: '',
												description: 'Path to thumbnail image',
											},
										],
									},
								],
							},
						],
					},
				],
			},
			// Post Schedule (Light) Fields
			{
				displayName: 'Scheduled Time',
				name: 'scheduledTime',
				type: 'dateTime',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
					},
				},
				description: 'When to schedule the post. The time will be interpreted using the workflow timezone (see Workflow Settings).',
			},
			{
				displayName: '⚠️ Scheduled Time is interpreted using the Workflow Timezone (see Workflow Settings)',
				name: 'timezoneNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
					},
				},
			},
			{
				displayName: 'Social Media Account Name or ID',
				name: 'socialMediaAccount',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getAccounts',
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
					},
				},
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'hidden',
				default: '={{ $parameter.socialMediaAccount ? $parameter.socialMediaAccount.split("|")[0] : "" }}',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
					},
				},
			},
			// Dynamic fields for Instagram
			{
				displayName: 'Publication Type',
				name: 'publicationType',
				type: 'options',
				options: [
					{
						name: 'Feed',
						value: 'FEED',
					},
					{
						name: 'Reels',
						value: 'REELS',
					},
					{
						name: 'Story',
						value: 'STORY',
					},
				],
				default: 'FEED',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
						platform: ['INSTAGRAM'],
					},
				},
				description: 'Type of Instagram publication',
			},
			// Dynamic fields for Facebook
			{
				displayName: 'Publication Type',
				name: 'facebookPublicationType',
				type: 'options',
				options: [
					{
						name: 'Feed',
						value: 'FEED',
					},
					{
						name: 'Reels',
						value: 'REELS',
					},
					{
						name: 'Story',
						value: 'STORY',
					},
				],
				default: 'FEED',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
						platform: ['FACEBOOK'],
					},
				},
				description: 'Type of Facebook publication',
			},
			// Dynamic fields for YouTube
			{
				displayName: 'Video Title',
				name: 'youtubeTitle',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
						platform: ['YOUTUBE'],
					},
				},
				description: 'Title for the YouTube video',
			},
			// Dynamic fields for TikTok
			{
				displayName: 'Title',
				name: 'tiktokTitle',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
						platform: ['TIKTOK'],
					},
				},
				description: 'Title for the TikTok post',
			},
			// Dynamic fields for Threads
			{
				displayName: 'Topic Tag',
				name: 'threadsTopicTag',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
						platform: ['THREADS'],
					},
				},
				description: 'Optional topic tag for Threads post',
			},
			// Dynamic dropdowns for Facebook Pages and Telegram Channels
			{
				displayName: 'Page Name or ID',
				name: 'facebookPage',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getConnectedChats',
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
						platform: ['FACEBOOK'],
					},
				},
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Channel Name or ID',
				name: 'telegramChannel',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getConnectedChats',
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
						platform: ['TELEGRAM'],
					},
				},
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				typeOptions: {
					rows: 5
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
					},
				},
				description: 'Post content/text',
			},
			{
				displayName: 'Attachment Paths',
				name: 'attachmentPaths',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['scheduleLight'],
					},
				},
				placeholder: 'user_uuid/uuid1.jpg, user_uuid/uuid2.mp4, user_uuid/uuid3.png',
				description: 'Comma-separated list of media attachment paths',
			},
		],
	};

	methods = {
		loadOptions: {
			async getAccounts(this: ILoadOptionsFunctions) {
				try {
					const accounts = await makeApiRequest.call(this, 'GET', '/v1/accounts');
					return accounts.map((account: any) => ({
						name: `${account.platform} - @${account.accountUsername}`,
						// Store both ID and platform in a pipe-separated format for easier matching
						value: `${account.platform}|${account.id}`,
					}));
				} catch (error) {
					// If API call fails, return empty array
					return [];
				}
			},
			async getConnectedChats(this: ILoadOptionsFunctions) {
				try {
					const socialMediaAccount = this.getNodeParameter('socialMediaAccount') as string;
					const [platform, accountIdStr] = socialMediaAccount.split('|');
					const accountId = parseInt(accountIdStr, 10);
					
					const chats = await makeApiRequest.call(this, 'GET', `/v1/accounts/${accountId}/chats?platform=${platform}`);
					return chats.map((chat: any) => ({
						name: chat.title,
						value: chat.id,
					}));
				} catch (error) {
					// If API call fails, return empty array
					return [];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: any;

				if (resource === 'account') {
					responseData = await executeAccountOperation.call(this, operation, i);
				} else if (resource === 'media') {
					responseData = await executeMediaOperation.call(this, operation, i);
				} else if (resource === 'post') {
					responseData = await executePostOperation.call(this, operation, i);
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);

				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionErrorData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: error.message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionErrorData);
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
