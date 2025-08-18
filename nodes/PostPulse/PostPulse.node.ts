import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import { executeAccountOperation } from './resources/AccountResource';
import { executeMediaOperation } from './resources/MediaResource';
import { executePostOperation } from './resources/PostResource';

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
