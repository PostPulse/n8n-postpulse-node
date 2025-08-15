import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestMethods,
	IRequestOptions,
	NodeConnectionType,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import { Buffer } from 'buffer';

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
		inputs: [{ displayName: '', type: 'main' as NodeConnectionType }],
		outputs: [{ displayName: '', type: 'main' as NodeConnectionType }],
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
				],
				default: 'schedule',
			},
			// Media Upload Fields
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
					},
				},
				description: 'Name of the binary property which contains the file to upload',
			},
			// Post Schedule Fields
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
				description: 'When to schedule the post',
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
												description: 'Chat ID for Telegram posts',
											},
											{
												displayName: 'Content',
												name: 'content',
												type: 'string',
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
		],
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
					if (operation === 'getAll') {
						responseData = await makeApiRequest.call(this, 'GET', '/v1/accounts');
					} else if (operation === 'getConnectedChats') {
						responseData = await getConnectedChats.call(this, i);
					}
				} else if (resource === 'media') {
					if (operation === 'upload') {
						responseData = await uploadMedia.call(this, i);
					}
				} else if (resource === 'post') {
					if (operation === 'schedule') {
						responseData = await schedulePost.call(this, i);
					}
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

async function makeApiRequest(
  this: IExecuteFunctions,
  method: IHttpRequestMethods,
  endpoint: string,
  body?: IDataObject,
  qs?: IDataObject,
): Promise<any> {

  const creds = await this.getCredentials('postPulseOAuth2Api') as { baseUrl?: string; clientId?: string; };
  const baseUrl = (creds.baseUrl || 'https://api.post-pulse.com').replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const options: IRequestOptions = { 
	method, 
	url, 
	json: true,
	headers: {
		'x-api-key': creds.clientId ?? ''
	}
  };
  if (body) options.body = body;
  if (qs) options.qs = qs;

  try {
    return await this.helpers.requestWithAuthentication.call(this, 'postPulseOAuth2Api', options);
  } catch (error: any) {
    throw new NodeOperationError(this.getNode(), `PostPulse API request failed: ${error.message}`, { itemIndex: 0 });
  }
}

async function makeApiRequestWithFormData(
  this: IExecuteFunctions,
  method: IHttpRequestMethods,
  endpoint: string,
  formData: IDataObject,
  itemIndex: number,
): Promise<any> {

  const creds = await this.getCredentials('postPulseOAuth2Api') as { baseUrl?: string; clientId?: string; };
  const baseUrl = (creds.baseUrl || 'https://api.post-pulse.com').replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const options: IRequestOptions = { 
	method, 
	url, 
	formData, 
	json: true,
	headers: {
		'x-api-key': creds.clientId ?? ''
	} 
  };

  try {
    return await this.helpers.requestWithAuthentication.call(this, 'postPulseOAuth2Api', options);
  } catch (error: any) {
    throw new NodeOperationError(this.getNode(), `Media upload failed: ${error.message}`, { itemIndex });
  }
}

async function uploadMedia(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;

	const item = this.getInputData()[itemIndex];

	if (!item.binary || !item.binary[binaryPropertyName]) {
		throw new NodeOperationError(
			this.getNode(),
			`No binary data found for property "${binaryPropertyName}"`,
			{
				itemIndex,
			},
		);
	}

	const binaryData = item.binary[binaryPropertyName];
	const formData: IDataObject = {};

	// Add main file
	formData.file = {
		value: Buffer.from(binaryData.data, 'base64'),
		options: {
			filename: binaryData.fileName || 'file',
			contentType: binaryData.mimeType,
		},
	};

	return await makeApiRequestWithFormData.call(this, 'POST', '/v1/media/upload', formData, itemIndex);
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

	await makeApiRequest.call(this, 'POST', '/v1/posts', body);
	
	return body;
}

async function getConnectedChats(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const accountId = this.getNodeParameter('accountId', itemIndex) as number;
	const platform = this.getNodeParameter('platform', itemIndex) as string;

	const endpoint = `/v1/accounts/${accountId}/chats`;
	const queryParams = { platform };

	return await makeApiRequest.call(this, 'GET', endpoint, undefined, queryParams);
}
