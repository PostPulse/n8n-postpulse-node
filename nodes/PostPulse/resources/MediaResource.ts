import type {
	IExecuteFunctions,
	IHttpRequestOptions,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import { makeApiRequest } from '../helpers/ApiHelper';

export async function executeMediaOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<any> {
	if (operation === 'upload') {
		return await uploadMedia.call(this, itemIndex);
	} else if (operation === 'getUploadStatus') {
		return await getUploadStatus.call(this, itemIndex);
	}
	
	throw new NodeOperationError(this.getNode(), `Unknown media operation: ${operation}`, { itemIndex });
}

async function uploadMedia(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const uploadSource = this.getNodeParameter('uploadSource', itemIndex) as string;

	if (uploadSource === 'file') {
		return await uploadFromFile.call(this, itemIndex);
	} else if (uploadSource === 'url') {
		return await uploadFromUrl.call(this, itemIndex);
	}

	throw new NodeOperationError(
		this.getNode(),
		`Unknown upload source: ${uploadSource}`,
		{ itemIndex },
	);
}

async function uploadFromFile(this: IExecuteFunctions, itemIndex: number): Promise<any> {
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
	const filename = binaryData.fileName || 'file';
	const contentType = binaryData.mimeType || 'application/octet-stream';
	
	// Get binary data buffer
	const binaryBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	const sizeBytes = binaryBuffer.length;

	// Step 1: Get presigned upload URL
	const uploadRequest = {
		filename,
		contentType,
		sizeBytes,
	};

	const presignedResponse = await makeApiRequest.call(this, 'POST', '/v1/media/upload/urls', uploadRequest);
	
	if (!presignedResponse || !presignedResponse.url || !presignedResponse.key) {
		throw new NodeOperationError(
			this.getNode(),
			'Failed to get presigned upload URL from PostPulse API',
			{ itemIndex },
		);
	}

	// Step 2: Upload file to presigned URL
	const uploadOptions: IHttpRequestOptions = {
		method: presignedResponse.method || 'PUT',
		url: presignedResponse.url,
		body: binaryBuffer,
		headers: {
			...presignedResponse.headers,
			'Content-Type': contentType,
		},
	};

	try {
		await this.helpers.httpRequest(uploadOptions);
	} catch (error: any) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to upload file to presigned URL: ${error.message}`,
			{ itemIndex },
		);
	}

	// Return key in backward-compatible format
	return {
		path: presignedResponse.key,
	};
}

async function uploadFromUrl(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const url = this.getNodeParameter('url', itemIndex) as string;
	const filenameHint = this.getNodeParameter('filenameHint', itemIndex, '') as string;

	if (!url) {
		throw new NodeOperationError(
			this.getNode(),
			'URL is required for URL import',
			{ itemIndex },
		);
	}

	// Prepare import request
	const importRequest: any = {
		url,
	};

	if (filenameHint) {
		importRequest.filenameHint = filenameHint;
	}

	try {
		const response = await makeApiRequest.call(this, 'POST', '/v1/media/upload/import', importRequest);
		
		if (!response || typeof response.id === 'undefined') {
			throw new NodeOperationError(
				this.getNode(),
				'Invalid response from media import API',
				{ itemIndex },
			);
		}

		return {
			id: response.id,
			state: response.state,
		};
	} catch (error: any) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to import media from URL: ${error.message}`,
			{ itemIndex },
		);
	}
}

async function getUploadStatus(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	const importId = this.getNodeParameter('importId', itemIndex) as number;

	if (!importId) {
		throw new NodeOperationError(
			this.getNode(),
			'Import ID is required to get upload status',
			{ itemIndex },
		);
	}

	try {
		const response = await makeApiRequest.call(this, 'GET', `/v1/media/upload/import/${importId}`);
		
		if (!response || typeof response.id === 'undefined') {
			throw new NodeOperationError(
				this.getNode(),
				'Invalid response from media import status API',
				{ itemIndex },
			);
		}

		return response;
	} catch (error: any) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to get media import status: ${error.message}`,
			{ itemIndex },
		);
	}
}
